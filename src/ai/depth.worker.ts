/// <reference lib="webworker" />
// Runs Depth Anything V3 off the main thread: download (with progress + Cache API),
// session creation (WebGPU first, WASM fallback), pre/post-processing and PNG encoding.
// The UI thread only sends a bitmap and receives a finished depth map.

// The webgpu bundle contains both the WebGPU (JSEP) and the plain WASM execution providers.
import * as ort from 'onnxruntime-web/webgpu';
import { depthToNearness, modelInputSize } from './depthMath';
import {
  type DepthBackend,
  type DepthBackendPreference,
  type DepthRequest,
  type DepthResponse,
  type DepthStage,
  errorMessage,
} from './depthProtocol';

declare const self: DedicatedWorkerGlobalScope;

const MODEL_BASE =
  'https://huggingface.co/onnx-community/depth-anything-v3-small/resolve/main/onnx/';
const MODEL_GRAPH_FILE = 'model.onnx';
const MODEL_DATA_FILE = 'model.onnx_data';
const CACHE_NAME = 'vwh-depth-model-v1';

// Threads need cross-origin isolation (COOP/COEP); GitHub Pages does not send those headers.
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency) : 1;
ort.env.wasm.proxy = false; // we already are the worker
// Hide ORT's harmless "some nodes run on CPU" warnings (they show up as console errors).
ort.env.logLevel = 'error';

interface ModelFiles {
  graph: Uint8Array;
  weights: Uint8Array;
}

let files: ModelFiles | null = null;
let filesPromise: Promise<ModelFiles> | null = null;
let session: ort.InferenceSession | null = null;
let sessionBackend: DepthBackend | null = null;
let fallbackReason: string | undefined;
/** Set once WebGPU failed, so we do not retry it on every request. */
let webgpuBroken = false;

function post(msg: DepthResponse, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

function progress(id: number, stage: DepthStage, value: number | null, extra = {}): void {
  post({ type: 'progress', id, stage, progress: value, ...extra });
}

/** Downloads a file with byte-level progress; reuses the Cache API copy when present. */
async function fetchCached(
  url: string,
  onBytes: (received: number, total: number) => void,
): Promise<Uint8Array> {
  // Cache API may be blocked (private mode, insecure origin) – then we just download.
  const cache =
    typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME).catch(() => null);
  try {
    const hit = await cache?.match(url);
    if (hit) {
      const data = new Uint8Array(await hit.arrayBuffer());
      onBytes(data.length, data.length);
      return data;
    }
  } catch {
    // Corrupted cache entry – fall through to a fresh download.
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nie udało się pobrać modelu (${response.status}): ${url}`);
  const total = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Brak treści odpowiedzi przy pobieraniu modelu');

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onBytes(received, total);
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  // Best effort: a full disk or quota error must not break the estimation.
  cache?.put(url, new Response(buffer.slice())).catch(() => {});
  return buffer;
}

function downloadModel(id: number): Promise<ModelFiles> {
  if (files) return Promise.resolve(files);
  if (!filesPromise) {
    filesPromise = (async () => {
      progress(id, 'download', 0);
      // The graph file is tiny (<1 MB); progress is driven by the weights file.
      const [graph, weights] = await Promise.all([
        fetchCached(MODEL_BASE + MODEL_GRAPH_FILE, () => {}),
        fetchCached(MODEL_BASE + MODEL_DATA_FILE, (loadedBytes, totalBytes) => {
          progress(id, 'download', totalBytes > 0 ? loadedBytes / totalBytes : null, {
            loadedBytes,
            totalBytes,
          });
        }),
      ]);
      files = { graph, weights };
      return files;
    })().finally(() => {
      filesPromise = null;
    });
  }
  return filesPromise;
}

async function createSession(backend: DepthBackend, model: ModelFiles) {
  return ort.InferenceSession.create(model.graph, {
    executionProviders: [backend],
    externalData: [{ path: MODEL_DATA_FILE, data: model.weights }],
  });
}

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

/** Makes sure a session exists on the best available backend. */
async function ensureSession(id: number, pref: DepthBackendPreference): Promise<DepthBackend> {
  const wanted: DepthBackend = pref === 'wasm' || webgpuBroken ? 'wasm' : 'webgpu';
  if (session && sessionBackend === wanted) return wanted;

  const model = await downloadModel(id);
  await releaseSession();

  if (wanted === 'webgpu') {
    progress(id, 'init', 0, { backend: 'webgpu' });
    if (await hasWebGpu()) {
      try {
        session = await createSession('webgpu', model);
        sessionBackend = 'webgpu';
        fallbackReason = undefined;
        progress(id, 'init', 1, { backend: 'webgpu' });
        return 'webgpu';
      } catch (err) {
        markWebGpuBroken(`WebGPU: ${errorMessage(err)}`);
      }
    } else {
      markWebGpuBroken('WebGPU niedostępne w tej przeglądarce');
    }
  }

  progress(id, 'init', 0.5, { backend: 'wasm' });
  session = await createSession('wasm', model);
  sessionBackend = 'wasm';
  if (pref === 'wasm') fallbackReason = undefined;
  progress(id, 'init', 1, { backend: 'wasm' });
  return 'wasm';
}

function markWebGpuBroken(reason: string): void {
  webgpuBroken = true;
  fallbackReason = reason;
  console.warn('[depth.worker] falling back to WASM –', reason);
}

async function releaseSession(): Promise<void> {
  const old = session;
  session = null;
  sessionBackend = null;
  await old?.release().catch(() => {});
}

// --- Pre / post-processing (OffscreenCanvas, no DOM) ---

function bitmapToTensor(bitmap: ImageBitmap): ort.Tensor {
  const { width: w, height: h } = modelInputSize(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('OffscreenCanvas 2D niedostępny');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const float = new Float32Array(3 * w * h);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let i = 0; i < w * h; i++) {
    float[i] = (data[i * 4] / 255 - mean[0]) / std[0]; // R
    float[w * h + i] = (data[i * 4 + 1] / 255 - mean[1]) / std[1]; // G
    float[2 * w * h + i] = (data[i * 4 + 2] / 255 - mean[2]) / std[2]; // B
  }
  // Shape: [batch, views, channels, height, width] – V3 supports multi-view input.
  return new ort.Tensor('float32', float, [1, 1, 3, h, w]);
}

/** Bilinear upscale of the model output to the photo's resolution. */
function resizeDepthMap(
  map: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  if (srcW === dstW && srcH === dstH) return map;
  const out = new Float32Array(dstW * dstH);
  const xs = srcW / dstW;
  const ys = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const fy = Math.min(Math.max((y + 0.5) * ys - 0.5, 0), srcH - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const ty = fy - y0;
    for (let x = 0; x < dstW; x++) {
      const fx = Math.min(Math.max((x + 0.5) * xs - 0.5, 0), srcW - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const tx = fx - x0;
      const top = map[y0 * srcW + x0] * (1 - tx) + map[y0 * srcW + x1] * tx;
      const bottom = map[y1 * srcW + x0] * (1 - tx) + map[y1 * srcW + x1] * tx;
      out[y * dstW + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

async function depthToPng(depth: Float32Array, w: number, h: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D niedostępny');
  const image = ctx.createImageData(w, h);
  for (let i = 0; i < depth.length; i++) {
    const v = Math.round(depth[i] * 255);
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function runModel(input: ort.Tensor): Promise<ort.Tensor> {
  const s = session!;
  const results = await s.run({ [s.inputNames[0]]: input });
  // Outputs: predicted_depth, confidence, extrinsics, intrinsics – only depth is used.
  return results['predicted_depth'] ?? results[s.outputNames[0]];
}

async function estimate(id: number, pref: DepthBackendPreference, bitmap: ImageBitmap) {
  try {
    let backend = await ensureSession(id, pref);
    const input = bitmapToTensor(bitmap);

    progress(id, 'inference', null, { backend });
    const t0 = performance.now();
    let output: ort.Tensor;
    try {
      output = await runModel(input);
    } catch (err) {
      if (backend !== 'webgpu') throw err;
      // Some GPUs/drivers create the session fine but fail at run time → retry on WASM.
      markWebGpuBroken(`WebGPU (inferencja): ${errorMessage(err)}`);
      backend = await ensureSession(id, 'wasm');
      progress(id, 'inference', null, { backend });
      output = await runModel(input);
    }
    const inferenceMs = performance.now() - t0;

    progress(id, 'postprocess', 0, { backend });
    const dims = output.dims as number[];
    const nearness = depthToNearness(output.data as Float32Array);
    output.dispose();
    const { width, height } = bitmap;
    const depth = resizeDepthMap(
      nearness,
      dims[dims.length - 1],
      dims[dims.length - 2],
      width,
      height,
    );
    const png = await depthToPng(depth, width, height);
    progress(id, 'postprocess', 1, { backend });

    post({ type: 'result', id, depth, width, height, png, backend, fallbackReason, inferenceMs }, [
      depth.buffer,
    ]);
  } finally {
    bitmap.close();
  }
}

async function handle(msg: DepthRequest): Promise<void> {
  try {
    if (msg.type === 'load') {
      const backend = await ensureSession(msg.id, msg.backend);
      post({ type: 'loaded', id: msg.id, backend, fallbackReason });
    } else if (msg.type === 'estimate') {
      await estimate(msg.id, msg.backend, msg.bitmap);
    }
  } catch (err) {
    console.error('[depth.worker]', err);
    post({ type: 'error', id: msg.id, message: errorMessage(err) });
  }
}

// Requests run one after another: a session must never be created twice in parallel.
let queue: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent<DepthRequest>) => {
  queue = queue.then(() => handle(e.data));
};

import * as ort from 'onnxruntime-web';
import { depthToNearness, modelInputSize } from './depthMath';

let session: ort.InferenceSession | null = null;
let loading = false;

// Depth Anything V3 Small (fp32, Apache-2.0). The ONNX export keeps the weights in a
// separate external-data file next to the small graph file.
const MODEL_BASE =
  'https://huggingface.co/onnx-community/depth-anything-v3-small/resolve/main/onnx/';
const MODEL_GRAPH_FILE = 'model.onnx';
const MODEL_DATA_FILE = 'model.onnx_data';

/** Human-readable info about the model, shown in the UI. */
export const DEPTH_MODEL_INFO = {
  name: 'Depth Anything V3 Small',
  precision: 'fp32 (pełna wersja)',
  sizeMb: 105,
} as const;

export type DepthProgressCallback = (progress: number) => void;

/** Downloads a file with byte-level progress reporting. */
async function fetchWithProgress(
  url: string,
  onBytes: (received: number, total: number) => void,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const total = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

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
  return buffer;
}

export async function loadDepthModel(onProgress?: DepthProgressCallback): Promise<void> {
  if (session || loading) return;
  loading = true;
  try {
    onProgress?.(0);
    // The graph file is tiny (<1 MB); progress is driven by the weights file.
    const [graph, weights] = await Promise.all([
      fetchWithProgress(MODEL_BASE + MODEL_GRAPH_FILE, () => {}),
      fetchWithProgress(MODEL_BASE + MODEL_DATA_FILE, (received, total) => {
        if (total > 0) onProgress?.(received / total);
      }),
    ]);
    onProgress?.(1);
    session = await ort.InferenceSession.create(graph, {
      executionProviders: ['wasm'],
      externalData: [{ path: MODEL_DATA_FILE, data: weights }],
    });
  } finally {
    loading = false;
  }
}

export function isDepthModelLoaded(): boolean {
  return session !== null;
}

/**
 * Estimates depth for every pixel. Returns a 0..1 "nearness" map at the image's
 * resolution (1 = closest to the camera, 0 = farthest).
 */
export async function estimateDepth(image: ImageData): Promise<Float32Array> {
  if (!session) throw new Error('Depth model not loaded. Call loadDepthModel() first.');

  const size = modelInputSize(image.width, image.height);
  const resized = resizeImageData(image, size.width, size.height);
  const inputTensor = imageDataToTensor(resized, size.width, size.height);

  const results = await session.run({ [session.inputNames[0]]: inputTensor });
  // Outputs: predicted_depth, confidence, extrinsics, intrinsics – only depth is used.
  const outputTensor = results['predicted_depth'] ?? results[session.outputNames[0]];
  const nearness = depthToNearness(outputTensor.data as Float32Array);
  return resizeDepthMap(nearness, outputTensor.dims as number[], image.width, image.height);
}

export function depthToCanvas(
  depthMap: Float32Array,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < depthMap.length; i++) {
    const v = Math.round(depthMap[i] * 255);
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function resizeImageData(source: ImageData, w: number, h: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(source, 0, 0);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  outCtx.drawImage(canvas, 0, 0, w, h);
  return outCtx.getImageData(0, 0, w, h);
}

function imageDataToTensor(image: ImageData, w: number, h: number): ort.Tensor {
  const { data } = image;
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

function resizeDepthMap(
  map: Float32Array,
  dims: number[],
  targetW: number,
  targetH: number,
): Float32Array {
  const srcH = dims[dims.length - 2];
  const srcW = dims[dims.length - 1];
  if (srcW === targetW && srcH === targetH) return map;

  const out = new Float32Array(targetW * targetH);
  const xScale = srcW / targetW;
  const yScale = srcH / targetH;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(Math.floor(x * xScale), srcW - 1);
      const sy = Math.min(Math.floor(y * yScale), srcH - 1);
      out[y * targetW + x] = map[sy * srcW + sx];
    }
  }
  return out;
}

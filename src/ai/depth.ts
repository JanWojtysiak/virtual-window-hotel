import * as ort from 'onnxruntime-web';

let session: ort.InferenceSession | null = null;
let loading = false;

const MODEL_URL =
  'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx';

const INPUT_WIDTH = 518;
const INPUT_HEIGHT = 518;

export type DepthProgressCallback = (progress: number) => void;

export async function loadDepthModel(onProgress?: DepthProgressCallback): Promise<void> {
  if (session || loading) return;
  loading = true;
  try {
    onProgress?.(0);
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Failed to fetch model: ${response.status}`);
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
      if (total > 0) onProgress?.(received / total);
    }

    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    onProgress?.(1);
    session = await ort.InferenceSession.create(buffer.buffer, {
      executionProviders: ['wasm'],
    });
  } finally {
    loading = false;
  }
}

export function isDepthModelLoaded(): boolean {
  return session !== null;
}

export async function estimateDepth(image: ImageData): Promise<Float32Array> {
  if (!session) throw new Error('Depth model not loaded. Call loadDepthModel() first.');

  const resized = resizeImageData(image, INPUT_WIDTH, INPUT_HEIGHT);
  const inputTensor = imageDataToTensor(resized, INPUT_WIDTH, INPUT_HEIGHT);

  const feeds: Record<string, ort.Tensor> = { image: inputTensor };
  const results = await session.run(feeds);

  const outputKey = session.outputNames[0];
  const outputTensor = results[outputKey];
  const depthRaw = outputTensor.data as Float32Array;

  const normalized = normalizeDepth(depthRaw);
  return resizeDepthMap(normalized, outputTensor.dims as number[], image.width, image.height);
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
  return new ort.Tensor('float32', float, [1, 3, h, w]);
}

function normalizeDepth(raw: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] < min) min = raw[i];
    if (raw[i] > max) max = raw[i];
  }
  const range = max - min || 1;
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = (raw[i] - min) / range;
  }
  return out;
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

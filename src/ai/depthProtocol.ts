// Messages exchanged between the main thread (DepthEstimator) and depth.worker.ts.
// Pure types + tiny helpers only, so both sides and the tests can import it.

/** Backend that actually runs the model. */
export type DepthBackend = 'webgpu' | 'wasm';

/** User preference: try WebGPU first and fall back to WASM, or force WASM. */
export type DepthBackendPreference = 'auto' | 'wasm';

export type DepthStage = 'download' | 'init' | 'inference' | 'postprocess';

export type DepthRequest =
  | { type: 'load'; id: number; backend: DepthBackendPreference }
  | {
      type: 'estimate';
      id: number;
      backend: DepthBackendPreference;
      /** Decoded photo; transferred to the worker (detached on the main thread). */
      bitmap: ImageBitmap;
    };

export interface DepthResultPayload {
  /** 0..1 nearness map (1 = close) at the photo's resolution, row-major from the top. */
  depth: Float32Array;
  width: number;
  height: number;
  /** Grayscale PNG of the depth map, encoded in the worker. */
  png: Blob;
  backend: DepthBackend;
  /** Set when WebGPU was tried and failed, so the UI can say why it fell back. */
  fallbackReason?: string;
  inferenceMs: number;
}

export type DepthResponse =
  | {
      type: 'progress';
      id: number;
      stage: DepthStage;
      /** 0..1 within the stage, or null when unknown. */
      progress: number | null;
      /** Bytes downloaded so far / total (only for `download`). */
      loadedBytes?: number;
      totalBytes?: number;
      backend?: DepthBackend;
    }
  | {
      type: 'loaded';
      id: number;
      backend: DepthBackend;
      fallbackReason?: string;
    }
  | ({ type: 'result'; id: number } & DepthResultPayload)
  | { type: 'error'; id: number; message: string };

/**
 * Maps a worker stage + in-stage progress to one 0..1 value for a single progress bar.
 * Download dominates (≈105 MB), the rest are short steps.
 */
export function overallProgress(stage: DepthStage, progress: number | null): number {
  const ranges: Record<DepthStage, [number, number]> = {
    download: [0, 0.75],
    init: [0.75, 0.85],
    inference: [0.85, 0.97],
    postprocess: [0.97, 1],
  };
  const [from, to] = ranges[stage];
  const p = progress === null ? 0 : Math.min(Math.max(progress, 0), 1);
  return from + (to - from) * p;
}

/** Turns anything thrown into a readable message (workers may throw strings or numbers). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Depth Anything V3 runs in a Web Worker (depth.worker.ts) through DepthEstimator
// (depthEstimator.ts). This module only describes the model for the UI, so the main bundle
// does not include onnxruntime-web at all.

/** Human-readable info about the model, shown in the UI. */
export const DEPTH_MODEL_INFO = {
  name: 'Depth Anything V3 Small',
  precision: 'fp32 (pełna wersja)',
  sizeMb: 105,
} as const;

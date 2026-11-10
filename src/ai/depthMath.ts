// Pure helpers for depth estimation (no onnxruntime import, so they are testable in Vitest).

/** Depth Anything uses a ViT with 14×14 patches, so input sides must be multiples of 14. */
export const PATCH_SIZE = 14;

/**
 * Model input size that keeps the image aspect ratio: the longer side becomes `longSide`
 * (rounded to a multiple of PATCH_SIZE), the shorter side is scaled proportionally.
 */
export function modelInputSize(
  width: number,
  height: number,
  longSide = 504,
): { width: number; height: number } {
  const roundToPatch = (v: number) => Math.max(PATCH_SIZE, Math.round(v / PATCH_SIZE) * PATCH_SIZE);
  const scale = longSide / Math.max(width, height);
  return { width: roundToPatch(width * scale), height: roundToPatch(height * scale) };
}

/**
 * Converts raw depth (bigger = farther, as output by Depth Anything V3) into a 0..1
 * "nearness" map (1 = closest, 0 = farthest). Uses inverse depth, which spreads values
 * like human perception does: near objects get more contrast than the distant background.
 */
export function depthToNearness(depth: ArrayLike<number>): Float32Array {
  const inv = new Float32Array(depth.length);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < depth.length; i++) {
    inv[i] = 1 / Math.max(depth[i], 1e-6);
    // Read back the stored float32 value so min/max match what is normalized below.
    const v = inv[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < inv.length; i++) inv[i] = (inv[i] - min) / range;
  return inv;
}

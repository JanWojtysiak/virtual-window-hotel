// Everything the 3D relief needs for one "smoothing" value, as one pure function.
// Runs in depthGrid.worker.ts (or on the main thread as a fallback) – no Three.js here.

import { smoothDepth } from './depthGrid';
import { buildBackgroundDepth, fillBackgroundColors } from './depthEdges';

/** How far (in nearness units 0..1) the background layer sits behind the front surface. */
export const BACKGROUND_OFFSET = 0.015;

export interface ReliefLayers {
  /** Smoothed nearness of the front surface, `size × size`, row 0 = top. */
  grid: Float32Array;
  /** Nearness of the background layer that fills holes behind discarded triangles. */
  bgDepth: Float32Array;
  /** Inpainted RGBA colours of the background layer. */
  bgColors: Uint8Array;
}

/**
 * @param base    downsampled (unsmoothed) nearness grid, `size × size`
 * @param colors  photo colours sampled on the same grid (RGBA, 0..255)
 */
export function buildReliefLayers(
  base: Float32Array,
  size: number,
  smoothing: number,
  colors: ArrayLike<number>,
): ReliefLayers {
  const grid = smoothDepth(base, size, size, smoothing);
  // Background must cover the band of discarded triangles, which widens with smoothing.
  const radius = 3 * Math.max(0, Math.round(smoothing)) + 4;
  const bgDepth = buildBackgroundDepth(grid, size, size, radius, BACKGROUND_OFFSET);
  const bgColors = fillBackgroundColors(colors, grid, bgDepth, size, size, radius, 0.08);
  return { grid, bgDepth, bgColors };
}

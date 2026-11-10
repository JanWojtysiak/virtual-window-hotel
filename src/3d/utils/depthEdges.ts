// Pure helpers for depth edges: the background ("hole filler") layer of the 3D relief.
// No Three.js import here, so everything is testable in Vitest.
//
// Idea: the front mesh discards triangles that are stretched across a depth jump
// (e.g. tree → sky). What shows through the hole is a second mesh behind it whose
// depth has the near objects "eroded away" and whose colours come only from the far side.
import { smoothDepth } from './depthGrid';

/** One separable min-filter pass (square window of radius `r`, clamped edges). */
function minPass(src: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = Infinity;
      for (let k = -r; k <= r; k++) {
        const sx = horizontal ? Math.min(Math.max(x + k, 0), w - 1) : x;
        const sy = horizontal ? y : Math.min(Math.max(y + k, 0), h - 1);
        const v = src[sy * w + sx];
        if (v < m) m = v;
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

/**
 * Morphological erosion of a nearness map (1 = close): every cell takes the smallest
 * (= farthest) value in a `(2r + 1)²` window. Near objects thinner than `2r` disappear.
 */
export function erodeNearness(
  src: ArrayLike<number>,
  w: number,
  h: number,
  radius: number,
): Float32Array {
  const r = Math.max(0, Math.round(radius));
  const copy = Float32Array.from(src);
  if (r === 0) return copy;
  return minPass(minPass(copy, w, h, r, true), w, h, r, false);
}

/**
 * Depth of the background layer: eroded + smoothed nearness, never in front of the
 * original surface and pushed back by `offset`, so the front mesh always wins the
 * depth test where it is not discarded.
 */
export function buildBackgroundDepth(
  grid: Float32Array,
  w: number,
  h: number,
  radius: number,
  offset: number,
): Float32Array {
  const eroded = erodeNearness(grid, w, h, radius);
  const smooth = smoothDepth(eroded, w, h, Math.max(1, Math.round(radius / 2)));
  for (let i = 0; i < smooth.length; i++) {
    smooth[i] = Math.min(smooth[i], grid[i]) - offset;
  }
  return smooth;
}

/**
 * Box blur (window sum, not normalised) of a line of `len` cells with `channels`
 * interleaved values, using a running sum: O(len) independent of the radius.
 */
function sumLine(
  src: Float32Array,
  dst: Float32Array,
  start: number,
  stride: number,
  len: number,
  r: number,
  channels: number,
): void {
  const at = (i: number) => start + Math.min(Math.max(i, 0), len - 1) * stride;
  for (let c = 0; c < channels; c++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[at(k) + c];
    for (let i = 0; i < len; i++) {
      dst[start + i * stride + c] = acc;
      acc += src[at(i + r + 1) + c] - src[at(i - r) + c];
    }
  }
}

/** Separable box blur (window sums) of `channels` interleaved values per cell. */
function blurInterleaved(
  src: Float32Array,
  w: number,
  h: number,
  r: number,
  channels: number,
): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) sumLine(src, tmp, y * w * channels, channels, w, r, channels);
  for (let x = 0; x < w; x++) sumLine(tmp, out, x * channels, w * channels, h, r, channels);
  return out;
}

/**
 * Colours of the background layer (simple inpainting without AI). Each cell gets a blurred
 * average of its neighbourhood, weighted by how close each pixel is to the background
 * depth: far pixels count fully, pixels of near objects (well in front of `bgDepth`) count
 * almost nothing. So the area behind a tree is filled with the sky/wall around it.
 *
 * @param rgba        `w × h × 4` colours (0..255), same grid as `depth`
 * @param depth       nearness of the front surface
 * @param bgDepth     nearness of the background layer (see `buildBackgroundDepth`)
 * @param radius      blur radius in cells
 * @param tolerance   nearness difference at which a pixel stops counting as background
 */
export function fillBackgroundColors(
  rgba: ArrayLike<number>,
  depth: ArrayLike<number>,
  bgDepth: ArrayLike<number>,
  w: number,
  h: number,
  radius: number,
  tolerance: number,
): Uint8Array {
  const n = w * h;
  // Premultiplied by weight: r, g, b, weight.
  const acc = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = Math.min(Math.max((depth[i] - bgDepth[i]) / tolerance, 0), 1);
    const wgt = (1 - t) * (1 - t) + 1e-4;
    acc[i * 4] = rgba[i * 4] * wgt;
    acc[i * 4 + 1] = rgba[i * 4 + 1] * wgt;
    acc[i * 4 + 2] = rgba[i * 4 + 2] * wgt;
    acc[i * 4 + 3] = wgt;
  }
  const r = Math.max(1, Math.round(radius));
  let blurred: Float32Array = acc;
  for (let pass = 0; pass < 2; pass++) blurred = blurInterleaved(blurred, w, h, r, 4);

  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const wgt = blurred[i * 4 + 3];
    for (let c = 0; c < 3; c++) {
      out[i * 4 + c] = Math.round(Math.min(Math.max(blurred[i * 4 + c] / wgt, 0), 255));
    }
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * How much a triangle is stretched by the displacement: depth change per grid cell
 * (`depthPerCell`) times `depthScale`, divided by the cell size. 1 ≈ a 45° slope.
 * Mirrors the check in the fragment shader – handy for picking the threshold.
 */
export function stretchRatio(depthPerCell: number, depthScale: number, segments: number): number {
  return Math.abs(depthPerCell) * depthScale * segments;
}

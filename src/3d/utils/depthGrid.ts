// Pure helpers that turn a full-resolution depth map into a small grid for the 3D relief.
// No Three.js import here, so everything is testable in Vitest.

/**
 * Downsamples a `srcW × srcH` map to `dstW × dstH` by averaging every source pixel into
 * the target cell it falls in (area averaging – no aliasing on big photos).
 */
export function downsampleDepth(
  src: ArrayLike<number>,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const sum = new Float32Array(dstW * dstH);
  const count = new Uint32Array(dstW * dstH);
  for (let y = 0; y < srcH; y++) {
    const ty = Math.min(Math.floor((y * dstH) / srcH), dstH - 1);
    for (let x = 0; x < srcW; x++) {
      const tx = Math.min(Math.floor((x * dstW) / srcW), dstW - 1);
      const i = ty * dstW + tx;
      sum[i] += src[y * srcW + x];
      count[i]++;
    }
  }
  // Upsampling (target bigger than source) leaves empty cells: fill them by nearest sampling.
  for (let ty = 0; ty < dstH; ty++) {
    for (let tx = 0; tx < dstW; tx++) {
      const i = ty * dstW + tx;
      if (count[i] > 0) {
        sum[i] /= count[i];
      } else {
        const sx = Math.min(Math.floor(((tx + 0.5) * srcW) / dstW), srcW - 1);
        const sy = Math.min(Math.floor(((ty + 0.5) * srcH) / dstH), srcH - 1);
        sum[i] = src[sy * srcW + sx];
      }
    }
  }
  return sum;
}

/** One separable box-blur pass with clamped edges. */
function boxBlurPass(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = 2 * r + 1;
  // Horizontal.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const sx = Math.min(Math.max(x + k, 0), w - 1);
        acc += src[y * w + sx];
      }
      tmp[y * w + x] = acc / size;
    }
  }
  // Vertical.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const sy = Math.min(Math.max(y + k, 0), h - 1);
        acc += tmp[sy * w + x];
      }
      out[y * w + x] = acc / size;
    }
  }
  return out;
}

/**
 * Smooths the depth grid (3 box-blur passes ≈ Gaussian). Removes the "staircase" and
 * spikes that make the relief look noisy. `radius = 0` returns an unchanged copy.
 */
export function smoothDepth(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(0, Math.round(radius));
  let out: Float32Array = Float32Array.from(src);
  if (r === 0) return out;
  for (let pass = 0; pass < 3; pass++) out = boxBlurPass(out, w, h, r);
  return out;
}

/**
 * Builds the vertex grid used by the relief: `(segments + 1)²` samples, one per vertex of a
 * PlaneGeometry with `segments × segments` quads.
 */
export function buildDepthGrid(
  depth: ArrayLike<number>,
  width: number,
  height: number,
  segments: number,
  smoothRadius: number,
): Float32Array {
  const n = segments + 1;
  return smoothDepth(downsampleDepth(depth, width, height, n, n), n, n, smoothRadius);
}

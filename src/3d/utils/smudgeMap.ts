// Procedural "dirty glass" map: fingerprint-like smears, wipe streaks and fine dust.
// Pure function (no DOM / Three.js) so it is deterministic and testable.

import { createRandom, randomRange } from '../../utils/random';

/**
 * Returns a `size × size` map of smudge strength 0..255 (row 0 = top).
 * 0 = clean glass, 255 = heavily smeared. Same seed → same map.
 */
export function generateSmudgeMap(size: number, seed = 1): Uint8Array {
  const random = createRandom(seed);
  const field = new Float32Array(size * size);

  // Soft blobs (finger / palm prints), mostly in the lower half where people touch glass.
  const blobs = 14;
  for (let b = 0; b < blobs; b++) {
    const cx = randomRange(random, 0.05, 0.95) * size;
    const cy = randomRange(random, 0.35, 0.98) * size;
    const r = randomRange(random, 0.02, 0.08) * size;
    const strength = randomRange(random, 0.25, 0.6);
    stamp(field, size, cx, cy, r, strength);
  }

  // Wipe streaks: long arcs left by a cloth.
  const streaks = 5;
  for (let s = 0; s < streaks; s++) {
    const y0 = randomRange(random, 0.1, 0.9) * size;
    const amp = randomRange(random, 0.02, 0.1) * size;
    const freq = randomRange(random, 1, 3);
    const width = randomRange(random, 0.008, 0.02) * size;
    const strength = randomRange(random, 0.06, 0.16);
    for (let x = 0; x < size; x += Math.max(1, width / 2)) {
      const y = y0 + Math.sin((x / size) * Math.PI * freq) * amp;
      stamp(field, size, x, y, width, strength);
    }
  }

  // Dust speckles.
  const dust = Math.round(size * size * 0.002);
  for (let d = 0; d < dust; d++) {
    const i = Math.floor(random() * size * size);
    field[i] += randomRange(random, 0.2, 0.5);
  }

  const out = new Uint8Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(field[i], 1) * 255);
  return out;
}

/** Adds a smooth radial bump (falls to 0 at radius r). */
function stamp(field: Float32Array, size: number, cx: number, cy: number, r: number, k: number) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(size - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(size - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d >= 1) continue;
      const falloff = 1 - d * d;
      field[y * size + x] += k * falloff * falloff;
    }
  }
}

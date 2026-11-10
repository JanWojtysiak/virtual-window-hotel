import { describe, expect, it } from 'vitest';
import { BACKGROUND_OFFSET, buildReliefLayers } from './reliefLayers';

describe('buildReliefLayers', () => {
  const size = 9;
  // A near square (0.9) in the middle of a far background (0.1).
  const base = new Float32Array(size * size).fill(0.1);
  for (let y = 3; y < 6; y++) for (let x = 3; x < 6; x++) base[y * size + x] = 0.9;
  const colors = new Uint8Array(size * size * 4).fill(200);

  it('returns grids of the expected size', () => {
    const layers = buildReliefLayers(base, size, 0, colors);
    expect(layers.grid).toHaveLength(size * size);
    expect(layers.bgDepth).toHaveLength(size * size);
    expect(layers.bgColors).toHaveLength(size * size * 4);
  });

  it('keeps the front grid unchanged without smoothing', () => {
    const { grid } = buildReliefLayers(base, size, 0, colors);
    expect(Array.from(grid)).toEqual(Array.from(base));
  });

  it('puts the background layer behind the front surface everywhere', () => {
    const { grid, bgDepth } = buildReliefLayers(base, size, 1, colors);
    for (let i = 0; i < grid.length; i++) {
      expect(bgDepth[i]).toBeLessThanOrEqual(grid[i] - BACKGROUND_OFFSET + 1e-6);
    }
  });

  it('does not modify the input grid', () => {
    const copy = Float32Array.from(base);
    buildReliefLayers(base, size, 3, colors);
    expect(Array.from(base)).toEqual(Array.from(copy));
  });
});

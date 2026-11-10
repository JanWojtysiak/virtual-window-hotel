import { describe, expect, it } from 'vitest';
import { buildDepthGrid, downsampleDepth, smoothDepth } from './depthGrid';

describe('downsampleDepth', () => {
  it('averages 2×2 blocks', () => {
    const src = [0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0];
    expect(Array.from(downsampleDepth(src, 4, 4, 2, 2))).toEqual([0.5, 0, 1, 0]);
  });

  it('upsamples by nearest sampling', () => {
    expect(Array.from(downsampleDepth([0, 1], 2, 1, 4, 1))).toEqual([0, 0, 1, 1]);
  });
});

describe('smoothDepth', () => {
  it('returns a copy for radius 0', () => {
    const src = Float32Array.from([0, 1, 0]);
    const out = smoothDepth(src, 3, 1, 0);
    expect(Array.from(out)).toEqual([0, 1, 0]);
    expect(out).not.toBe(src);
  });

  it('keeps a flat map flat', () => {
    const src = new Float32Array(25).fill(0.4);
    for (const v of smoothDepth(src, 5, 5, 2)) expect(v).toBeCloseTo(0.4);
  });

  it('lowers a single spike', () => {
    const src = new Float32Array(25);
    src[12] = 1;
    const out = smoothDepth(src, 5, 5, 1);
    expect(out[12]).toBeLessThan(0.5);
    expect(out[12]).toBeGreaterThan(out[0]);
  });
});

describe('buildDepthGrid', () => {
  it('has one sample per plane vertex', () => {
    const grid = buildDepthGrid(new Float32Array(100 * 50), 100, 50, 8, 1);
    expect(grid.length).toBe(9 * 9);
  });
});

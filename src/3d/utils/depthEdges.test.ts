import { describe, expect, it } from 'vitest';
import {
  buildBackgroundDepth,
  erodeNearness,
  fillBackgroundColors,
  stretchRatio,
} from './depthEdges';

describe('erodeNearness', () => {
  it('returns a copy for radius 0', () => {
    const src = Float32Array.from([0, 1, 0]);
    const out = erodeNearness(src, 3, 1, 0);
    expect(Array.from(out)).toEqual([0, 1, 0]);
    expect(out).not.toBe(src);
  });

  it('removes a near object thinner than the window', () => {
    // 5×5 far background (0.2) with a near 1-cell object (0.9) in the middle.
    const src = new Float32Array(25).fill(0.2);
    src[12] = 0.9;
    for (const v of erodeNearness(src, 5, 5, 1)) expect(v).toBeCloseTo(0.2);
  });

  it('keeps the inside of a large near object', () => {
    const src = new Float32Array(49).fill(0.1);
    for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) src[y * 7 + x] = 0.8;
    const out = erodeNearness(src, 7, 7, 1);
    expect(out[3 * 7 + 3]).toBeCloseTo(0.8); // centre survives
    expect(out[1 * 7 + 1]).toBeCloseTo(0.1); // border is eaten
  });
});

describe('buildBackgroundDepth', () => {
  it('is never in front of the original surface', () => {
    const w = 9;
    const grid = new Float32Array(w * w).map((_, i) => ((i * 37) % 11) / 10);
    const bg = buildBackgroundDepth(grid, w, w, 2, 0.01);
    for (let i = 0; i < grid.length; i++) expect(bg[i]).toBeLessThanOrEqual(grid[i] - 0.01 + 1e-6);
  });

  it('pushes a flat surface back by the offset', () => {
    const grid = new Float32Array(16).fill(0.5);
    for (const v of buildBackgroundDepth(grid, 4, 4, 1, 0.02)) expect(v).toBeCloseTo(0.48);
  });
});

describe('fillBackgroundColors', () => {
  it('fills a near object with the colour of the far background around it', () => {
    const w = 7;
    const n = w * w;
    const depth = new Float32Array(n).fill(0.1);
    const rgba = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) rgba.set([0, 0, 255, 255], i * 4); // blue sky
    // Red near object in the middle.
    depth[24] = 0.9;
    rgba.set([255, 0, 0, 255], 24 * 4);
    const bg = buildBackgroundDepth(depth, w, w, 1, 0);
    const out = fillBackgroundColors(rgba, depth, bg, w, w, 2, 0.1);
    expect(out[24 * 4]).toBeLessThan(5); // almost no red left
    expect(out[24 * 4 + 2]).toBeGreaterThan(250);
    expect(out[24 * 4 + 3]).toBe(255);
  });

  it('keeps a uniform image unchanged', () => {
    const depth = new Float32Array(9).fill(0.5);
    const rgba = new Uint8Array(36);
    for (let i = 0; i < 9; i++) rgba.set([10, 120, 200, 255], i * 4);
    const out = fillBackgroundColors(rgba, depth, depth, 3, 3, 1, 0.1);
    expect(Array.from(out)).toEqual(Array.from(rgba));
  });
});

describe('stretchRatio', () => {
  it('is 1 for a 45° slope', () => {
    // depthScale 1, 256 cells per unit: 1/256 nearness per cell = 1/256 world per cell.
    expect(stretchRatio(1 / 256, 1, 256)).toBeCloseTo(1);
  });

  it('grows with depth scale and ignores the sign', () => {
    expect(stretchRatio(-0.05, 0.35, 256)).toBeCloseTo(0.05 * 0.35 * 256);
  });
});

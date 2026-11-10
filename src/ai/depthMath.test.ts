import { describe, expect, it } from 'vitest';
import { PATCH_SIZE, depthToNearness, modelInputSize } from './depthMath';

describe('modelInputSize', () => {
  it('keeps a square image square', () => {
    expect(modelInputSize(1000, 1000)).toEqual({ width: 504, height: 504 });
  });

  it('keeps aspect ratio and uses multiples of the patch size', () => {
    const { width, height } = modelInputSize(1920, 1080);
    expect(width).toBe(504);
    expect(height % PATCH_SIZE).toBe(0);
    expect(width / height).toBeCloseTo(1920 / 1080, 1);
  });

  it('handles portrait images', () => {
    const { width, height } = modelInputSize(1080, 1920);
    expect(height).toBe(504);
    expect(width).toBeLessThan(height);
  });
});

describe('depthToNearness', () => {
  it('maps closest point to 1 and farthest to 0', () => {
    const out = depthToNearness([1, 2, 10]);
    expect(out[0]).toBeCloseTo(1);
    expect(out[2]).toBeCloseTo(0);
    expect(out[1]).toBeGreaterThan(0);
    expect(out[1]).toBeLessThan(1);
  });

  it('does not produce NaN for flat or zero depth', () => {
    expect(Array.from(depthToNearness([3, 3, 3]))).toEqual([0, 0, 0]);
    expect(depthToNearness([0, 1]).every((v) => Number.isFinite(v))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { dayNight, outdoorHalfExtents, outdoorPlaneScale } from './windowView';
import { generateSmudgeMap } from './smudgeMap';

describe('outdoorHalfExtents', () => {
  it('equals the opening when the plane touches the wall and the viewer is still', () => {
    const r = outdoorHalfExtents({
      openingWidth: 1.2,
      openingHeight: 1.5,
      viewerDistance: 2,
      viewerRangeX: 0,
      viewerRangeY: 0,
      planeDistance: 0,
    });
    expect(r.halfWidth).toBeCloseTo(0.6);
    expect(r.halfHeight).toBeCloseTo(0.75);
  });

  it('grows with plane distance and viewer movement', () => {
    const base = {
      openingWidth: 1.2,
      openingHeight: 1.5,
      viewerDistance: 2,
      viewerRangeX: 0,
      viewerRangeY: 0,
      planeDistance: 4,
    };
    const still = outdoorHalfExtents(base);
    // k = 3 → 0.6 * 3
    expect(still.halfWidth).toBeCloseTo(1.8);
    const moving = outdoorHalfExtents({ ...base, viewerRangeX: 0.4 });
    // -0.4 + (0.6 + 0.4) * 3 = 2.6
    expect(moving.halfWidth).toBeCloseTo(2.6);
  });
});

describe('outdoorPlaneScale', () => {
  it('covers both dimensions', () => {
    const s = outdoorPlaneScale(1.5, 3, 1, 1);
    expect(s * 1.5).toBeGreaterThanOrEqual(6 - 1e-9);
    expect(s).toBeGreaterThanOrEqual(2);
  });
});

describe('dayNight', () => {
  it('interpolates and clamps', () => {
    expect(dayNight(1, 0, 0.25)).toBeCloseTo(0.75);
    expect(dayNight(1, 0, 2)).toBe(0);
    expect(dayNight(1, 0, -1)).toBe(1);
  });
});

describe('generateSmudgeMap', () => {
  it('is deterministic per seed and has some smudges', () => {
    const a = generateSmudgeMap(64, 7);
    const b = generateSmudgeMap(64, 7);
    const c = generateSmudgeMap(64, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(64 * 64);
    const dirty = a.filter((v) => v > 20).length;
    expect(dirty).toBeGreaterThan(64);
    expect(dirty).toBeLessThan(64 * 64);
  });
});

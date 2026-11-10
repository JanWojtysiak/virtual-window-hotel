import { describe, expect, it } from 'vitest';
import { Cloth, windGust, type ClothForces } from './cloth';

const still: ClothForces = { gravity: [0, -9.81, 0], wind: [0, 0, 0], time: 0 };

function makeCloth(extra: Partial<ConstructorParameters<typeof Cloth>[0]> = {}) {
  return new Cloth({ cols: 8, rows: 10, width: 0.7, height: 1.0, origin: [0, 1, 0], ...extra });
}

function run(cloth: Cloth, steps: number, forces: (i: number) => ClothForces) {
  for (let i = 0; i < steps; i++) cloth.step(1 / 60, forces(i));
}

describe('Cloth', () => {
  it('rejects grids smaller than 2×2', () => {
    expect(() => new Cloth({ cols: 1, rows: 4, width: 1, height: 1, origin: [0, 0, 0] })).toThrow();
  });

  it('keeps the pinned top row in place', () => {
    const cloth = makeCloth();
    const top = cloth.positions.slice(0, cloth.cols * 3);
    run(cloth, 120, () => still);
    expect(cloth.positions.slice(0, cloth.cols * 3)).toEqual(top);
  });

  it('hangs without stretching much under gravity', () => {
    const cloth = makeCloth();
    run(cloth, 300, () => still);
    const last = (cloth.rows - 1) * cloth.cols * 3;
    const bottomY = cloth.positions[last + 1];
    // Rest height is 1 m from y = 1 → bottom ≈ 0, allow a few % of stretch.
    expect(bottomY).toBeGreaterThan(-0.06);
    expect(bottomY).toBeLessThan(0.02);
  });

  it('is pushed by the wind', () => {
    const cloth = makeCloth();
    run(cloth, 200, (i) => ({ ...still, wind: [0, 0, 6], time: i / 60 }));
    let meanZ = 0;
    for (let k = 0; k < cloth.particleCount; k++) meanZ += cloth.positions[k * 3 + 2];
    expect(meanZ / cloth.particleCount).toBeGreaterThan(0.05);
  });

  it('never passes through a plane collider', () => {
    const cloth = makeCloth();
    cloth.addCollider({ normal: [0, 0, 1], offset: 0 });
    run(cloth, 200, (i) => ({ ...still, wind: [0, 0, -10], time: i / 60 }));
    for (let k = 0; k < cloth.particleCount; k++) {
      expect(cloth.positions[k * 3 + 2]).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('gathers the top edge but keeps fabric length for folds', () => {
    const cloth = makeCloth({ gather: 0.4, foldDepth: 0.03 });
    const rodWidth = cloth.positions[(cloth.cols - 1) * 3] - cloth.positions[0];
    expect(rodWidth).toBeCloseTo(0.7 * 0.6, 5);
  });

  it('is deterministic', () => {
    const a = makeCloth();
    const b = makeCloth();
    run(a, 50, (i) => ({ ...still, wind: [1, 0, 3], time: i / 60 }));
    run(b, 50, (i) => ({ ...still, wind: [1, 0, 3], time: i / 60 }));
    expect(a.positions).toEqual(b.positions);
  });
});

describe('windGust', () => {
  it('stays in a sane, non-negative range', () => {
    for (let t = 0; t < 60; t += 0.37) {
      const g = windGust(Math.sin(t), Math.cos(t), t);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThan(2);
    }
  });
});

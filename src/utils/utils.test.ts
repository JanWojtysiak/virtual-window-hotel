import { describe, expect, it } from 'vitest';
import { rotate } from './array';
import { formatPrice } from './format';
import { createRandom, randomRange } from './random';

describe('rotate', () => {
  it('moves the first elements to the end', () => {
    expect(rotate([1, 2, 3, 4], 1)).toEqual([2, 3, 4, 1]);
  });

  it('rotates backwards for negative steps', () => {
    expect(rotate([1, 2, 3, 4], -1)).toEqual([4, 1, 2, 3]);
  });

  it('wraps steps larger than the length', () => {
    expect(rotate([1, 2, 3], 4)).toEqual([2, 3, 1]);
  });

  it('does not mutate the input and handles empty arrays', () => {
    const items = [1, 2, 3];
    rotate(items, 1);
    expect(items).toEqual([1, 2, 3]);
    expect(rotate([], 3)).toEqual([]);
  });
});

describe('createRandom', () => {
  it('is deterministic for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs between seeds', () => {
    expect(createRandom(1)()).not.toEqual(createRandom(2)());
  });

  it('stays within [0, 1) and the requested range', () => {
    const random = createRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = randomRange(random, 10, 20);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThan(20);
    }
  });
});

describe('formatPrice', () => {
  it('formats whole PLN amounts', () => {
    expect(formatPrice(420).replace(/\s/g, ' ')).toBe('420 zł');
  });
});

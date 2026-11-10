import { describe, expect, it } from 'vitest';
import { sceneFromParam } from '../2d/views';
import { coverScale } from './cover';

describe('coverScale', () => {
  it('keeps size when proportions match', () => {
    expect(coverScale(1920, 1080, 1920, 1080)).toBe(1);
  });

  it('fills a portrait phone screen by height', () => {
    expect(coverScale(1920, 1080, 390, 844)).toBeCloseTo(844 / 1080);
  });

  it('fills a wide screen by width', () => {
    expect(coverScale(1920, 1080, 3840, 1080)).toBe(2);
  });
});

describe('sceneFromParam', () => {
  it('returns the matching scene', () => {
    expect(sceneFromParam('city').id).toBe('city');
  });

  it('falls back to garden for unknown values', () => {
    expect(sceneFromParam('mars').id).toBe('garden');
    expect(sceneFromParam(null).id).toBe('garden');
  });
});

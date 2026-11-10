import { describe, expect, it } from 'vitest';
import { sectionFromHash, sectionHref, type SectionId } from './navigation';

describe('sectionFromHash', () => {
  it('returns the start screen for an empty or unknown hash', () => {
    expect(sectionFromHash('')).toBe('home');
    expect(sectionFromHash('#')).toBe('home');
    expect(sectionFromHash('#nie-ma-takiej')).toBe('home');
  });

  it('round-trips every section through its link', () => {
    const ids: SectionId[] = ['home', 'rooms-2d', 'rooms-3d', 'create', 'settings'];
    for (const id of ids) {
      expect(sectionFromHash(sectionHref(id))).toBe(id);
    }
  });
});

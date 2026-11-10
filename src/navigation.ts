/** Views of the main page, switched from the sidebar. */
export type SectionId = 'home' | 'rooms-2d' | 'rooms-3d' | 'create' | 'settings';

const SECTION_HASHES: Record<Exclude<SectionId, 'home'>, string> = {
  'rooms-2d': 'pokoje-2d',
  'rooms-3d': 'pokoje-3d',
  create: 'stworz',
  settings: 'ustawienia',
};

/** Link to a section; the start screen is the page without a hash. */
export function sectionHref(id: SectionId): string {
  return id === 'home' ? '#' : `#${SECTION_HASHES[id]}`;
}

/** Maps `location.hash` to a section; unknown hashes fall back to the start screen. */
export function sectionFromHash(hash: string): SectionId {
  const value = decodeURIComponent(hash.replace(/^#/, ''));
  const entry = Object.entries(SECTION_HASHES).find(([, h]) => h === value);
  return entry ? (entry[0] as SectionId) : 'home';
}

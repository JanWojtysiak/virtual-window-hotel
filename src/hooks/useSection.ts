import { useSyncExternalStore } from 'react';
import { sectionFromHash, type SectionId } from '../navigation';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** Current main-page section, kept in the URL hash so links and the back button work. */
export function useSection(): SectionId {
  return useSyncExternalStore(
    subscribe,
    () => sectionFromHash(window.location.hash),
    () => 'home',
  );
}

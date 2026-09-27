'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether a media query matches now (and on every change). On the server — and until hydrated — the
 * `serverValue` (a layout that differs by width still gets its CSS right from the first paint; this is
 * for what CSS can't do, like which items a menu holds).
 */
export function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
    () => serverValue,
  );
}

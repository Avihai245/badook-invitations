'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

/**
 * A list's filters live in the address (a link to a filtered list works, and back goes back): set
 * some, drop the empty ones, and go back to the first page unless the page is what changed. The page
 * reads again on the server; `pending` while it does.
 */
export function useQueryUpdater(): {
  set(changes: Record<string, string | null | undefined>): void;
  params: URLSearchParams;
  pending: boolean;
} {
  const router = useRouter();
  const path = usePathname();
  const current = useSearchParams();
  const [pending, start] = useTransition();
  const set = useCallback(
    (changes: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(current.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (!('page' in changes)) next.delete('page');
      const query = next.toString();
      start(() => router.replace(query ? `${path}?${query}` : path, { scroll: false }));
    },
    [current, path, router],
  );
  return { set, params: new URLSearchParams(current.toString()), pending };
}

'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps a guest's table guide on their phone for the evening (a hall's basement often has no signal):
 * a service worker (/e/table-sw.js, scoped to this guide's address) is given the page, its scripts,
 * styles and fonts and the floor plan to keep; afterwards the page opens from the phone when the
 * network doesn't answer. 'saved' once kept; 'offline' while the phone has no connection.
 */

export type OfflineState = 'idle' | 'saving' | 'saved' | 'offline' | 'unsupported';

/** What the page needs again: itself, the files it loaded from this site, and the plan. */
function pageFiles(extra: readonly string[]): string[] {
  const own = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((url) => {
      try {
        const u = new URL(url);
        return u.origin === location.origin && !u.pathname.startsWith('/api/');
      } catch {
        return false;
      }
    });
  return [...new Set([location.href, ...own, ...extra])];
}

export function useOfflineSave(slug: string, extra: readonly string[]): OfflineState {
  const [state, setState] = useState<OfflineState>('idle');
  const key = extra.join('|');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      setState('unsupported');
      return;
    }
    let live = true;
    const onOffline = () => live && setState('offline');
    const onOnline = () => live && setState('saved');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (!navigator.onLine) setState('offline');
    void (async () => {
      try {
        await navigator.serviceWorker.register('/e/table-sw.js', { scope: `/e/${slug}/table` });
        const reg = await navigator.serviceWorker.ready;
        if (!live || !navigator.onLine) return;
        setState('saving');
        // after the page has loaded everything it shows
        await new Promise((r) => setTimeout(r, 800));
        const worker = reg.active;
        if (!worker) return;
        const channel = new MessageChannel();
        const done = new Promise<boolean>((resolve) => {
          channel.port1.onmessage = (e) => resolve(!!(e.data as { ok?: boolean } | null)?.ok);
          setTimeout(() => resolve(false), 20_000);
        });
        worker.postMessage({ type: 'save', urls: pageFiles(extra) }, [channel.port2]);
        if (live) setState((await done) ? 'saved' : 'idle');
      } catch {
        if (live) setState('unsupported');
      }
    })();
    return () => {
      live = false;
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
    // `key` stands for `extra`'s content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, key]);

  return state;
}

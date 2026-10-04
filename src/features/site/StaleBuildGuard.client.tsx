'use client';

import { useEffect } from 'react';
import { isStaleBuildError, reloadForNewBuild } from '@/lib/stale-build';

const BUILD = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? null;
/** how often a visible tab asks again (it also asks each time it comes back to the front) */
const CHECK_MS = 10 * 60_000;

/**
 * Keeps a long-open tab working across deployments. When the tab comes back to the front it asks which
 * build is running; after a new deployment the next link click is a full page load (the new build's
 * code) instead of a client navigation into code that's gone. And an error that can only mean a gone
 * build (a missing chunk, an unknown server action) reloads the page once; any other error doesn't.
 */
export function StaleBuildGuard() {
  useEffect(() => {
    let stale = false;
    let asking = false;
    const ask = async () => {
      if (stale || asking || !BUILD || document.visibilityState !== 'visible') return;
      asking = true;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as { commit?: string | null } | null;
        if (res.ok && body?.commit && body.commit !== BUILD) stale = true;
      } catch {
        // offline: ask again later
      } finally {
        asking = false;
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!stale || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(url.href);
    };
    const onError = (e: ErrorEvent) => {
      if (isStaleBuildError(e.error ?? e.message)) reloadForNewBuild();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleBuildError(e.reason)) reloadForNewBuild();
    };
    const onVisible = () => void ask();
    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    const timer = window.setInterval(() => void ask(), CHECK_MS);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}

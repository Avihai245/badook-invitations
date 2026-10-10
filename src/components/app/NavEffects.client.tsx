'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * What every move between the app's screens does, whatever started it:
 * - the new screen starts at its top (the router keeps the window's scroll when the next screen's top
 *   is already on screen, or while a loading skeleton stands in) — not for a hash, nor for a change of
 *   the query alone (a tab, a dialog's ?param);
 * - a thin bar at the top of the window the moment an internal link is clicked, until the next screen
 *   is there, so a click always shows it was heard (a server-rendered screen can take a moment).
 */
export function NavEffects() {
  const path = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const first = useRef(true);
  const timer = useRef<number | null>(null);

  // a new screen: at its top, and the bar done
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [path]);
  useEffect(() => {
    setBusy(false);
    if (timer.current) window.clearTimeout(timer.current);
  }, [path, search]);

  // an internal link clicked (the plain way: no new tab, no download, no modifier key)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setBusy(true);
      if (timer.current) window.clearTimeout(timer.current);
      // never stuck: a navigation that went nowhere (an error page, a cancelled click)
      timer.current = window.setTimeout(() => setBusy(false), 12_000);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div
      aria-hidden
      data-testid="nav-progress"
      data-busy={busy || undefined}
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[90] h-[3px]"
    >
      <span className="block h-full bg-brand" />
    </div>
  );
}

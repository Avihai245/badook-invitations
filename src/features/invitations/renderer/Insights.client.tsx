'use client';

import { useEffect } from 'react';
import { INSIGHTS } from '@/features/insights/config';

/** Global Privacy Control or Do Not Track: the beacon isn't even fetched. */
function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === '1' ||
    nav.doNotTrack === 'yes' ||
    nav.msDoNotTrack === '1' ||
    win.doNotTrack === '1'
  );
}

/**
 * How guests use the invitation (feature `analytics`, features/insights): mounted on the live page only
 * when the event has the feature. It renders nothing and changes nothing in the cached page — after the
 * page is interactive and the browser is idle it fetches the small beacon module, which measures this
 * page load in memory and sends it now and then. No cookies, nothing kept on the device, and nothing
 * at all under Global Privacy Control or Do Not Track.
 */
export function Insights({ slug }: { slug: string }) {
  useEffect(() => {
    if (privacySignal()) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    const begin = () => {
      const idle =
        window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1) as unknown as number);
      idle(
        () => {
          if (cancelled) return;
          import('@/features/insights/client/beacon')
            .then((m) => {
              if (!cancelled) stop = m.startBeacon({ slug });
            })
            .catch(() => undefined);
        },
        { timeout: 5_000 },
      );
    };
    const timer = window.setTimeout(() => {
      if (document.readyState === 'complete') begin();
      else window.addEventListener('load', begin, { once: true });
    }, INSIGHTS.beacon.startAfterMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('load', begin);
      stop?.();
    };
  }, [slug]);
  return null;
}

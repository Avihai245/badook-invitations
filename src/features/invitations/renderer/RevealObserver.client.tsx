'use client';

import { useEffect } from 'react';

/**
 * Section reveal (§2.2 Global): every `.reveal` element fades/rises in once when 20% of it is in
 * view. One observer for the whole page; new nodes (e.g. RSVP cards) are picked up automatically.
 * Very tall elements count as visible once 20% of the viewport is covered.
 */
export function RevealObserver() {
  useEffect(() => {
    // the page is interactive from here on (tests wait for it before clicking controls)
    document.documentElement.dataset.hydrated = '1';
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.intersectionRatio >= 0.2 || e.intersectionRect.height >= window.innerHeight * 0.2) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: [0, 0.2, 0.5] },
    );
    const scan = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}

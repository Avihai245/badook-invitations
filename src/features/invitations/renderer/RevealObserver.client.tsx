'use client';

import { useEffect } from 'react';

/** What reveals on scroll: sections' blocks, and the dividers and decorations that draw themselves in. */
export const REVEALED = '.reveal:not(.in), .divider:not(.in), .deco:not(.in)';

/**
 * Section reveal (§2.2 Global): every `.reveal` element fades/rises in once when 20% of it is in
 * view (a divider draws itself, a decoration rises — invitation.css). One observer for the whole
 * page; new nodes (e.g. RSVP cards) are picked up automatically. Very tall elements count as visible
 * once 20% of the viewport is covered.
 */
export function RevealObserver() {
  useEffect(() => {
    // the page is interactive from here on (tests wait for it before clicking controls)
    document.documentElement.dataset.hydrated = '1';
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // a 1px divider is either in or out: any intersection counts
          if (
            e.intersectionRatio >= 0.2 ||
            e.intersectionRect.height >= window.innerHeight * 0.2 ||
            e.target.classList.contains('divider')
          ) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: [0, 0.2, 0.5] },
    );
    const scan = () => document.querySelectorAll(REVEALED).forEach((el) => io.observe(el));
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

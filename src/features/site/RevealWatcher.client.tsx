'use client';

import { useEffect } from 'react';

let observer: IntersectionObserver | null = null;
/** Blocks the observer has already classified (the first answer it gives for each). */
const classified = new WeakSet<Element>();

/**
 * One observer for every revealed block on the page. Its first answer for a block says where the block
 * is when the page loads — from the geometry the browser computes anyway for the observer, with no
 * synchronous layout read (a `getBoundingClientRect` per block forced the whole page to be laid out,
 * the sections the browser skips (`content-visibility`) included, in the middle of hydration):
 * - above the line (the viewport's top 92%): on screen already — it stays as it is, no flash of
 *   hidden content;
 * - below it, or in a section the browser has not laid out yet (no box): hidden (`data-reveal`) until
 *   it scrolls in, then shown once (`data-shown`) and let go.
 */
export function watchReveal(el: Element) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const block = entry.target as HTMLElement;
        if (!classified.has(block)) {
          classified.add(block);
          const { top, width, height } = entry.boundingClientRect;
          const line = entry.rootBounds?.bottom ?? window.innerHeight * 0.92;
          if ((width > 0 || height > 0) && top < line) {
            // on screen already: nothing to reveal
            observer?.unobserve(block);
          } else {
            block.dataset.reveal = '';
          }
          continue;
        }
        if (!entry.isIntersecting) continue;
        block.dataset.shown = '';
        observer?.unobserve(block);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  observer.observe(el);
  return () => observer?.unobserve(el);
}

/** Watches every `.reveal` block of the page (Reveal.tsx). Once per page. */
export function RevealWatcher() {
  useEffect(() => {
    const stops = [...document.querySelectorAll('.reveal')].map(watchReveal);
    return () => {
      for (const stop of stops) stop();
    };
  }, []);
  return null;
}

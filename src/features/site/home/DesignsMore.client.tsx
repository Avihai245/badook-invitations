'use client';

import { useEffect } from 'react';
import { observePosters } from '@/features/invitations/app/PosterArtLoader.client';
import { watchReveal } from '../RevealWatcher.client';

/**
 * The rest of the home page's designs: the grid's HTML carries the first few, and this adds the others
 * — one pre-rendered fragment of cards (scripts/build-poster-art.tsx, versioned and cached for good) — as
 * the section comes within a screen and a half of the viewport, still below it, so nothing on screen
 * moves. Not in the page, they weigh nothing in its HTML, its payload or its hydration.
 */
export function DesignsMore({ url }: { url: string }) {
  useEffect(() => {
    const section = document.getElementById('designs');
    const grid = document.getElementById('designs-grid');
    if (!section || !grid) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void fetch(url)
          .then((res) => (res.ok ? res.text() : ''))
          .then((html) => {
            if (!html) return;
            const before = grid.children.length;
            // markup this build rendered from its own designs (a same-origin static file)
            grid.insertAdjacentHTML('beforeend', html);
            for (const card of [...grid.children].slice(before)) watchReveal(card);
            observePosters(grid);
          })
          .catch(() => undefined);
      },
      { rootMargin: '150% 0px' },
    );
    io.observe(section);
    return () => io.disconnect();
  }, [url]);
  return null;
}

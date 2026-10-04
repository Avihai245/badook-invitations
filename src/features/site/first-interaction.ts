'use client';

import { useEffect, useState } from 'react';

const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

let engaged = false;
const waiting = new Set<() => void>();

function engage() {
  if (engaged) return;
  engaged = true;
  for (const type of EVENTS) window.removeEventListener(type, engage, true);
  for (const done of waiting) done();
  waiting.clear();
}

/**
 * True once the visitor has done anything on the page (moved the pointer, touched, scrolled, typed):
 * the heavy extras — a YouTube player, a looping video — wait for it instead of competing with the
 * first paint, and a page nobody touches (a crawler, a link preview, a speed test) never loads them.
 */
export function useFirstInteraction(): boolean {
  const [now, setNow] = useState(engaged);
  useEffect(() => {
    if (engaged) return setNow(true);
    if (!waiting.size)
      for (const type of EVENTS) window.addEventListener(type, engage, { capture: true, passive: true });
    const done = () => setNow(true);
    waiting.add(done);
    return () => {
      waiting.delete(done);
    };
  }, []);
  return now;
}

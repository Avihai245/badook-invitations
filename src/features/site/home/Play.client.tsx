'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/components/app';

/**
 * A scene whose animations run only while it is on screen (site-home.css `.hs:not([data-play])`
 * pauses them): the home page has a dozen looping scenes, and only the visible ones should cost
 * anything.
 */
export function Play({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) el.dataset.play = '';
        else delete el.dataset.play;
      },
      { rootMargin: '60px' },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden className={cn('hs', className)}>
      {children}
    </div>
  );
}

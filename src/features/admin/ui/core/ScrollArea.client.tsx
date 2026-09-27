'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/components/app';

/**
 * A wide table's own scroll box on a narrow screen (the page itself never scrolls sideways): named for
 * screen readers, and a tab stop while it actually scrolls, so a keyboard can scroll it too. Positioned,
 * so what is inside it (a table's visually hidden caption) stays inside it. A `DataTable` inside it
 * leaves the scrolling to it (the table's own box, its direct child, stays open).
 */
export function ScrollArea({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // what it holds grows and shrinks with the data (a DataTable's own box keeps its width: its table)
    for (const child of Array.from(el.querySelectorAll(':scope > *, table'))) observer.observe(child);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      role="region"
      aria-label={label}
      tabIndex={scrolls ? 0 : undefined}
      className={cn(
        'relative overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        '[&>div]:overflow-visible',
        className,
      )}
    >
      {children}
    </div>
  );
}

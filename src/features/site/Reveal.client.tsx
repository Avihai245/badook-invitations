'use client';

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { cn } from '@/components/app';

let observer: IntersectionObserver | null = null;

/** One observer for every revealed block on the page: each is shown once, the first time it scrolls in. */
function watch(el: Element) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.shown = '';
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  observer.observe(el);
  return () => observer?.unobserve(el);
}

let pending: HTMLElement[] = [];

/**
 * The blocks mounted in one commit, placed together: every position is read first and only then are
 * the off-screen ones hidden — one layout for the whole page instead of one per block (a read after
 * each write forces the browser to lay the page out again).
 */
function place(el: HTMLElement) {
  pending.push(el);
  if (pending.length > 1) return;
  queueMicrotask(() => {
    const batch = pending;
    pending = [];
    const fold = window.innerHeight * 0.92;
    // already on screen when the page loads: shown as is (no flash of hidden content)
    const below = batch.filter((block) => block.isConnected && block.getBoundingClientRect().top >= fold);
    for (const block of below) {
      block.dataset.reveal = '';
      watch(block);
    }
  });
}

/**
 * Fades and lifts its content in as it scrolls into view (site.css `.reveal`), after `delay` ms —
 * staggered lists pass increasing delays. Without JavaScript, or with reduced motion, it is simply there.
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    place(el);
    return () => {
      pending = pending.filter((block) => block !== el);
      observer?.unobserve(el);
    };
  }, []);
  return (
    <Tag
      ref={ref}
      className={cn('reveal', className)}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

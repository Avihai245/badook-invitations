'use client';

import { useEffect, useRef, useState } from 'react';

const reduced = () =>
  typeof window === 'undefined' ||
  typeof window.matchMedia !== 'function' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts up to its value when it appears (and moves to a new value when it changes) —
 * ~0.9s, easing out; at once for reduced motion. The server renders the final value (no flash of 0 for
 * a reader without JavaScript); `format` writes it (digits and separators of the screen's language).
 */
export function CountUp({
  value,
  format = (n) => String(n),
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

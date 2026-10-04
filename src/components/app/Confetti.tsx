'use client';

import { useEffect, useRef } from 'react';

const COLORS = ['#a0703f', '#e7a977', '#c2557a', '#f6c344', '#15803d', '#ffffff'];

/**
 * A short, gentle burst of confetti over the page (a finished stage of the event): ~1.6s on a canvas
 * that takes no clicks and is hidden from screen readers. Nothing at all under reduced motion. `fire`
 * changes → one burst.
 */
export function Confetti({ fire }: { fire: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = window.innerWidth * dpr;
    el.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = window.innerWidth;
    const pieces = Array.from({ length: 90 }, (_, i) => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -6 - Math.random() * 8,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: 5 + Math.random() * 6,
      c: COLORS[i % COLORS.length]!,
    }));
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, window.innerHeight);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1000) / 600);
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 1600) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, window.innerHeight);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [fire]);
  return (
    <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />
  );
}

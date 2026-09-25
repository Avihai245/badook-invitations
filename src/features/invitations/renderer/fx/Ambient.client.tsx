'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AmbientKind } from '../../contracts/types';
import { motionAllowed, particleBudget, saveData, seeded } from './motion';
import { BALLOON_STRING, SHAPES, type ShapeId } from './shapes';

type Motion = 'fall' | 'rise' | 'twinkle' | 'drift' | 'ember';

interface Spec {
  motion: Motion;
  shapes: readonly ShapeId[];
  /** particles on a phone / elsewhere (particleBudget caps them: ≤ 24 on a phone) */
  count: readonly [number, number];
  /** px */
  size: readonly [number, number];
  /** one crossing / one twinkle, s */
  dur: readonly [number, number];
  /** peak opacity */
  opacity: readonly [number, number];
  /** sideways sway, cqw */
  sway?: readonly [number, number];
  /** twinkles stay in the top part of the hero (a night sky), % */
  maxY?: number;
}

export const AMBIENT: Record<Exclude<AmbientKind, 'none'>, Spec> = {
  petals: {
    motion: 'fall',
    shapes: ['petal', 'petal2'],
    count: [11, 16],
    size: [12, 21],
    dur: [12, 19],
    opacity: [0.6, 0.92],
    sway: [3, 8],
  },
  leaves: {
    motion: 'fall',
    shapes: ['leaf', 'leaf2'],
    count: [10, 15],
    size: [14, 23],
    dur: [12, 19],
    opacity: [0.65, 0.92],
    sway: [3, 9],
  },
  confetti: {
    motion: 'fall',
    shapes: ['rect', 'rect', 'circle', 'tri', 'squiggle'],
    count: [15, 22],
    size: [7, 12],
    dur: [8, 13],
    opacity: [0.75, 1],
    sway: [2, 6],
  },
  sparkles: {
    motion: 'twinkle',
    shapes: ['sparkle', 'sparkle', 'dot'],
    count: [13, 19],
    size: [8, 19],
    dur: [2.8, 5],
    opacity: [0.7, 1],
  },
  stars: {
    motion: 'twinkle',
    shapes: ['sparkle', 'dot', 'dot', 'star'],
    count: [18, 24],
    size: [4, 13],
    dur: [2.6, 5.2],
    opacity: [0.6, 1],
    maxY: 46,
  },
  bubbles: {
    motion: 'rise',
    shapes: ['bubble'],
    count: [11, 16],
    size: [10, 30],
    dur: [10, 16],
    opacity: [0.55, 0.9],
    sway: [2, 6],
  },
  balloons: {
    motion: 'rise',
    shapes: ['balloon'],
    count: [6, 8],
    size: [26, 42],
    dur: [17, 25],
    opacity: [0.85, 1],
    sway: [2, 5],
  },
  hearts: {
    motion: 'rise',
    shapes: ['heart'],
    count: [10, 14],
    size: [10, 20],
    dur: [11, 17],
    opacity: [0.5, 0.85],
    sway: [2, 6],
  },
  fireflies: {
    motion: 'drift',
    shapes: ['dot'],
    count: [13, 18],
    size: [14, 26],
    dur: [9, 15],
    opacity: [0.7, 1],
  },
  embers: {
    motion: 'ember',
    shapes: ['dot'],
    count: [15, 20],
    size: [8, 14],
    dur: [4.5, 7.5],
    opacity: [0.8, 1],
    sway: [2, 5],
  },
  notes: {
    motion: 'rise',
    shapes: ['note', 'note2'],
    count: [8, 12],
    size: [14, 23],
    dur: [12, 18],
    opacity: [0.55, 0.9],
    sway: [2, 6],
  },
  pixels: {
    motion: 'twinkle',
    shapes: ['pixel', 'plus', 'pixel'],
    count: [14, 20],
    size: [6, 12],
    dur: [2.4, 4.2],
    opacity: [0.75, 1],
  },
};

interface Particle {
  key: number;
  shape: ShapeId;
  style: CSSProperties;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Particles spread evenly (one per column, jittered) with deterministic sizes, speeds and phases; the
 * negative delays put them mid-flight from the first frame. Twinkles stay off the names in the middle.
 */
function makeParticles(kind: Exclude<AmbientKind, 'none'>, colors: string[], seed: string, n: number) {
  const spec = AMBIENT[kind];
  const rnd = seeded(`${seed}:${kind}`);
  const r = (min: number, max: number) => min + rnd() * (max - min);
  const list: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const dur = r(spec.dur[0], spec.dur[1]);
    const size = r(spec.size[0], spec.size[1]);
    const shape = spec.shapes[Math.floor(rnd() * spec.shapes.length)]!;
    let x = ((i + r(0.1, 0.9)) / n) * 100;
    let y = r(4, spec.maxY ?? 94);
    if (spec.motion === 'twinkle' || spec.motion === 'drift') {
      // keep the middle (eyebrow → date) calm: re-roll a point that lands on the text block
      for (let tries = 0; tries < 6 && x > 20 && x < 80 && y > 24 && y < 76; tries++) {
        x = r(2, 98);
        y = r(4, spec.maxY ?? 94);
      }
    }
    const style: Record<string, string | number> = {
      '--x': `${round(x - 2)}%`,
      '--y': `${round(y)}%`,
      '--s': `${round(size, 1)}px`,
      '--d': `${round(dur)}s`,
      // spread along the cycle: already on the way at the first frame
      '--dl': `${round(-r(0, dur))}s`,
      '--o': round(r(spec.opacity[0], spec.opacity[1])),
      '--c': colors[i % colors.length]!,
      '--sw': `${round(r(spec.sway?.[0] ?? 2, spec.sway?.[1] ?? 5), 1)}cqw`,
      '--sd': `${round(r(2.4, 4.6))}s`,
      '--rd': `${round(r(3.2, 7.5))}s`,
      '--r': `${Math.round(r(0, 360))}deg`,
      '--ax': round(r(0.2, 1)),
      '--ay': round(r(0.2, 1)),
      '--dx': `${round(r(-9, 9), 1)}cqmin`,
      '--dy': `${round(r(-7, 7), 1)}cqmin`,
      '--dx2': `${round(r(-9, 9), 1)}cqmin`,
      '--dy2': `${round(r(-7, 7), 1)}cqmin`,
    };
    list.push({ key: i, shape, style: style as CSSProperties });
  }
  return list;
}

function Glyph({ shape }: { shape: ShapeId }) {
  const s = SHAPES[shape] as (typeof SHAPES)[ShapeId] & {
    stroke?: number;
    detail?: { d: string; stroke: number; color?: 'light' | 'same'; opacity: number };
    h?: number;
  };
  const h = s.h ?? 24;
  return (
    <svg viewBox={`0 0 24 ${h}`} aria-hidden="true" focusable="false">
      {shape === 'balloon' ? (
        <path d={BALLOON_STRING} fill="none" stroke="rgba(120,110,100,.5)" strokeWidth=".8" />
      ) : null}
      {s.stroke ? (
        <path
          d={s.d}
          fill={shape === 'bubble' ? 'currentColor' : 'none'}
          fillOpacity={shape === 'bubble' ? 0.12 : undefined}
          stroke="currentColor"
          strokeWidth={s.stroke}
          strokeLinecap="round"
        />
      ) : (
        <path d={s.d} fill="currentColor" />
      )}
      {s.detail ? (
        <path
          d={s.detail.d}
          fill="none"
          stroke={s.detail.color === 'light' ? '#fff' : 'currentColor'}
          strokeWidth={s.detail.stroke}
          strokeLinecap="round"
          opacity={s.detail.opacity}
        />
      ) : null}
    </svg>
  );
}

/**
 * The hero's ambient particles (`motion.ambient`, renderer/fx/theme.ts): drifting petals, falling
 * confetti, twinkling stars… Purely decorative (aria-hidden, click-through), CSS-animated with
 * transform/opacity only, at most 24 on a phone. Rendered in the browser only — after the cover opens
 * (nothing on the server, so hydration is untouched) — never with reduced motion or Save-Data, and
 * paused while the hero is off screen or the tab is hidden.
 */
export function Ambient({
  kind,
  colors,
  seed,
  delay = 1300,
}: {
  kind: AmbientKind;
  colors: string[];
  /** stable per invitation (the same particles on every render) */
  seed: string;
  /** after the cover opens (or the page shows opened), ms */
  delay?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const tone = colors.join(',');

  useEffect(() => {
    if (kind === 'none' || !tone) return;
    if (!motionAllowed() || saveData()) return;
    const spec = AMBIENT[kind];
    let timer = 0;
    const start = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCount(particleBudget(spec.count[0], spec.count[1])), ms);
    };
    const root = document.documentElement.dataset;
    // the live language switch re-renders the hero: its particles come back at once
    if (root.opened) start(root.localeSwitched ? 0 : Math.max(300, delay - 500));
    const onOpen = () => start(delay);
    window.addEventListener('invitation:open', onOpen);
    // the guest turns reduced motion on meanwhile: the layer goes
    let mq: MediaQueryList | null = null;
    const onChange = () => {
      if (mq?.matches) setCount(0);
    };
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener?.('change', onChange);
    } catch {
      mq = null;
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('invitation:open', onOpen);
      mq?.removeEventListener?.('change', onChange);
    };
  }, [kind, tone, delay]);

  // pause while off screen (IntersectionObserver) or while the tab is hidden
  useEffect(() => {
    const el = ref.current;
    if (!count || !el) return;
    let visible = true;
    const apply = () => {
      if (visible && !document.hidden) delete el.dataset.paused;
      else el.dataset.paused = '';
    };
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            apply();
          });
    io?.observe(el);
    document.addEventListener('visibilitychange', apply);
    apply();
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, [count]);

  const particles = useMemo(
    () => (count && kind !== 'none' && tone ? makeParticles(kind, tone.split(','), seed, count) : []),
    [count, kind, tone, seed],
  );
  if (!particles.length || kind === 'none') return null;
  const spec = AMBIENT[kind];
  const glow = spec.motion === 'drift' || spec.motion === 'ember';
  return (
    <div ref={ref} className="fx-amb" data-kind={kind} data-motion={spec.motion} aria-hidden="true">
      {particles.map((p) => (
        <i key={p.key} style={p.style}>
          <i>{glow ? <b /> : <Glyph shape={p.shape} />}</i>
        </i>
      ))}
      {kind === 'stars' ? <i className="fx-shoot" /> : null}
    </div>
  );
}

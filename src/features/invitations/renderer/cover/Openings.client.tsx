'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Locale } from '../../contracts/types';
import { visibleGlyphCount } from '../../lib/text';
import { seeded } from '../fx/motion';
import { fireworks, goldDust } from '../fx/sparks';
import type { Opening } from './opening';
import { announceOpen, reducedMotion, useOpening, type PhaseProps } from './phase';

export interface CinematicCoverProps extends PhaseProps {
  locale: Locale;
  opening: Opening;
  monogram: string;
  hint: string;
  skipLabel: string;
  scrollLabel?: string;
  /** the template's burst colors (renderer/fx/theme.ts): the fireworks' */
  fx?: { colors: string[] } | null;
  /**
   * A photo-led opening (`opening.backdrop`): the hero's picture under the night sky or the veil —
   * the same image set as the hero's, so the page fetches it once and the hand-off is seamless.
   */
  backdrop?: CoverBackdrop | null;
}

/** The hero's still as the cover shows it (renderer/images.ts imageSet at 100vw + its focal point). */
export interface CoverBackdrop {
  src: string;
  srcSet?: string;
  sizes?: string;
  fallback?: string;
  /** CSS object-position */
  position: string;
}

/** How far a wheel / a swipe goes before the doors or the curtain open by themselves. */
const WHEEL_TO_OPEN = 260;
const SWIPE_TO_OPEN = 150;

/**
 * The cinematic openings (v2 — feature `cinematic`; the template's cover.opening or the host's
 * choice): a gate of two doors that swing or slide open, a theatre curtain that parts or rises,
 * fireworks bursting over a night sky, a veil of gold dust blown away. CSS and SVG, and a small canvas
 * for the light (fx/sparks.ts). The gate and the curtain also open by scrolling or swiping — they
 * follow the finger / the wheel a little, then open (a swipe's lift is a gesture, so the music may
 * start in it; a wheel isn't, so the music button asks for its tap). With reduced motion: a plain
 * fade. Like the classic cover, one big button (tap, Enter, Space) with a Skip beside it, and the
 * monogram is real text — the page's first paint shows it (its LCP).
 */
export function CinematicCover({
  opening,
  monogram,
  hint,
  skipLabel,
  scrollLabel,
  fx,
  backdrop = null,
  phase,
  setPhase,
  showSkip,
  finish,
  later,
}: CinematicCoverProps) {
  const root = useRef<HTMLDivElement>(null);
  const { preset } = opening;
  const photo = opening.backdrop ? backdrop : null;

  const open = useOpening((skip: boolean) => {
    announceOpen();
    if (skip || reducedMotion()) {
      finish(skip ? 850 : 300);
      return;
    }
    setPhase('opening');
    const colors = [opening.gold, '#FFF1C9', opening.light, ...(fx?.colors ?? []).slice(0, 3)];
    switch (preset) {
      case 'gate':
      case 'curtain':
        // the invitation starts coming in as the doors / the curtain open, then the cover goes
        later(() => finish(900), preset === 'gate' ? 820 : 760);
        break;
      case 'fireworks':
        fireworks(fx?.colors.length ? [...fx.colors.slice(0, 4), opening.gold] : colors);
        later(() => finish(1000), 1250);
        break;
      case 'gold_dust': {
        const r = root.current?.querySelector('.co-mono')?.getBoundingClientRect();
        goldDust(
          [opening.gold, '#F6E3A6', '#FFF4D2', '#E9C46A'],
          r ? r.left + r.width / 2 : window.innerWidth / 2,
          r ? r.top + r.height / 2 : window.innerHeight / 2,
        );
        later(() => finish(900), 700);
        break;
      }
    }
  });

  // `open` changes on every render (the cover re-renders, e.g. when Skip appears): the listeners
  // below read the latest one, so a render never restarts a scroll that is already under way
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // scroll (or swipe) to enter: the doors / the curtain follow a little, then open
  useEffect(() => {
    const el = root.current;
    if (!el || !opening.scroll || phase !== 'idle') return;
    let wheel = 0;
    let startY: number | null = null;
    let peek = 0;
    let relax = 0;
    const show = (p: number) => {
      peek = Math.max(0, Math.min(1, p));
      el.style.setProperty('--co-peek', peek.toFixed(3));
    };
    const settle = () => {
      window.clearTimeout(relax);
      relax = window.setTimeout(() => {
        wheel = 0;
        show(0);
      }, 700);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY <= 0) return;
      wheel += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      show(wheel / WHEEL_TO_OPEN);
      if (peek >= 1) openRef.current(false);
      else settle();
    };
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY === null) return;
      e.preventDefault();
      show((startY - (e.touches[0]?.clientY ?? startY)) / SWIPE_TO_OPEN);
    };
    // the finger lifts: a gesture (the music may start in it) — past halfway, it opens
    const onTouchEnd = () => {
      if (startY === null) return;
      startY = null;
      if (peek >= 0.5) openRef.current(false);
      else show(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        openRef.current(false);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(relax);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [opening.scroll, phase]);

  const cls = ['cover', 'co', phase !== 'idle' ? 'opening' : '', phase === 'gone' ? 'gone' : '']
    .filter(Boolean)
    .join(' ');
  const style = {
    '--co-color': opening.color,
    '--co-light': opening.light,
    '--co-deep': opening.deep,
    '--co-gold': opening.gold,
    // a longer monogram (a name and an age: "DANA 30") sets smaller on the medal and the crest
    '--co-glyphs': Math.max(3, visibleGlyphCount(monogram)),
  } as CSSProperties;
  const mono = monogram ? <span className="co-mono">{monogram}</span> : null;

  let art: ReactNode;
  switch (preset) {
    case 'gate':
      art = (
        <>
          <span className="co-glow" aria-hidden="true" />
          {(['l', 'r'] as const).map((side) => (
            <span key={side} className={`co-door ${side}`} aria-hidden="true">
              <span className="co-panel top" />
              <span className="co-panel bottom" />
              <span className="co-ring" />
              <span className="co-medal">{mono}</span>
            </span>
          ))}
        </>
      );
      break;
    case 'curtain':
      art = (
        <>
          <span className="co-glow" aria-hidden="true" />
          <span className="co-drape l" aria-hidden="true" />
          <span className="co-drape r" aria-hidden="true" />
          <span className="co-valance" aria-hidden="true">
            <span className="co-crest">{mono}</span>
          </span>
        </>
      );
      break;
    case 'fireworks':
      art = (
        <>
          <Specks className="co-stars" count={34} seed="stars" top={0.04} bottom={0.7} />
          <span className="co-center" aria-hidden="true">
            {mono}
          </span>
        </>
      );
      break;
    case 'gold_dust':
      art = (
        <>
          <span className="co-veil" aria-hidden="true" />
          <Specks className="co-motes" count={26} seed="motes" top={0.12} bottom={0.9} />
          <span className="co-center" aria-hidden="true">
            {mono}
          </span>
        </>
      );
      break;
  }

  return (
    <div
      ref={root}
      className={cls}
      data-opening={preset}
      data-motion={opening.motion ?? undefined}
      data-scroll={opening.scroll ? '' : undefined}
      data-backdrop={photo ? '' : undefined}
      style={style}
    >
      <button
        type="button"
        className="cover-tap"
        aria-label={hint}
        onClick={() => open(false)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            open(false);
          }
        }}
      >
        {photo ? (
          // the invitation's first picture, at the scale the hero's settle starts from (invitation.css)
          <img
            className="co-photo"
            src={photo.src}
            srcSet={photo.srcSet}
            sizes={photo.sizes}
            data-fallback={photo.fallback}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            draggable={false}
            style={{ objectPosition: photo.position }}
            // the error fallback (images.ts) may swap it for the original before React hydrates
            suppressHydrationWarning
          />
        ) : null}
        {art}
        <span className="cover-hint" aria-hidden="true">
          {hint}
        </span>
        {opening.scroll && scrollLabel ? (
          <span className="co-scroll" aria-hidden="true">
            {scrollLabel}
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
      </button>
      {showSkip && phase === 'idle' ? (
        <button type="button" className="cover-skip" onClick={() => open(true)}>
          {skipLabel}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Twinkling points (a night sky's stars, gold motes), placed by a seeded generator — the same on the
 * server and in the browser — and kept off the middle, where the monogram is. CSS only (transform and
 * opacity); still with reduced motion.
 */
function Specks({
  className,
  count,
  seed,
  top,
  bottom,
}: {
  className: string;
  count: number;
  seed: string;
  top: number;
  bottom: number;
}) {
  const rnd = seeded(seed);
  const specks = Array.from({ length: count }, (_, i) => {
    let x = rnd() * 100;
    let y = (top + rnd() * (bottom - top)) * 100;
    for (let tries = 0; tries < 4 && x > 28 && x < 72 && y > 34 && y < 62; tries++) {
      x = rnd() * 100;
      y = (top + rnd() * (bottom - top)) * 100;
    }
    const style = {
      '--x': `${x.toFixed(1)}%`,
      '--y': `${y.toFixed(1)}%`,
      '--s': `${(1.5 + rnd() * 3).toFixed(1)}px`,
      '--d': `${(2.2 + rnd() * 3).toFixed(2)}s`,
      '--dl': `${(-rnd() * 4).toFixed(2)}s`,
      // where it flies when the cover opens: away from the middle
      '--gx': `${((x - 50) * (1.2 + rnd())).toFixed(0)}vw`,
      '--gy': `${((y - 50) * (1.2 + rnd())).toFixed(0)}vh`,
    } as CSSProperties;
    return <i key={i} style={style} />;
  });
  return (
    <span className={className} aria-hidden="true">
      {specks}
    </span>
  );
}

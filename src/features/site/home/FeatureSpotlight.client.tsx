'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Play } from './Play.client';
import { FeatureScene, type FeatureKey, type SceneText } from './scenes';

/** How long each feature stays in the phone before the next one. */
const TURN_MS = 4500;
/** After the visitor picks one, the tour waits this long before going on by itself. */
const RESUME_MS = 12000;

/**
 * "Everything an invitation needs": a phone that shows each feature live — the envelope opening, an
 * RSVP being sent, the WhatsApp preview, a video behind the names, the two languages, the date circled
 * — next to the list of features (tabs). It goes through them by itself while on screen (a bar shows
 * the time left); a click, a tap or the arrow keys pick one. With reduced motion it waits for a pick.
 */
export function FeatureSpotlight({
  items,
  s,
  label,
}: {
  items: { key: FeatureKey; icon: ReactNode; title: string; body: string }[];
  s: SceneText;
  label: string;
}) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  const [hover, setHover] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(media.matches || 'a11yMotion' in document.documentElement.dataset);
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('a11y:change', sync);
    const el = box.current;
    const seen = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), {
      threshold: 0.35,
    });
    if (el) seen.observe(el);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('a11y:change', sync);
      seen.disconnect();
    };
  }, []);

  // it holds still under the pointer, so what's being read doesn't slide away
  const running = auto && visible && !still && !hover;
  useEffect(() => {
    if (!running) return;
    const next = window.setTimeout(() => setActive((a) => (a + 1) % items.length), TURN_MS);
    return () => window.clearTimeout(next);
  }, [running, active, items.length]);
  useEffect(() => {
    if (auto) return;
    const resume = window.setTimeout(() => setAuto(true), RESUME_MS);
    return () => window.clearTimeout(resume);
  }, [auto, active]);

  const pick = (i: number, focus = false) => {
    setActive(i);
    setAuto(false);
    if (focus) tabs.current[i]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = items.length;
    const to =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? (i + 1) % n
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    pick(to, true);
  };

  const current = items[active]!;
  return (
    <div
      ref={box}
      className="hx grid items-center gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div
        id="hx-spot-panel"
        role="tabpanel"
        aria-labelledby={`hx-tab-${current.key}`}
        className="relative mx-auto w-full max-w-[280px]"
      >
        <div aria-hidden className="site-glow absolute inset-[-14%] -z-10 rounded-full" />
        <Play className="hx-spot-phone">
          <div className="hx-spot-screen">
            <FeatureScene key={current.key} feature={current.key} s={s} />
          </div>
        </Play>
      </div>
      <div role="tablist" aria-label={label} aria-orientation="vertical" className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <button
            key={item.key}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`hx-tab-${item.key}`}
            aria-selected={i === active}
            aria-controls="hx-spot-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => pick(i)}
            onKeyDown={(e) => onKey(e, i)}
            className="hx-feat focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span aria-hidden className="hx-feat-icon">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[16.5px] font-bold">{item.title}</span>
              <span
                className={`mt-1 block text-[14.5px] text-pretty text-muted ${i === active ? '' : 'max-lg:hidden'}`}
              >
                {item.body}
              </span>
            </span>
            {i === active ? (
              <span
                key={`${active}-${running}`}
                aria-hidden
                className="hx-bar"
                data-run={running ? '' : undefined}
                style={{ '--dur': `${TURN_MS}ms` } as CSSProperties}
              />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

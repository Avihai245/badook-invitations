'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Icon } from '../../ui/Icon';
import { CalendarMenu, type CalendarLinks } from '../venues/CalendarMenu.client';

export interface RevealProps {
  mechanic: 'scratch' | 'tap' | 'spin';
  prompt: string;
  /** "יום חמישי, 17 ביוני 2027" */
  date: string;
  hebrewDate: string | null;
  /** YYYY-MM-DD — the spin mechanic's digits */
  iso: string;
  calendar: {
    label: string;
    links: CalendarLinks;
    labels: { google: string; apple: string; outlook: string };
  } | null;
  /** the keyboard / screen-reader way to reveal */
  buttonLabel: string;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Save-the-date reveal (§2.2 sections 9): `scratch` (scratch-off foil, auto-completes at 55% cleared),
 * `tap` (a seal that bursts) or `spin` (slot-machine digits settling on the date when it comes into
 * view). The date is in the page from the start (screen readers, no-JS); a button reveals it for
 * keyboard users. "Add to calendar" appears once revealed, in the space the foil / seal covered (no
 * empty gap before, no layout shift after).
 */
export function Reveal({ mechanic, prompt, date, hebrewDate, iso, calendar, buttonLabel }: RevealProps) {
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);
  const content = (
    <>
      <div className="rv-date">
        <p className="rv-long">{date}</p>
        {hebrewDate ? <p className="rv-heb">{hebrewDate}</p> : null}
      </div>
      {calendar ? (
        <div className="rv-cal actions">
          <CalendarMenu label={calendar.label} links={calendar.links} labels={calendar.labels} />
        </div>
      ) : null}
    </>
  );
  return (
    <div className={`rv rv-${mechanic}`} data-revealed={revealed ? '' : undefined}>
      {mechanic === 'scratch' ? (
        <Scratch prompt={prompt} revealed={revealed} onReveal={reveal} buttonLabel={buttonLabel}>
          {content}
        </Scratch>
      ) : mechanic === 'tap' ? (
        <Tap prompt={prompt} revealed={revealed} onReveal={reveal} buttonLabel={buttonLabel}>
          {content}
        </Tap>
      ) : (
        <Spin iso={iso} prompt={prompt} revealed={revealed} onReveal={reveal} buttonLabel={buttonLabel}>
          {content}
        </Spin>
      )}
    </div>
  );
}

interface MechanicProps {
  prompt: string;
  revealed: boolean;
  onReveal: () => void;
  buttonLabel: string;
  children: ReactNode;
}

// ─── scratch ──────────────────────────────────────────────────────────────────────────────────────

const CLEARED_TO_REVEAL = 0.55;
const BRUSH = 34;

function Scratch({ prompt, revealed, onReveal, buttonLabel, children }: MechanicProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const touched = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const lastCheck = useRef(0);
  const [gone, setGone] = useState(false);

  // the foil: accent, a sheen, speckles and the prompt — repainted on resize until first scratched
  useEffect(() => {
    const c = canvas.current;
    const el = box.current;
    if (!c || !el) return;
    const paint = () => {
      if (touched.current) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      const g = c.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const css = getComputedStyle(el);
      const accent = css.getPropertyValue('--inv-accent').trim() || '#731f2e';
      const ink = css.getPropertyValue('--inv-accent-ink').trim() || '#ffffff';
      g.fillStyle = accent;
      g.fillRect(0, 0, width, height);
      const sheen = g.createLinearGradient(0, 0, width, height);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.45, 'rgba(255,255,255,.22)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,.08)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sheen;
      g.fillRect(0, 0, width, height);
      g.fillStyle = 'rgba(255,255,255,.10)';
      for (let i = 0; i < (width * height) / 90; i++) {
        // a fixed pattern (no Math.random): the same foil on every render
        const x = (i * 37.3) % width;
        const y = (i * 61.7 + (i % 7) * 13) % height;
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `600 16px ${css.getPropertyValue('--f-ui').trim() || 'sans-serif'}`;
      g.fillText(prompt, width / 2, height / 2, width - 32);
    };
    paint();
    void document.fonts?.ready.then(paint);
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => ro.disconnect();
  }, [prompt]);

  // fade the foil away, then drop it
  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => setGone(true), reducedMotion() ? 0 : 650);
    return () => window.clearTimeout(t);
  }, [revealed]);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const scratch = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const g = canvas.current?.getContext('2d');
    if (!g) return;
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = BRUSH;
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x + 0.01, to.y);
    g.stroke();
    g.globalCompositeOperation = 'source-over';
  };
  /** Share of the foil cleared, sampled on a 40×24 copy. */
  const progress = () => {
    const c = canvas.current;
    if (!c) return 0;
    const probe = document.createElement('canvas');
    probe.width = 40;
    probe.height = 24;
    const g = probe.getContext('2d', { willReadFrequently: true });
    if (!g) return 0;
    g.drawImage(c, 0, 0, 40, 24);
    const data = g.getImageData(0, 0, 40, 24).data;
    let cleared = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! < 128) cleared++;
    return cleared / (40 * 24);
  };
  const check = (force = false) => {
    const now = performance.now();
    if (!force && now - lastCheck.current < 120) return;
    lastCheck.current = now;
    if (progress() >= CLEARED_TO_REVEAL) onReveal();
  };

  return (
    <div ref={box} className="rv-scratch-box">
      {children}
      {!gone ? (
        <canvas
          ref={canvas}
          className="rv-foil"
          aria-hidden="true"
          onPointerDown={(e) => {
            if (revealed) return;
            touched.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = point(e);
            last.current = p;
            scratch(p, p);
          }}
          onPointerMove={(e) => {
            if (!last.current || revealed) return;
            const p = point(e);
            scratch(last.current, p);
            last.current = p;
            check();
          }}
          onPointerUp={() => {
            last.current = null;
            if (!revealed) check(true);
          }}
          onPointerCancel={() => {
            last.current = null;
          }}
        />
      ) : null}
      {!revealed ? (
        <button type="button" className="rv-kbd" onClick={onReveal}>
          {buttonLabel}
        </button>
      ) : null}
    </div>
  );
}

// ─── tap ──────────────────────────────────────────────────────────────────────────────────────────

const SPARKS = 12;

function Tap({ prompt, revealed, onReveal, buttonLabel, children }: MechanicProps) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => setGone(true), reducedMotion() ? 0 : 700);
    return () => window.clearTimeout(t);
  }, [revealed]);
  return (
    <div className="rv-tap-box">
      {children}
      {!gone ? (
        <button
          type="button"
          className="rv-seal"
          onClick={onReveal}
          aria-label={buttonLabel}
          disabled={revealed}
        >
          <span className="rv-seal-disc" aria-hidden="true">
            <Icon name="sparkles" size={30} />
          </span>
          <span className="rv-prompt">{prompt}</span>
        </button>
      ) : null}
      {revealed ? (
        <span className="rv-sparks" aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, i) => (
            <span key={i} style={{ '--a': `${(360 / SPARKS) * i}deg` } as CSSProperties} />
          ))}
        </span>
      ) : null}
    </div>
  );
}

// ─── spin ─────────────────────────────────────────────────────────────────────────────────────────

const STEP_MS = 140;
const SPIN_MS = 1400;
const STRIP = Array.from({ length: 30 }, (_, k) => k % 10);

function Spin({ iso, prompt, revealed, onReveal, buttonLabel, children }: MechanicProps & { iso: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);
  const digits = `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`.split('').map(Number);

  // the reels start once the card is well in view
  useEffect(() => {
    const el = box.current;
    if (!el || spinning) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSpinning(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [spinning]);

  // the date appears when the last reel has settled
  useEffect(() => {
    if (!spinning || revealed) return;
    const t = window.setTimeout(onReveal, reducedMotion() ? 0 : SPIN_MS + STEP_MS * (digits.length - 1));
    return () => window.clearTimeout(t);
  }, [spinning, revealed, onReveal, digits.length]);

  return (
    <div ref={box} className="rv-spin-box" data-spinning={spinning ? '' : undefined}>
      <div className="rv-reels" dir="ltr" aria-hidden="true">
        {digits.map((d, i) => (
          <Fragment key={i}>
            {i === 2 || i === 4 ? <span className="rv-sep">.</span> : null}
            <span className="rv-reel">
              <span
                className="rv-strip"
                style={{ '--to': spinning ? 20 + d : 0, '--delay': `${i * STEP_MS}ms` } as CSSProperties}
              >
                {STRIP.map((n, k) => (
                  <span key={k}>{n}</span>
                ))}
              </span>
            </span>
          </Fragment>
        ))}
      </div>
      {!spinning ? (
        <button
          type="button"
          className="rv-spin-btn"
          onClick={() => setSpinning(true)}
          aria-label={buttonLabel}
        >
          {prompt}
        </button>
      ) : null}
      {children}
    </div>
  );
}

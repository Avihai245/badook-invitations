'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { markTourDone } from './tour-done';

const DONE_KEY = 'badook:tour-done';

type StepKey = 'next' | 'nav' | 'budget' | 'rsvp' | 'help';

/** Where each stop points: the first of its selectors that is on the screen (the sidebar or the phone's bar). */
const TARGETS: Record<StepKey, string[]> = {
  next: ['[data-testid="home-next"]'],
  nav: ['[data-testid="event-sidebar"]', '[data-testid="event-bottom-bar"]'],
  budget: ['[data-testid="home-budget"]'],
  rsvp: ['[data-testid="home-rsvp"]'],
  help: ['[data-tour="help"]', '.support-launcher'],
};
const ORDER: StepKey[] = ['next', 'nav', 'budget', 'rsvp', 'help'];

function visible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function find(key: StepKey): HTMLElement | null {
  for (const sel of TARGETS[key]) {
    const el = document.querySelector(sel);
    if (visible(el)) return el;
  }
  return null;
}

function seen(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * The event home's first visit (UX report §4.2): five short stops — the next step, the four stages, the
 * budget gauge, the RSVPs and help — each lit up on a dimmed screen with a short card. Opens by itself
 * once (remembered on the account and in this browser), or with `?tour=1` (after the start wizard). Esc
 * or "skip" ends it.
 */
export function Tour({ seenOnAccount = false }: { seenOnAccount?: boolean }) {
  const { t, fmt, number } = useUi();
  const T = t.tour;
  const [steps, setSteps] = useState<StepKey[] | null>(null);
  const [at, setAt] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).has('tour');
    // not unasked in an automated browser (tests, audits): it would cover the page they drive
    if (!asked && (seen() || seenOnAccount || navigator.webdriver)) return;
    // after the page has settled (its widgets drawn)
    const timer = window.setTimeout(() => {
      const present = ORDER.filter((k) => find(k));
      if (present.length) setSteps(present);
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- decided once, on the first visit
  }, []);

  const key = steps?.[at] ?? null;
  useLayoutEffect(() => {
    if (!key) return;
    const el = find(key);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    card.current?.focus();
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [key]);

  const close = () => {
    try {
      window.localStorage.setItem(DONE_KEY, '1');
    } catch {
      /* the account keeps it */
    }
    void markTourDone();
    setSteps(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('tour')) {
      url.searchParams.delete('tour');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  };

  if (!steps || !key || !rect) return null;
  const last = at === steps.length - 1;
  const words = T.steps[key];
  const pad = 8;
  const hole = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  // the card below the lit part when there is room, else above it; kept on the screen
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const below = hole.top + hole.height + 220 < vh;
  const cardWidth = Math.min(340, vw - 32);
  // a tall target (the sidebar): the card beside it, halfway down
  const tall = hole.height > vh * 0.6;
  const beside = hole.left - cardWidth - 12 >= 16 ? hole.left - cardWidth - 12 : hole.left + hole.width + 12;
  const left = tall
    ? Math.max(16, Math.min(vw - cardWidth - 16, beside))
    : Math.max(16, Math.min(vw - cardWidth - 16, hole.left + hole.width / 2 - cardWidth / 2));
  const top = tall
    ? vh / 2 - 100
    : below
      ? Math.min(vh - 200, hole.top + hole.height + 12)
      : Math.max(16, hole.top - 12 - 190);

  return (
    <div className="fixed inset-0 z-[80]" data-testid="tour" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[20px] shadow-[0_0_0_9999px_rgba(20,16,13,0.62)] ring-2 ring-white/80 transition-all duration-300 motion-reduce:transition-none"
        style={hole}
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="absolute rounded-[18px] bg-surface p-5 shadow-lg outline-none"
        style={{ top, left, width: cardWidth }}
      >
        <p className="text-[12px] font-semibold text-brand-deep">
          {T.label} · {fmt(T.step, { n: number(at + 1), total: number(steps.length) })}
        </p>
        <h2 id="tour-title" className="mt-1 text-[17px] font-bold">
          {words.title}
        </h2>
        <p id="tour-body" className="mt-1 text-[14px] text-muted">
          {words.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            {T.skip}
          </Button>
          <Button size="sm" onClick={() => (last ? close() : setAt((i) => i + 1))}>
            {last ? T.done : T.next}
          </Button>
        </div>
      </div>
    </div>
  );
}

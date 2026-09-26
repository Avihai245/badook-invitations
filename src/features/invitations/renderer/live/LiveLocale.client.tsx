'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { dirOf, type Locale } from '../../contracts/types';
import { FloatingControls, type MusicProps } from '../FloatingControls.client';
import type { LivePayload } from './payload';

type Sections = ComponentType<{ payload: LivePayload; locale: Locale }>;

let chunk: Promise<Sections> | null = null;

/** The browser-side renderer, fetched once (after the cover opens, or when the guest reaches for the pill). */
function loadSections(): Promise<Sections> {
  chunk ??= import('./LiveSections.client').then(
    (m) => m.LiveSections,
    (err: unknown) => {
      chunk = null; // offline: the next attempt retries
      throw err;
    },
  );
  return chunk;
}

const SAMPLE: Record<Locale, string> = { he: 'אבגדהוזחטיכלמנ', en: 'AaBbCcDdEeFfGg' };
const FONT_VARS = ['--f-display', '--f-heading', '--f-body', '--f-ui'];

/** Starts the download of a locale's fonts (their unicode-range subsets load only when text needs them). */
function loadFonts(vars: Record<string, string>, locale: Locale): Promise<unknown> {
  const fonts = document.fonts as FontFaceSet | undefined;
  if (!fonts?.load) return Promise.resolve();
  const stacks = new Set(FONT_VARS.map((key) => vars[key]).filter((v): v is string => !!v));
  return Promise.all(
    [...stacks].map((stack) => fonts.load(`1em ${stack}`, SAMPLE[locale]).catch(() => null)),
  );
}

interface Anchor {
  index: number;
  count: number;
  top: number;
  ratio: number;
  y: number;
}

const mainChildren = () => Array.from(document.querySelector('.inv > main')?.children ?? []) as HTMLElement[];

/** Where the guest is: the first section still on screen, and how far into it. */
function captureAnchor(): Anchor {
  const kids = mainChildren();
  const y = window.scrollY;
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i]!.getBoundingClientRect();
    if (r.height > 0 && r.bottom > 0) {
      return { index: i, count: kids.length, top: r.top, ratio: r.top < 0 ? -r.top / r.height : 0, y };
    }
  }
  return { index: -1, count: kids.length, top: 0, ratio: 0, y };
}

/** Back to the same section, the same share of it scrolled past (the texts' lengths differ per locale). */
function restoreAnchor(a: Anchor) {
  const kids = mainChildren();
  const el = a.index >= 0 && kids.length === a.count ? kids[a.index] : undefined;
  let y = a.y;
  if (el) {
    const r = el.getBoundingClientRect();
    y = window.scrollY + r.top - (a.top >= 0 ? a.top : -a.ratio * r.height);
  }
  const root = document.documentElement;
  const behavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto'; // <html> scrolls smoothly (anchor links) — not this jump
  window.scrollTo(0, Math.max(0, Math.round(y)));
  root.style.scrollBehavior = behavior;
}

/** The new locale's nodes on (or above) the screen appear as they are — no entrance animation again. */
function revealInView() {
  const inv = document.querySelector<HTMLElement>('.inv');
  if (!inv) return;
  inv.dataset.instant = '';
  const bottom = window.innerHeight;
  inv.querySelectorAll<HTMLElement>('main :is(.reveal, .divider, .deco):not(.in)').forEach((el) => {
    if (el.getBoundingClientRect().top < bottom) el.classList.add('in');
  });
  requestAnimationFrame(() => requestAnimationFrame(() => delete inv.dataset.instant));
}

/** `?lang=` in the address bar (Next.js keeps its router in sync with replaceState — no request). */
function showAddress(url: string) {
  const next = new URL(url, window.location.href);
  const current = new URL(window.location.href);
  current.searchParams.forEach((value, key) => {
    if (!next.searchParams.has(key)) next.searchParams.set(key, value);
  });
  window.history.replaceState(null, '', `${next.pathname}${next.search}${current.hash}`);
}

/**
 * The live language switch of a bilingual invitation (§2.2 Global): the pill swaps the texts and
 * `dir` in place — no reload, the music keeps playing, the guest stays at the same place in the
 * invitation, `?lang=` follows. The page's own locale is the server-rendered `children`; the other
 * one is rendered in the browser from the payload.
 */
export function LiveLocale({
  initial,
  payload,
  music,
  children,
}: {
  initial: Locale;
  payload: LivePayload;
  music: MusicProps | null;
  /** the sections in `initial`, rendered on the server */
  children: ReactNode;
}) {
  const [view, setView] = useState<{ locale: Locale; Sections: Sections | null }>({
    locale: initial,
    Sections: null,
  });
  const { locale, Sections } = view;
  const applied = useRef(initial);
  const busy = useRef(false);
  const anchor = useRef<Anchor | null>(null);
  const fonts = useRef(new Map<Locale, Promise<unknown>>());
  const { locales } = payload.doc;
  const target = locales[(locales.indexOf(locale) + 1) % locales.length]!;
  const entry = payload.locales[locale]!;

  /** Hover / press / focus on the pill: fetch what the switch needs. */
  const prepare = useCallback(
    (l: Locale) => {
      if (l !== initial) void loadSections().catch(() => undefined);
      const e = payload.locales[l];
      if (e && !fonts.current.has(l)) fonts.current.set(l, loadFonts(e.vars, l));
    },
    [initial, payload],
  );

  // Fetch the renderer ahead of time, once the guest is in and the opening has played.
  useEffect(() => {
    let timer = 0;
    const later = (ms: number) => () => {
      timer = window.setTimeout(() => void loadSections().catch(() => undefined), ms);
    };
    const afterOpening = later(3000);
    if (document.documentElement.dataset.opened) later(1500)();
    else window.addEventListener('invitation:open', afterOpening, { once: true });
    return () => {
      window.removeEventListener('invitation:open', afterOpening);
      window.clearTimeout(timer);
    };
  }, []);

  const switchTo = useCallback(
    async (next: Locale) => {
      if (busy.current || next === applied.current) return;
      busy.current = true;
      try {
        prepare(next);
        const NextSections = next === initial ? null : await loadSections();
        // the target script's fonts usually arrived on hover/press already — never wait long for them
        await Promise.race([fonts.current.get(next), new Promise((r) => window.setTimeout(r, 250))]);
        anchor.current = captureAnchor();
        // render + restore the position before the browser paints
        flushSync(() => setView((v) => ({ locale: next, Sections: NextSections ?? v.Sections })));
      } catch {
        // the renderer couldn't be fetched (offline): the plain link
        window.location.assign(payload.locales[next]?.href ?? window.location.href);
      } finally {
        busy.current = false;
      }
    },
    [initial, payload, prepare],
  );

  useLayoutEffect(() => {
    if (applied.current === locale) return;
    applied.current = locale;
    const e = payload.locales[locale];
    if (!e) return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dirOf(locale);
    for (const [key, value] of Object.entries(e.vars)) root.style.setProperty(key, value);
    // the hero's entrance has played already (see invitation.css)
    root.dataset.localeSwitched = '1';
    document.title = e.title;
    showAddress(e.url);
    const a = anchor.current;
    if (a) {
      restoreAnchor(a);
      // fonts still arriving change the texts' height: settle again, unless the guest scrolled meanwhile
      const settled = window.scrollY;
      void document.fonts?.ready.then(() => {
        if (Math.abs(window.scrollY - settled) < 2) restoreAnchor(a);
      });
    }
    revealInView();
  }, [locale, payload]);

  return (
    <>
      <FloatingControls
        langSwitch={{
          href: payload.locales[target]?.href ?? '',
          label: entry.labels.switch,
          targetLocale: target,
          onSwitch: (l) => void switchTo(l),
          onIntent: () => prepare(target),
        }}
        music={music ? { ...music, playLabel: entry.labels.play, pauseLabel: entry.labels.pause } : null}
      />
      {locale === initial || !Sections ? children : <Sections payload={payload} locale={locale} />}
    </>
  );
}

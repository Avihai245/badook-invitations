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
import type { ListenProps } from '@/features/voice/ui/Listen.client';
import { nativeName } from '../../lib/locales';
import { FloatingControls, type MusicProps } from '../FloatingControls.client';
import type { MotionLabels } from '../MotionPause.client';
import { rememberChoice, storedChoice } from './detect';
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

/** A few letters of each script: `document.fonts.load` fetches the unicode-range faces they fall in. */
const SAMPLE: Record<Locale, string> = {
  he: 'אבגדהוזחטיכלמנ',
  en: 'AaBbCcDdEeFfGg',
  ru: 'АаБбВвГгДдЕеЖж',
  ar: 'ابتثجحخدذرزسشص',
  fr: 'AaBbCcÉéÈèÀàÇç',
  es: 'AaBbCcÑñÁáÉéÍí',
  am: 'ሀለሐመሠረሰሸቀበተቸኀነ',
};
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

const mainChildren = () =>
  Array.from(document.querySelector('.inv > main, .inv .sc-track main')?.children ?? []) as HTMLElement[];

/**
 * What scrolls: the page — or, in a scroll scene's phone frame on a computer (renderer/scene), the
 * frame (`.sc-scroll`, then a scroll container).
 */
function scrolling(): { y: number; to: (y: number) => void; style: CSSStyleDeclaration } {
  const frame = document.querySelector<HTMLElement>('.inv .sc-scroll');
  const o = frame ? getComputedStyle(frame).overflowY : 'visible';
  if (frame && o !== 'visible' && o !== 'clip')
    return { y: frame.scrollTop, to: (y) => frame.scrollTo(0, y), style: frame.style };
  return {
    y: window.scrollY,
    to: (y) => window.scrollTo(0, y),
    style: document.documentElement.style,
  };
}

/** Where the guest is: the first section still on screen, and how far into it. */
function captureAnchor(): Anchor {
  const kids = mainChildren();
  const y = scrolling().y;
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
  const scroll = scrolling();
  if (el) {
    const r = el.getBoundingClientRect();
    y = scroll.y + r.top - (a.top >= 0 ? a.top : -a.ratio * r.height);
  }
  const behavior = scroll.style.scrollBehavior;
  scroll.style.scrollBehavior = 'auto'; // <html> scrolls smoothly (anchor links) — not this jump
  scroll.to(Math.max(0, Math.round(y)));
  scroll.style.scrollBehavior = behavior;
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

/** Which switch this is: the guest's own choice (the menu), or the language picked for them. */
type How = 'guest' | 'auto';

/**
 * The live language switch of an invitation in several languages (§2.2 Global): the language pill (a
 * menu from three languages on) swaps the texts and `dir` in place — no reload, the music keeps
 * playing, the guest stays at the same place in the invitation, `?lang=` follows, and the choice holds
 * for the visit. The page's own locale is the server-rendered `children`; the others are rendered in
 * the browser from the payload.
 *
 * The same switch serves the language picked for the guest (live/detect.ts): the browser's language —
 * the page's inline script already set <html lang dir> and the cover's texts, so the sections follow
 * here, unseen behind the cover — or, on a personal link, the guest's own language from the host's
 * list (GuestLink → `invitation:guest-language`). Such a switch touches neither the address nor the
 * guest's choice.
 */
export function LiveLocale({
  initial,
  payload,
  music,
  listen = {},
  motion = {},
  children,
}: {
  initial: Locale;
  payload: LivePayload;
  music: MusicProps | null;
  /** the invitation read aloud in each language (features/voice) */
  listen?: Partial<Record<Locale, ListenProps | null>>;
  /** "pause the animations" in each language (MotionPause) */
  motion?: Partial<Record<Locale, MotionLabels | null>>;
  /** the sections in `initial`, rendered on the server */
  children: ReactNode;
}) {
  const [view, setView] = useState<{ locale: Locale; Sections: Sections | null; how: How }>({
    locale: initial,
    Sections: null,
    how: 'auto',
  });
  const { locale, Sections } = view;
  const applied = useRef(initial);
  const busy = useRef<Locale | null>(null);
  const anchor = useRef<Anchor | null>(null);
  const fonts = useRef(new Map<Locale, Promise<unknown>>());
  const { locales } = payload.doc;
  const slug = payload.doc.share.slug;
  const entry = payload.locales[locale]!;

  /** Hover / press / focus on the pill or a language: fetch what the switch needs. */
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
    async (next: Locale, how: How) => {
      if (busy.current === next || next === applied.current) return;
      busy.current = next;
      try {
        prepare(next);
        const NextSections = next === initial ? null : await loadSections();
        if (busy.current !== next) return; // another language was asked for meanwhile
        // the target script's fonts usually arrived on hover/press already — never wait long for them
        await Promise.race([fonts.current.get(next), new Promise((r) => window.setTimeout(r, 250))]);
        anchor.current = captureAnchor();
        // render + restore the position before the browser paints
        flushSync(() => setView((v) => ({ locale: next, Sections: NextSections ?? v.Sections, how })));
      } catch {
        // the renderer couldn't be fetched (offline): the guest's choice becomes the plain link;
        // a language picked for them stays as the page is
        if (how === 'guest') window.location.assign(payload.locales[next]?.href ?? window.location.href);
        else endPending();
      } finally {
        if (busy.current === next) busy.current = null;
      }
    },
    [initial, payload, prepare],
  );

  /** The guest picks a language in the menu: it holds for the rest of the visit. */
  const choose = useCallback(
    (l: Locale) => {
      rememberChoice(slug, l);
      void switchTo(l, 'guest');
    },
    [slug, switchTo],
  );

  // The language picked before React took over (the inline script: the guest's browser language),
  // and later a personal link's language — unless the guest chose one, or the link names one.
  useLayoutEffect(() => {
    const pending = document.documentElement.dataset.localePending as Locale | undefined;
    if (pending && pending !== initial && locales.includes(pending)) void switchTo(pending, 'auto');
    else endPending();
    const onGuestLanguage = (e: Event) => {
      const l = (e as CustomEvent<{ language?: string | null }>).detail?.language as Locale | undefined;
      if (!l || !locales.includes(l) || storedChoice(slug)) return;
      if (new URLSearchParams(window.location.search).get('lang')) return;
      void switchTo(l, 'auto');
    };
    window.addEventListener('invitation:guest-language', onGuestLanguage);
    return () => window.removeEventListener('invitation:guest-language', onGuestLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the hydration commit
  }, []);

  useLayoutEffect(() => {
    if (applied.current === locale) return;
    applied.current = locale;
    const e = payload.locales[locale];
    if (!e) return;
    const root = document.documentElement;
    // the invitation is on screen (not behind its cover): a visible switch, no entrance played again
    const visible = !!root.dataset.opened;
    root.lang = locale;
    root.dir = dirOf(locale);
    for (const [key, value] of Object.entries(e.vars)) root.style.setProperty(key, value);
    if (visible) root.dataset.localeSwitched = '1';
    document.title = e.title;
    // the guest's choice shows in the address (a reload or a shared link keeps it) — a language picked
    // for them doesn't: someone they share the link with gets their own
    if (view.how === 'guest') showAddress(e.url);
    const a = anchor.current;
    if (a && visible) {
      restoreAnchor(a);
      // fonts still arriving change the texts' height: settle again, unless the guest scrolled meanwhile
      const settled = scrolling().y;
      void document.fonts?.ready.then(() => {
        if (Math.abs(scrolling().y - settled) < 2) restoreAnchor(a);
      });
    }
    if (visible) revealInView();
    endPending();
    window.dispatchEvent(new CustomEvent('invitation:locale', { detail: { locale } }));
  }, [locale, payload, view.how]);

  return (
    <>
      <FloatingControls
        language={{
          current: locale,
          menuLabel: entry.labels.menu,
          options: locales.map((l) => ({
            locale: l,
            label: nativeName(l),
            href: payload.locales[l]?.href ?? '',
          })),
          onSwitch: choose,
          onIntent: prepare,
        }}
        music={music ? { ...music, playLabel: entry.labels.play, pauseLabel: entry.labels.pause } : null}
        listen={listen[locale] ?? null}
        motion={motion[locale] ?? null}
      />
      {locale === initial || !Sections ? children : <Sections payload={payload} locale={locale} />}
    </>
  );
}

/** The picked language is on screen (or won't come): the page shows as it is. */
function endPending() {
  const root = document.documentElement.dataset;
  delete root.localePending;
  delete root.localeHide;
}

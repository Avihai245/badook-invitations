import type { Locale } from '../../contracts/types';

/**
 * Which language a guest reads the invitation in — decided in the browser, never by the server: the
 * page is cached (ISR, one copy per language), so it can't vary by request headers. A visit without
 * `?lang=` gets the default language; the browser then picks, in order:
 *   1. the guest's own choice in this visit (the language menu — sessionStorage);
 *   2. the link's language (`?lang=`: a personal link sent in the guest's language);
 *   3. the first of the browser's languages (navigator.languages) the invitation has.
 * A personal link's preference comes later, from the server (GuestLink → `invitation:guest-language`).
 */
export interface LocaleChoice {
  /** the guest's choice in this visit */
  explicit: string | null;
  /** `?lang=` */
  link: string | null;
  /** navigator.languages */
  browser: readonly string[];
  /** the invitation's languages */
  available: readonly string[];
}

/** The language to show (null: the one the page was rendered in is right). Pure — tested directly. */
export function chooseLocale(c: LocaleChoice): string | null {
  const has = (l: string | null): l is string => !!l && c.available.includes(l);
  if (has(c.explicit)) return c.explicit;
  if (has(c.link)) return c.link;
  for (const tag of c.browser) {
    let base = String(tag).trim().toLowerCase().split(/[-_]/)[0] ?? '';
    if (base === 'iw') base = 'he';
    if (has(base)) return base;
  }
  return null;
}

export const explicitKey = (slug: string) => `badook:lang:${slug}`;

/** The guest chose a language (the menu): it holds for the rest of the visit. */
export function rememberChoice(slug: string, locale: Locale) {
  try {
    window.sessionStorage.setItem(explicitKey(slug), locale);
  } catch {
    // private mode: this page view only
  }
}

export function storedChoice(slug: string): string | null {
  try {
    return window.sessionStorage.getItem(explicitKey(slug));
  } catch {
    return null;
  }
}

/** The configuration the page's inline boot script reads (kept tiny: it rides in the first bytes). */
export interface BootConfig {
  /** the slug (the choice's storage key) */
  s: string;
  /** the language the page was rendered in */
  c: string;
  /** the invitation's languages */
  l: string[];
  /** those of them written right to left */
  r: string[];
  /** the page opens behind a cover (the switch happens unseen) */
  k: boolean;
}

/**
 * Runs in <head> before the first paint (InvitationHtml): when the guest should read another of the
 * invitation's languages, <html lang dir> say so at once — the cover shows its texts in that language
 * from the first paint (cover/localized.tsx) — and `data-locale-pending` asks LiveLocale to swap the
 * sections as soon as React is there (behind the cover). Without a cover the sections wait hidden
 * for it a moment (invitation.css), never long. Self-contained: it is inlined as its source.
 */
export function bootLocale(cfg: BootConfig) {
  // no inner functions: the source is inlined as it is (a tool that wraps named functions would break it)
  try {
    const root = document.documentElement;
    const q = new URLSearchParams(location.search);
    let explicit: string | null = null;
    try {
      explicit = sessionStorage.getItem('badook:lang:' + cfg.s);
    } catch {
      explicit = null;
    }
    const link = q.get('lang');
    let pick: string | null = null;
    if (explicit && cfg.l.indexOf(explicit) >= 0) pick = explicit;
    else if (link && cfg.l.indexOf(link) >= 0) pick = link;
    else {
      const tags =
        navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      for (let i = 0; i < tags.length && !pick; i++) {
        let base = String(tags[i] || '')
          .toLowerCase()
          .split(/[-_]/)[0];
        if (base === 'iw') base = 'he';
        if (base && cfg.l.indexOf(base) >= 0) pick = base;
      }
    }
    if (!pick || pick === cfg.c) return;
    root.lang = pick;
    root.dir = cfg.r.indexOf(pick) >= 0 ? 'rtl' : 'ltr';
    root.dataset.localePending = pick;
    if (!cfg.k || q.get('open') === '1') root.dataset.localeHide = '1';
  } catch {
    // the page in its own language
  }
}

/** The inline script: bootLocale's own source, called with the page's configuration. */
export const bootLocaleScript = (cfg: BootConfig) => `(${bootLocale.toString()})(${JSON.stringify(cfg)})`;

'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  dictFor,
  fmt,
  intlLocale,
  plural,
  uiDir,
  type AppDict,
  type PluralEntry,
  type UiLocale,
} from './app';

interface UiContextValue {
  locale: UiLocale;
  dir: 'rtl' | 'ltr';
  t: AppDict;
  fmt: typeof fmt;
  plural(entry: PluralEntry, n: number, vars?: Record<string, string | number>): string;
  /** Intl formatting in the UI language */
  number(n: number): string;
  date(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string;
}

const UiContext = createContext<UiContextValue | null>(null);

/**
 * Host-app strings for client components. Both dictionaries ship in the (cached) JS bundle and the
 * provider picks one by the locale the server resolved, so no strings travel in the RSC payload.
 */
export function UiProvider({ locale, children }: { locale: UiLocale; children: ReactNode }) {
  // <html data-hydrated> once React owns the page and the parts streamed in behind a loading skeleton
  // have taken their place — React reveals them a moment later and keeps each one in a hidden
  // <div id="S:…"> until then, a second copy (end-to-end tests wait for this before looking and
  // typing). At most a few seconds: a part whose page turned out not found stays hidden for good.
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const settle = () => {
      const pending = document.querySelector('div[hidden][id^="S:"]');
      if (pending && performance.now() - start < 3000) frame = requestAnimationFrame(settle);
      else document.documentElement.dataset.hydrated = '1';
    };
    settle();
    return () => cancelAnimationFrame(frame);
  }, []);
  const value = useMemo<UiContextValue>(() => {
    const intl = intlLocale(locale);
    return {
      locale,
      dir: uiDir(locale),
      t: dictFor(locale),
      fmt,
      plural: (entry, n, vars) => plural(locale, entry, n, vars),
      number: (n) => new Intl.NumberFormat(intl).format(n),
      date: (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) =>
        new Intl.DateTimeFormat(intl, options).format(
          typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? new Date(`${value}T12:00:00Z`)
            : new Date(value),
        ),
    };
  }, [locale]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi() outside <UiProvider>');
  return value;
}

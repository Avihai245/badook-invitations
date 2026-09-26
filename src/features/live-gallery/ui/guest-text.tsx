'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { galleryGuestEn } from '@/lib/i18n/gallery-guest.en';
import { galleryGuestHe, type GalleryGuestDict } from '@/lib/i18n/gallery-guest.he';
import { fmt } from '../format';

export { fmt, formatBytes } from '../format';

/**
 * The gallery guest pages' strings and formatting (the upload page, the screen): their own small
 * dictionaries — guests' phones don't download the host app's — in the invitation's language.
 */

export type GuestLocale = 'he' | 'en';
export type PluralEntry = { one: string; other: string } & Partial<
  Record<'two' | 'many' | 'few' | 'zero', string>
>;

const intl = (l: GuestLocale) => (l === 'he' ? 'he-IL' : 'en-GB');

export interface GuestText {
  locale: GuestLocale;
  dir: 'rtl' | 'ltr';
  t: GalleryGuestDict;
  plural(entry: PluralEntry, n: number, vars?: Record<string, string | number>): string;
  number(n: number): string;
  date(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string;
}

export function guestText(locale: GuestLocale): GuestText {
  const rules = new Intl.PluralRules(intl(locale));
  return {
    locale,
    dir: locale === 'he' ? 'rtl' : 'ltr',
    t: locale === 'en' ? galleryGuestEn : galleryGuestHe,
    plural: (entry, n, vars = {}) =>
      fmt(entry[rules.select(n) as keyof PluralEntry] ?? entry.other, {
        n: new Intl.NumberFormat(intl(locale)).format(n),
        ...vars,
      }),
    number: (n) => new Intl.NumberFormat(intl(locale)).format(n),
    date: (value, options = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) =>
      new Intl.DateTimeFormat(intl(locale), options).format(new Date(value)),
  };
}

const Context = createContext<GuestText | null>(null);

export function GuestTextProvider({ locale, children }: { locale: GuestLocale; children: ReactNode }) {
  const value = useMemo(() => guestText(locale), [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useGuestText(): GuestText {
  const value = useContext(Context);
  if (!value) throw new Error('useGuestText() outside <GuestTextProvider>');
  return value;
}

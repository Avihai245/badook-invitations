'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { GALLERY_GUEST, type GalleryGuestDict } from '@/lib/i18n/gallery-guest';
import { localeText, type GuestLocale, type LocaleText } from '@/lib/i18n/guest';

export { fmt, formatBytes } from '../format';
export type { GuestLocale, PluralEntry } from '@/lib/i18n/guest';

/**
 * The gallery guest pages' strings and formatting (the upload page, the screen): their own small
 * dictionaries — guests' phones don't download the host app's — in the invitation's language
 * (src/lib/i18n/guest.ts).
 */

export type GuestText = LocaleText<GalleryGuestDict>;

/** The gallery's guest pages in any of the invitation's seven languages. */
export const guestText = (locale: GuestLocale): GuestText => localeText(locale, GALLERY_GUEST[locale]);

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

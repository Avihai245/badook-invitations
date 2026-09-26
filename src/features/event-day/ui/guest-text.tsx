'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { eventDayGuestEn } from '@/lib/i18n/event-day-guest.en';
import { eventDayGuestHe, type EventDayGuestDict } from '@/lib/i18n/event-day-guest.he';
import { localeText, type GuestLocale, type LocaleText } from '@/lib/i18n/guest';

export { fill } from '@/lib/i18n/guest';
export type { GuestLocale } from '@/lib/i18n/guest';

/** The event day's guest pages' strings (the table guide, the entrance station) in their language. */
export type DayText = LocaleText<EventDayGuestDict>;

export const dayText = (locale: GuestLocale): DayText =>
  localeText(locale, locale === 'en' ? eventDayGuestEn : eventDayGuestHe);

const Context = createContext<DayText | null>(null);

/** Provides the strings, and keeps the page's language and direction (the layout set the invitation's). */
export function DayTextProvider({ locale, children }: { locale: GuestLocale; children: ReactNode }) {
  const value = useMemo(() => dayText(locale), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = value.dir;
  }, [locale, value.dir]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDayText(): DayText {
  const value = useContext(Context);
  if (!value) throw new Error('useDayText() outside <DayTextProvider>');
  return value;
}

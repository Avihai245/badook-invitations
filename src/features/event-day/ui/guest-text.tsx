'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Locale } from '@/features/invitations/contracts/types';
import { eventDayGuestEn } from '@/lib/i18n/event-day-guest.en';
import { eventDayGuestHe, type EventDayGuestDict } from '@/lib/i18n/event-day-guest.he';
import { GUIDE_TEXT, type EventDayGuideDict } from '@/lib/i18n/event-day-guide';
import { localeText, type LocaleText } from '@/lib/i18n/guest';

export { fill } from '@/lib/i18n/guest';
export type { GuestLocale } from '@/lib/i18n/guest';

/** The entrance station's language: the event staff's — Hebrew or English. */
export type StaffLocale = 'he' | 'en';

/** The entrance station's strings, in Hebrew or English. */
export type DayText = LocaleText<EventDayGuestDict>;

export const dayText = (locale: StaffLocale): DayText =>
  localeText(locale, locale === 'en' ? eventDayGuestEn : eventDayGuestHe);

/** A guest's table guide's strings, in any of the invitation's languages. */
export type GuideText = LocaleText<EventDayGuideDict>;

export const guideText = (locale: Locale): GuideText => localeText(locale, GUIDE_TEXT[locale]);

/** Keeps the page's language and direction (the layout set the invitation's). */
function usePageLanguage(locale: Locale, dir: 'rtl' | 'ltr') {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
}

const DayContext = createContext<DayText | null>(null);
const GuideContext = createContext<GuideText | null>(null);

/** The station's strings (Hebrew or English). */
export function DayTextProvider({ locale, children }: { locale: StaffLocale; children: ReactNode }) {
  const value = useMemo(() => dayText(locale), [locale]);
  usePageLanguage(locale, value.dir);
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useDayText(): DayText {
  const value = useContext(DayContext);
  if (!value) throw new Error('useDayText() outside <DayTextProvider>');
  return value;
}

/** The table guide's strings, in the guest's language. */
export function GuideTextProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => guideText(locale), [locale]);
  usePageLanguage(locale, value.dir);
  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuideText(): GuideText {
  const value = useContext(GuideContext);
  if (!value) throw new Error('useGuideText() outside <GuideTextProvider>');
  return value;
}

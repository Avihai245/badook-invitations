import type { Locale } from '@/features/invitations/contracts/types';
import { eventDayGuestEn } from './event-day-guest.en';
import { eventDayGuestHe } from './event-day-guest.he';
import { eventDayGuideAm } from './event-day-guide.am';
import { eventDayGuideAr } from './event-day-guide.ar';
import { eventDayGuideEs } from './event-day-guide.es';
import { eventDayGuideFr } from './event-day-guide.fr';
import { eventDayGuideRu } from './event-day-guide.ru';
import type { PluralEntry } from './guest';

type Dict<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends { one: string; other: string }
      ? PluralEntry
      : Dict<T[K]>;
};

/**
 * A guest's table guide (/e/<slug>/table) in every invitation language: its strings (the Hebrew
 * dictionary's `guide` and `footer`, with any plural categories) and the language menu's name. The
 * entrance station is the event staff's: it stays in Hebrew and English (event-day-guest.*.ts).
 */
export type EventDayGuideDict = Dict<{
  language: string;
  guide: typeof eventDayGuestHe.guide;
  footer: typeof eventDayGuestHe.footer;
}>;

export const GUIDE_TEXT: Record<Locale, EventDayGuideDict> = {
  he: { language: 'שפה', guide: eventDayGuestHe.guide, footer: eventDayGuestHe.footer },
  en: { language: 'Language', guide: eventDayGuestEn.guide, footer: eventDayGuestEn.footer },
  ru: eventDayGuideRu,
  ar: eventDayGuideAr,
  fr: eventDayGuideFr,
  es: eventDayGuideEs,
  am: eventDayGuideAm,
};

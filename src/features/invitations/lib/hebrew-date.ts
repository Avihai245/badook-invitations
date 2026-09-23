import { HDate, Locale as HebcalLocale, gematriya } from '@hebcal/core';
import type { ISODate, Locale } from '../contracts/types';
import { parseISODate } from './dates';

/**
 * Hebrew calendar date of a Gregorian date, via @hebcal/core.
 * - he, day  → `י״ב בסיון תשפ״ז`
 * - he, eve  → `אור לי״ג בסיון תשפ״ז` (the Hebrew date that starts at sunset of that evening)
 * - en, day  → `12 Sivan 5787` · en, eve → `Eve of 13 Sivan 5787`
 */
export function formatHebrewDate(date: ISODate, mode: 'day' | 'eve', locale: Locale): string {
  const { y, m, d } = parseISODate(date);
  let hd = new HDate(new Date(y, m - 1, d));
  if (mode === 'eve') hd = hd.next();
  const monthEn = hd.getMonthName();
  if (locale === 'he') {
    const month = HebcalLocale.gettext(monthEn, 'he-x-NoNikud');
    const text = `${gematriya(hd.getDate())} ב${month} ${gematriya(hd.getFullYear())}`;
    return mode === 'eve' ? `אור ל${text}` : text;
  }
  const text = `${hd.getDate()} ${monthEn} ${hd.getFullYear()}`;
  return mode === 'eve' ? `Eve of ${text}` : text;
}

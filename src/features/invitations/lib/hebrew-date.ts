import { HDate, Locale as HebcalLocale, gematriya } from '@hebcal/core';
import type { ISODate, InvitationDocument, Locale } from '../contracts/types';
import { parseISODate } from './dates';

/**
 * The Hebrew months in the other languages, as a date writes them — Nisan (1) … Adar II (13); a
 * common year's Adar is month 12. Russian in the genitive ("12 сивана"); French, Spanish and Arabic
 * as CLDR spells them.
 */
const MONTHS: Record<Exclude<Locale, 'he' | 'en'>, { months: readonly string[]; adar: string }> = {
  ru: {
    months: [
      'нисана',
      'ияра',
      'сивана',
      'таммуза',
      'ава',
      'элула',
      'тишрея',
      'хешвана',
      'кислева',
      'тевета',
      'швата',
      'адара I',
      'адара II',
    ],
    adar: 'адара',
  },
  ar: {
    months: [
      'نيسان',
      'أيار',
      'سيفان',
      'تموز',
      'آب',
      'أيلول',
      'تشري',
      'مرحشوان',
      'كيسلو',
      'طيفت',
      'شباط',
      'آذار الأول',
      'آذار الثاني',
    ],
    adar: 'آذار',
  },
  fr: {
    months: [
      'nissan',
      'iyar',
      'sivan',
      'tamouz',
      'av',
      'éloul',
      'tichri',
      'hèchvan',
      'kislev',
      'téveth',
      'chevat',
      'adar I',
      'adar II',
    ],
    adar: 'adar',
  },
  es: {
    months: [
      'nisán',
      'iyar',
      'siván',
      'tamuz',
      'av',
      'elul',
      'tishrei',
      'jeshván',
      'kislev',
      'tevet',
      'shevat',
      'adar I',
      'adar II',
    ],
    adar: 'adar',
  },
  am: {
    months: [
      'ኒሳን',
      'ኢያር',
      'ሲቫን',
      'ታሙዝ',
      'አቭ',
      'ኤሉል',
      'ቲሽሪ',
      'ሄሽቫን',
      'ኪስሌቭ',
      'ቴቬት',
      'ሽቫት',
      'አዳር 1',
      'አዳር 2',
    ],
    adar: 'አዳር',
  },
};

/** "<day> <month> <year>" per language, and the evening before ('eve'). */
const PHRASE: Record<Exclude<Locale, 'he' | 'en'>, { day: string; eve: string }> = {
  ru: { day: '{d} {m} {y}', eve: 'Канун {d} {m} {y}' },
  ar: { day: '{d} {m} {y}', eve: 'ليلة {d} {m} {y}' },
  fr: { day: '{d} {m} {y}', eve: 'Veille du {d} {m} {y}' },
  es: { day: '{d} de {m} de {y}', eve: 'Víspera del {d} de {m} de {y}' },
  am: { day: '{d} {m} {y}', eve: 'የ{d} {m} {y} ዋዜማ' },
};

/**
 * Hebrew calendar date of a Gregorian date, via @hebcal/core.
 * - he, day  → `י״ב בסיון תשפ״ז`
 * - he, eve  → `אור לי״ג בסיון תשפ״ז` (the Hebrew date that starts at sunset of that evening)
 * - en, day  → `12 Sivan 5787` · en, eve → `Eve of 13 Sivan 5787`
 * - ru `12 сивана 5787` · ar `12 سيفان 5787` · fr `12 sivan 5787` · es `12 de siván de 5787` ·
 *   am `12 ሲቫን 5787` (and their evening-before forms)
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
  if (locale === 'en') {
    const text = `${hd.getDate()} ${monthEn} ${hd.getFullYear()}`;
    return mode === 'eve' ? `Eve of ${text}` : text;
  }
  const { months, adar } = MONTHS[locale];
  const n = hd.getMonth(); // 1 = Nisan … 12 = Adar (I), 13 = Adar II
  const month = n === 12 && !hd.isLeapYear() ? adar : (months[n - 1] ?? monthEn);
  return PHRASE[locale][mode]
    .replace('{d}', String(hd.getDate()))
    .replace('{m}', month)
    .replace('{y}', String(hd.getFullYear()));
}

/** Whether a language shows the Hebrew date: the host's list — or, without one, Hebrew and English. */
export function showsHebrewDate(event: InvitationDocument['event'], locale: Locale): boolean {
  if (event.hebrewDate === 'off') return false;
  const list = event.hebrewDateLocales;
  return list ? list.includes(locale) : locale === 'he' || locale === 'en';
}

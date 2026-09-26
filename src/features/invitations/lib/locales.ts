import { FREE_LOCALES, LOCALES, dirOf, type Locale } from '../contracts/types';

/**
 * The invitation languages (§3 `Locale`): what each one is called, the script it is written in and how
 * it writes dates, times and numbers. The single place a new language is described — the renderer,
 * the fonts, the editor, the guest list and WhatsApp read it from here.
 */

export type Script = 'hebrew' | 'latin' | 'cyrillic' | 'arabic' | 'ethiopic';
export const SCRIPTS = ['hebrew', 'latin', 'cyrillic', 'arabic', 'ethiopic'] as const satisfies readonly Script[];

export interface LocaleInfo {
  /** the language's name in itself: "Русский" */
  native: string;
  /** its English name (docs, logs, the translation prompt) */
  english: string;
  script: Script;
  /**
   * The Intl locale of dates, times, numbers and plurals. Latin digits everywhere: Arabic asks for
   * them (`-u-nu-latn`), as Israeli Arabic invitations write them.
   */
  intl: string;
  /** the clock when the host leaves the time format on automatic */
  clock: '24h' | '12h';
  /** the first day of the week (CLDR): 1 Monday … 7 Sunday */
  weekStart: 1 | 7;
  /** Open Graph `og:locale` */
  og: string;
  /**
   * The script has letter case: uppercase labels, Latin-style tracking and italics suit it. Hebrew,
   * Arabic and Ethiopic have no case — and Arabic is never letter-spaced (it would break its joins).
   */
  cased: boolean;
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  he: {
    native: 'עברית',
    english: 'Hebrew',
    script: 'hebrew',
    intl: 'he-IL',
    clock: '24h',
    weekStart: 7,
    og: 'he_IL',
    cased: false,
  },
  en: {
    native: 'English',
    english: 'English',
    script: 'latin',
    intl: 'en-GB',
    clock: '12h',
    weekStart: 1,
    og: 'en_GB',
    cased: true,
  },
  ru: {
    native: 'Русский',
    english: 'Russian',
    script: 'cyrillic',
    intl: 'ru-RU',
    clock: '24h',
    weekStart: 1,
    og: 'ru_RU',
    cased: true,
  },
  ar: {
    native: 'العربية',
    english: 'Arabic',
    script: 'arabic',
    intl: 'ar-IL-u-nu-latn',
    clock: '12h',
    weekStart: 7,
    og: 'ar_AR',
    cased: false,
  },
  fr: {
    native: 'Français',
    english: 'French',
    script: 'latin',
    intl: 'fr-FR',
    clock: '24h',
    weekStart: 1,
    og: 'fr_FR',
    cased: true,
  },
  es: {
    native: 'Español',
    english: 'Spanish',
    script: 'latin',
    intl: 'es-ES',
    clock: '24h',
    weekStart: 1,
    og: 'es_ES',
    cased: true,
  },
  am: {
    native: 'አማርኛ',
    english: 'Amharic',
    script: 'ethiopic',
    intl: 'am-ET',
    clock: '12h',
    weekStart: 7,
    og: 'am_ET',
    cased: false,
  },
};

export const isLocale = (v: unknown): v is Locale => (LOCALES as readonly unknown[]).includes(v);
/** Every language by its own name ("Русский") — how language pickers and lists show them. */
export const NATIVE_NAMES = Object.fromEntries(LOCALES.map((l) => [l, LOCALE_INFO[l].native])) as Record<
  Locale,
  string
>;
export const scriptOf = (l: Locale): Script => LOCALE_INFO[l].script;
export const nativeName = (l: Locale): string => LOCALE_INFO[l].native;
export { dirOf };

/** The scripts a set of languages is written in (each once, in the languages' order). */
export function scriptsOf(locales: readonly Locale[]): Script[] {
  return [...new Set(locales.map(scriptOf))];
}

/** A language every event may use (Hebrew, English); the others need the `languages` feature. */
export const isFreeLocale = (l: Locale): boolean => (FREE_LOCALES as readonly Locale[]).includes(l);
/** The languages of `locales` that need the `languages` feature. */
export const paidLocales = (locales: readonly Locale[]): Locale[] => locales.filter((l) => !isFreeLocale(l));

/**
 * The host app's language (Hebrew or English) for what the platform writes to the host about an
 * invitation (RSVP emails): its default language when that is one of them, else the first of its
 * languages that is, else Hebrew.
 */
export function hostLanguageOf(doc: { locales: readonly Locale[]; defaultLocale: Locale }): 'he' | 'en' {
  const pick = [doc.defaultLocale, ...doc.locales].find((l) => l === 'he' || l === 'en');
  return pick === 'en' ? 'en' : 'he';
}

/**
 * The first of the browser's languages (`navigator.languages`: 'ru-RU', 'ar', 'iw', 'fr-CA'…) that
 * the invitation has — by the language itself, whatever the region — or null when none is.
 */
export function bestLocale(preferred: readonly string[], available: readonly Locale[]): Locale | null {
  for (const tag of preferred) {
    let base = tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
    if (base === 'iw') base = 'he'; // the old code for Hebrew (older Android, Java)
    if (isLocale(base) && available.includes(base)) return base;
  }
  return null;
}

/**
 * What a spreadsheet's "language" cell says, as a language: a code ('ru', 'RUS', 'ru-RU'), or the
 * language's name in itself, in Hebrew, in English or in the other languages ("Русский", "רוסית",
 * "Russian", "العربية"…). Case, accents and punctuation don't matter. null when it isn't one of ours.
 */
export function parseLanguage(input: string | null | undefined): Locale | null {
  const key = normalizeName(input ?? '');
  if (!key) return null;
  const code = key.replace(/\s+/g, '').split(/[-_]/)[0] ?? '';
  if (isLocale(code)) return code;
  return NAME_INDEX.get(key) ?? NAME_INDEX.get(code) ?? null;
}

/** Lower case, no diacritics (é → e, إ → ا), no punctuation, single spaces. */
function normalizeName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every way a guest list may name a language: ISO 639-2 codes, and the names in our seven languages. */
const LANGUAGE_NAMES: Record<Locale, readonly string[]> = {
  he: ['heb', 'iw', 'hebrew', 'עברית', 'иврит', 'hébreu', 'hebreo', 'العبرية', 'عبري', 'عبرية', 'ዕብራይስጥ', 'ivrit'],
  en: [
    'eng',
    'english',
    'אנגלית',
    'английский',
    'anglais',
    'inglés',
    'الإنجليزية',
    'الانجليزية',
    'انجليزي',
    'إنجليزي',
    'እንግሊዝኛ',
  ],
  ru: ['rus', 'russian', 'русский', 'рус', 'רוסית', 'russe', 'ruso', 'الروسية', 'روسي', 'ራሽያኛ', 'ሩስያኛ'],
  ar: ['ara', 'arabic', 'العربية', 'عربي', 'عربية', 'ערבית', 'арабский', 'arabe', 'árabe', 'ዓረብኛ', 'አረብኛ'],
  fr: [
    'fra',
    'fre',
    'french',
    'français',
    'צרפתית',
    'французский',
    'francés',
    'الفرنسية',
    'فرنسي',
    'ፈረንሳይኛ',
  ],
  es: ['spa', 'spanish', 'español', 'ספרדית', 'испанский', 'espagnol', 'الإسبانية', 'اسباني', 'ስፓኒሽ', 'ስፓንኛ'],
  am: ['amh', 'amharic', 'አማርኛ', 'אמהרית', 'амхарский', 'amharique', 'amhárico', 'الأمهرية', 'أمهري', 'امهري'],
};

const NAME_INDEX = new Map<string, Locale>();
for (const l of LOCALES) {
  NAME_INDEX.set(normalizeName(LOCALE_INFO[l].native), l);
  NAME_INDEX.set(normalizeName(LOCALE_INFO[l].english), l);
  for (const name of LANGUAGE_NAMES[l]) NAME_INDEX.set(normalizeName(name), l);
}

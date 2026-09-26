import { LOCALES, type Locale } from '../contracts/types';
import { LOCALE_INFO, isLocale } from './locales';

/**
 * Every way a guest list may name a language (the import's "language" column) — kept apart from
 * lib/locales, which the guest's page loads: only the host's screens need these tables.
 */

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
  he: [
    'heb',
    'iw',
    'hebrew',
    'עברית',
    'иврит',
    'hébreu',
    'hebreo',
    'العبرية',
    'عبري',
    'عبرية',
    'ዕብራይስጥ',
    'ivrit',
  ],
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
  fr: ['fra', 'fre', 'french', 'français', 'צרפתית', 'французский', 'francés', 'الفرنسية', 'فرنسي', 'ፈረንሳይኛ'],
  es: ['spa', 'spanish', 'español', 'ספרדית', 'испанский', 'espagnol', 'الإسبانية', 'اسباني', 'ስፓኒሽ', 'ስፓንኛ'],
  am: [
    'amh',
    'amharic',
    'አማርኛ',
    'אמהרית',
    'амхарский',
    'amharique',
    'amhárico',
    'الأمهرية',
    'أمهري',
    'امهري',
  ],
};

const NAME_INDEX = new Map<string, Locale>();
for (const l of LOCALES) {
  NAME_INDEX.set(normalizeName(LOCALE_INFO[l].native), l);
  NAME_INDEX.set(normalizeName(LOCALE_INFO[l].english), l);
  for (const name of LANGUAGE_NAMES[l]) NAME_INDEX.set(normalizeName(name), l);
}

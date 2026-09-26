/**
 * System strings for the guest invitation, read from the kit dictionaries (§10.4) — never retyped.
 * `extra.<locale>.json` adds the few keys the kit doesn't have (kept separate so the kit stays untouched);
 * the languages beyond the kit's two have one full dictionary each (`<locale>.json`), and a test keeps
 * every key in every language.
 * Plural entries use `{ zero?, one, two?, few?, many?, other }` resolved with Intl.PluralRules
 * (falling back to `other`): Russian has one / few / many, Arabic all six.
 */
import en from '@kit/i18n/invitations.en.json';
import he from '@kit/i18n/invitations.he.json';
import { LOCALES, type Locale } from '../contracts/types';
import { INTL_LOCALE } from '../lib/dates';
import am from './am.json';
import ar from './ar.json';
import es from './es.json';
import extraEn from './extra.en.json';
import extraHe from './extra.he.json';
import fr from './fr.json';
import ru from './ru.json';

export type PluralEntry = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};
export type DictEntry = string | PluralEntry;

export type DictKey = (keyof typeof he & keyof typeof en) | (keyof typeof extraHe & keyof typeof extraEn);

const DICTS: Record<Locale, Record<string, DictEntry>> = {
  he: { ...he, ...extraHe },
  en: { ...en, ...extraEn },
  ru,
  ar,
  fr,
  es,
  am,
};

const pluralRules = new Map<Locale, Intl.PluralRules>();
function pluralCategory(locale: Locale, n: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(INTL_LOCALE[locale])));
  return rules.select(n);
}

/** `plural(locale, entry, n)` — the entry's form for n, falling back to `other`. */
export function plural(locale: Locale, entry: PluralEntry, n: number): string {
  return entry[pluralCategory(locale, n)] ?? entry.other;
}

/** `t(locale, key, { n, date, brand })` — interpolates `{n}`, `{date}`, `{brand}`, … */
export function t(locale: Locale, key: DictKey, vars: Record<string, string | number> = {}): string {
  const entry = DICTS[locale][key] ?? DICTS.en[key] ?? key;
  const text = typeof entry === 'string' ? entry : plural(locale, entry, Number(vars.n ?? 0));
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/**
 * Some keys' raw entries in one language — what a client component gets instead of the dictionaries
 * (the guest's page ships only the strings it shows, in its own language).
 */
export function dictEntries<K extends DictKey>(locale: Locale, keys: readonly K[]): Record<K, DictEntry> {
  const out = {} as Record<K, DictEntry>;
  for (const key of keys) out[key] = DICTS[locale][key] ?? DICTS.en[key] ?? key;
  return out;
}

/** Every key present in every locale (used by tests: no English string may leak into another language). */
export function dictionaryKeys(locale: Locale): string[] {
  return Object.keys(DICTS[locale]);
}

/** A raw entry (tests: plural forms per language). */
export function dictEntry(locale: Locale, key: string): DictEntry | undefined {
  return DICTS[locale][key];
}

export const DICTIONARY_LOCALES: readonly Locale[] = LOCALES;

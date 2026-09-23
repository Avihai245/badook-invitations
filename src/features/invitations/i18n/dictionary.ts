/**
 * System strings for the guest invitation, read from the kit dictionaries (§10.4) — never retyped.
 * `extra.<locale>.json` adds the few keys the kit doesn't have (kept separate so the kit stays untouched).
 * Plural entries use `{ one, other }` resolved with Intl.PluralRules (falling back to `other`).
 */
import en from '@kit/i18n/invitations.en.json';
import he from '@kit/i18n/invitations.he.json';
import type { Locale } from '../contracts/types';
import { INTL_LOCALE } from '../lib/dates';
import extraEn from './extra.en.json';
import extraHe from './extra.he.json';

type PluralEntry = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
type Entry = string | PluralEntry;

export type DictKey = (keyof typeof he & keyof typeof en) | (keyof typeof extraHe & keyof typeof extraEn);

const DICTS: Record<Locale, Record<string, Entry>> = { he: { ...he, ...extraHe }, en: { ...en, ...extraEn } };

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

/** Every key present in every locale (used by tests: no English string may leak into HE). */
export function dictionaryKeys(locale: Locale): string[] {
  return Object.keys(DICTS[locale]);
}

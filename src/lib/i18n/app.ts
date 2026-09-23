import { en } from './app.en';
import { he, type AppDict } from './app.he';

export type { AppDict };
export type UiLocale = 'he' | 'en';
export const UI_LOCALES: readonly UiLocale[] = ['he', 'en'];
export const UI_LOCALE_COOKIE = 'ui_lang';

export const isUiLocale = (v: unknown): v is UiLocale => v === 'he' || v === 'en';
export const uiDir = (l: UiLocale) => (l === 'he' ? 'rtl' : 'ltr');
export const dictFor = (l: UiLocale): AppDict => (l === 'en' ? en : he);
/** Intl locale for dates/numbers in the host app (§9B.3-H: numbers and dates always via Intl). */
export const intlLocale = (l: UiLocale) => (l === 'he' ? 'he-IL' : 'en-GB');

/** '{name}' placeholders → values (unknown placeholders stay verbatim). */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type PluralEntry = { one: string; other: string } & Partial<Record<'two' | 'many' | 'few' | 'zero', string>>;

/** Picks the plural form with Intl.PluralRules (fallback `other`) and fills {n} plus `vars`. */
export function plural(
  locale: UiLocale,
  entry: PluralEntry,
  n: number,
  vars: Record<string, string | number> = {},
): string {
  const rule = new Intl.PluralRules(intlLocale(locale)).select(n) as keyof PluralEntry;
  return fmt(entry[rule] ?? entry.other, { n, ...vars });
}

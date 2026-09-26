import { RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { LOCALE_INFO } from '@/features/invitations/lib/locales';

/**
 * Strings and formatting for the pages guests (and event staff) open without an account — the live
 * gallery's, the table guide, the entrance station: each has a small dictionary of its own (their
 * phones don't download the host app's), in the invitation's language — any of its seven.
 */

export type GuestLocale = Locale;
/** A plural entry: every CLDR category a language may need (Russian few/many, Arabic zero…many). */
export type PluralEntry = { one: string; other: string } & Partial<
  Record<'two' | 'many' | 'few' | 'zero', string>
>;

/** '{name}' placeholders → values (unknown placeholders stay verbatim). */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Each language's own Intl locale (Arabic with Latin digits: ar-IL-u-nu-latn). */
const intl = (l: GuestLocale) => LOCALE_INFO[l].intl;

export interface LocaleText<D> {
  locale: GuestLocale;
  dir: 'rtl' | 'ltr';
  t: D;
  plural(entry: PluralEntry, n: number, vars?: Record<string, string | number>): string;
  number(n: number): string;
  date(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string;
}

export function localeText<D>(locale: GuestLocale, t: D): LocaleText<D> {
  const rules = new Intl.PluralRules(intl(locale));
  return {
    locale,
    dir: RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr',
    t,
    plural: (entry, n, vars = {}) =>
      fill(entry[rules.select(n) as keyof PluralEntry] ?? entry.other, {
        n: new Intl.NumberFormat(intl(locale)).format(n),
        ...vars,
      }),
    number: (n) => new Intl.NumberFormat(intl(locale)).format(n),
    date: (value, options = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) =>
      new Intl.DateTimeFormat(intl(locale), options).format(new Date(value)),
  };
}

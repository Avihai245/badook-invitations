/**
 * Strings and formatting for the pages guests (and event staff) open without an account — the live
 * gallery's, the table guide, the entrance station: each has a small dictionary of its own (their
 * phones don't download the host app's), in the invitation's language.
 */

export type GuestLocale = 'he' | 'en';
export type PluralEntry = { one: string; other: string } & Partial<
  Record<'two' | 'many' | 'few' | 'zero', string>
>;

/** '{name}' placeholders → values (unknown placeholders stay verbatim). */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const intl = (l: GuestLocale) => (l === 'he' ? 'he-IL' : 'en-GB');

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
    dir: locale === 'he' ? 'rtl' : 'ltr',
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

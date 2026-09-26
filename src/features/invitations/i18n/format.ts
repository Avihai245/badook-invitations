/**
 * Formats one dictionary entry — a string, or plural forms picked with Intl.PluralRules — without the
 * dictionaries themselves: client components get the few entries they show from the server
 * (`dictEntries`) and format them here, so the guest's page never downloads every language.
 */
export type PluralForms = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
export type Entry = string | PluralForms;

const rules = new Map<string, Intl.PluralRules>();

/** `{n}` picks the plural form (in the Intl locale `intl`); every `{name}` is interpolated. */
export function formatEntry(
  entry: Entry | undefined,
  intl: string,
  vars: Record<string, string | number> = {},
): string {
  if (entry === undefined) return '';
  let text: string;
  if (typeof entry === 'string') text = entry;
  else {
    let r = rules.get(intl);
    if (!r) rules.set(intl, (r = new Intl.PluralRules(intl)));
    text = entry[r.select(Number(vars.n ?? 0))] ?? entry.other;
  }
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

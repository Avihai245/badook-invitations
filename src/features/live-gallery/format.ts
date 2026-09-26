/** Small formatting helpers of the gallery's pages (isomorphic: server pages and client components). */

/** '{name}' placeholders → values (unknown ones stay as they are). */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const intl = (l: 'he' | 'en') => (l === 'he' ? 'he-IL' : 'en-GB');

/** "12.5 MB" / "480 KB" in the page's language. */
export function formatBytes(bytes: number, locale: 'he' | 'en'): string {
  const nf = (n: number, digits: number) =>
    new Intl.NumberFormat(intl(locale), { maximumFractionDigits: digits }).format(n);
  if (bytes >= 1024 ** 3) return `${nf(bytes / 1024 ** 3, 1)} GB`;
  if (bytes >= 1024 ** 2) return `${nf(bytes / 1024 ** 2, bytes >= 100 * 1024 ** 2 ? 0 : 1)} MB`;
  return `${nf(Math.max(1, Math.round(bytes / 1024)), 0)} KB`;
}

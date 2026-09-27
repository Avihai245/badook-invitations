/** A page's search parameters as Next hands them to a server page. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** One value of a search parameter (a repeated key: the first). */
export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** A value of a closed list, else undefined. */
export function oneOf<T extends string>(v: string | string[] | undefined, list: readonly T[]): T | undefined {
  const s = one(v);
  return s !== undefined && (list as readonly string[]).includes(s) ? (s as T) : undefined;
}

/** A page number: 1 and up (a bad one is the first page). */
export function pageOf(v: string | string[] | undefined): number {
  const n = Number(one(v));
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** A search text: trimmed, at most 100 characters (empty: none). */
export function textOf(v: string | string[] | undefined): string | undefined {
  const s = one(v)?.trim().slice(0, 100);
  return s ? s : undefined;
}

/** A date YYYY-MM-DD that exists, else undefined. */
export function dayOf(v: string | string[] | undefined): string | undefined {
  const s = one(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : undefined;
}

/** A yes filter ('1'). */
export const flagOf = (v: string | string[] | undefined): boolean => one(v) === '1';

/** A UUID, else undefined. */
export function uuidOf(v: string | string[] | undefined): string | undefined {
  const s = one(v);
  return s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? s.toLowerCase()
    : undefined;
}

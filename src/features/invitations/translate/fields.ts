import type { InvitationDocument, L10n, Locale, Section } from '../contracts/types';
import { l10nFields, type FieldKey } from '../contracts/validate';

/**
 * The texts of an invitation as the translation sees them (isomorphic and pure: the server runs the
 * machine translation and the publish check, the editor shows the review). A text is addressed by a
 * stable path — sections and list items by their ids, not their positions — so a translation keeps
 * pointing at its text when sections or items move.
 */

/** Names — of people and places — and signs: the host writes them in each language, never the machine. */
export const NAME_FIELDS: ReadonlySet<FieldKey> = new Set<FieldKey>([
  'hosts.primary',
  'hosts.secondary',
  'hosts.joiner',
  'hosts.parents',
  'cover.monogram',
  'venue.name',
  'parents.names',
]);

export interface TextField {
  /** stable: `sections.@<section id>.data.items.@<item id>.label` */
  path: string;
  /** where it is in the document now: `sections.3.data.items.0.label` */
  docPath: string;
  field: FieldKey;
  value: L10n;
  /** the §3 length cap, when the text has one */
  cap?: number;
  section?: Section;
  /** a name: written by the host in each language, never translated */
  name: boolean;
}

/** A translation as stored (supabase/migrations/*_translations.sql). */
export interface TranslationRow {
  id: string;
  locale: Locale;
  path: string;
  sourceLocale: Locale;
  sourceHash: string;
  text: string;
  status: 'auto' | 'approved' | 'stale';
  updatedAt: string;
}

/**
 * Where a translation stands against the document now:
 * - machine: the machine's text, not approved yet (blocks publishing)
 * - stale: its source changed since it was made or approved (blocks publishing)
 * - approved: the machine's text, approved by the host
 * - own: the host changed the text since — their own words count as approved
 * - gone: the text, or the language, is no longer in the invitation
 */
export type TranslationState = 'machine' | 'stale' | 'approved' | 'own' | 'gone';

const isIndex = (s: string) => /^\d+$/.test(s);

/** An index path → the stable one (`sections.2.data.items.1.q` → `sections.@s3.data.items.@q2.q`). */
export function stablePath(doc: InvitationDocument, docPath: string): string {
  let node: unknown = doc;
  const out: string[] = [];
  for (const part of docPath.split('.')) {
    if (Array.isArray(node) && isIndex(part)) {
      const item = node[Number(part)] as Record<string, unknown> | undefined;
      const key =
        typeof item?.id === 'string' ? item.id : typeof item?.value === 'string' ? item.value : null;
      out.push(key === null ? part : `@${key}`);
      node = item;
    } else {
      out.push(part);
      node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
    }
  }
  return out.join('.');
}

/** A stable path → where that text is in the document now (null: it isn't there any more). */
export function docPathOf(doc: InvitationDocument, path: string): string | null {
  let node: unknown = doc;
  const out: string[] = [];
  for (const part of path.split('.')) {
    if (Array.isArray(node)) {
      const index = part.startsWith('@')
        ? node.findIndex((item: Record<string, unknown> | null) => {
            const key = part.slice(1);
            return item?.id === key || item?.value === key;
          })
        : isIndex(part)
          ? Number(part)
          : -1;
      if (index < 0 || index >= node.length) return null;
      out.push(String(index));
      node = node[index];
    } else {
      if (!node || typeof node !== 'object') return null;
      out.push(part);
      node = (node as Record<string, unknown>)[part];
    }
  }
  return out.join('.');
}

/** The texts a guest can see (hidden sections and switched-off options left out), with stable paths. */
export function textFields(doc: InvitationDocument): TextField[] {
  const out: TextField[] = [];
  for (const f of l10nFields(doc)) {
    if (!f.value || f.unused) continue;
    out.push({
      path: stablePath(doc, f.path),
      docPath: f.path,
      field: f.field,
      value: f.value,
      cap: f.cap,
      section: f.section,
      name: NAME_FIELDS.has(f.field),
    });
  }
  return out;
}

const text = (value: L10n | null | undefined, locale: Locale) => (value?.[locale] ?? '').trim();

/**
 * The language a text is translated from into `target`: the invitation's default language when the
 * text is written in it, else the first of its languages that has it. null: nothing to translate from.
 */
export function sourceLocaleOf(doc: InvitationDocument, value: L10n, target: Locale): Locale | null {
  const order = [doc.defaultLocale, ...doc.locales.filter((l) => l !== doc.defaultLocale)];
  return order.find((l) => l !== target && text(value, l)) ?? null;
}

/**
 * A short fingerprint of a source text (64 bits, hex) — the same in the browser and on the server, so
 * a change to the source is noticed wherever the translation is looked at.
 */
export function sourceHash(value: string): string {
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** The value of the text at a stable path now (null: gone). */
export function valueAt(doc: InvitationDocument, path: string): L10n | null {
  const at = docPathOf(doc, path);
  if (at === null) return null;
  let node: unknown = doc;
  for (const part of at.split('.')) node = (node as Record<string, unknown> | null)?.[part];
  return node && typeof node === 'object' ? (node as L10n) : null;
}

export function translationState(doc: InvitationDocument, row: TranslationRow): TranslationState {
  if (!doc.locales.includes(row.locale)) return 'gone';
  const value = valueAt(doc, row.path);
  if (!value) return 'gone';
  const current = text(value, row.locale);
  if (!current) return 'gone';
  if (current !== row.text.trim()) return 'own';
  if (row.status === 'stale' || sourceHash(text(value, row.sourceLocale)) !== row.sourceHash) return 'stale';
  return row.status === 'approved' ? 'approved' : 'machine';
}

/** Translations the host still has to look at: the machine's, not approved, or gone stale. */
export function pendingReview(doc: InvitationDocument, rows: readonly TranslationRow[]): TranslationRow[] {
  return rows.filter((r) => {
    const state = translationState(doc, r);
    return state === 'machine' || state === 'stale';
  });
}

/** The languages publishing waits for: each with machine text the host hasn't approved. */
export function blockedLocales(doc: InvitationDocument, rows: readonly TranslationRow[]): Locale[] {
  return [...new Set(pendingReview(doc, rows).map((r) => r.locale))];
}

/** Placeholders a text must keep as they are ({primary}, {date}, {guest}…), sorted. */
export function placeholders(value: string): string[] {
  return (value.match(/\{[A-Za-z]+\}/g) ?? []).sort();
}

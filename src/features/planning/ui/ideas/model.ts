import type { IdeaColor, IdeaType } from '../../model/categories';
import type { OgPreview, PlanIdea } from '../../model/plan';
import { isWebUrl, type IdeaPatchInput } from '../../model/schemas-ideas';

/** The pure logic of the ideas board: reading the composer, ordering, searching, the editor's draft. */

export const MAX_TITLE = 160;
export const MAX_BODY = 5000;
export const MAX_URL = 1000;
export const MAX_TAGS = 12;
export const MAX_TAG = 30;
export const MAX_LINES = 100;
export const MAX_LINE = 200;
export const MAX_IDEAS = 500;

/** An id for a new card: the browser's own, or (where it has none: a page over plain http) a random v4. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Only an http(s) address is ever a link or a picture on the page (whatever the database holds). */
export const webHref = (value: string | null | undefined, https = false): string | undefined =>
  value && (https ? /^https:\/\//i : /^https?:\/\//i).test(value) ? value : undefined;

// ─── the composer ───────────────────────────────────────────────────────────────────────────────

/**
 * An address as the host wrote it, as one the card can hold: http(s) with at most 1000 characters; a
 * bare "www.example.com/…" or "example.com/…" gets https://. Null when it is not an address.
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text)
    ? text
    : /^[^\s/:@]+\.[^\s/:@]{2,}(?:[/?#:]\S*)?$/.test(text)
      ? `https://${text}`
      : null;
  if (!withScheme || withScheme.length > MAX_URL || !isWebUrl(withScheme)) return null;
  return withScheme;
}

export type Composed = { type: 'link'; url: string } | { type: 'note'; body: string };

/**
 * What the one-line composer holds: a pasted link (an http(s):// address, or one starting with www.) is a
 * link card; anything else is a note. Null when it is empty.
 */
export function parseComposer(text: string): Composed | null {
  const t = text.trim();
  if (!t) return null;
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) {
    const url = normalizeUrl(t);
    if (url) return { type: 'link', url };
  }
  return { type: 'note', body: t.slice(0, MAX_BODY) };
}

/** "example.com" for a card's address (no www.), or the address itself when it cannot be read. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

/** A link as a card shows it when the page has no title of its own: "example.com/hall" (no scheme, www, query or trailing slash). */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./i, '')}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url;
  }
}

// ─── the board ──────────────────────────────────────────────────────────────────────────────────

/** The database's order: pinned first, then by `sort`, then the newest. */
export const byBoard = (a: PlanIdea, b: PlanIdea): number =>
  Number(b.pinned) - Number(a.pinned) || a.sort - b.sort || b.createdAt.localeCompare(a.createdAt);

/** The tags in use, most used first. */
export function tagCounts(ideas: readonly PlanIdea[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const idea of ideas) for (const tag of idea.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

const fold = (s: string) => s.toLocaleLowerCase();

/** Whether a card is found by the search box (title, text, address, tags, the preview's words) and the tag filter. */
export function matchesIdea(idea: PlanIdea, query: string, tag: string | null): boolean {
  if (tag && !idea.tags.includes(tag)) return false;
  const q = fold(query.trim());
  if (!q) return true;
  const haystack = [
    idea.title,
    idea.body,
    idea.url,
    idea.ogPreview?.title,
    idea.ogPreview?.description,
    idea.ogPreview?.site,
    ...idea.tags,
    ...idea.items.map((l) => l.text),
  ]
    .filter((s): s is string => !!s)
    .map(fold)
    .join('\n');
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** What a card is called: its own title, else its page's. */
export const ideaTitle = (idea: Pick<PlanIdea, 'title' | 'ogPreview'>): string | null =>
  idea.title || idea.ogPreview?.title || null;

/** A card that is not saved yet: a new one at the top of the board (the server sets the same). */
export function localIdea(
  fields: Partial<Omit<PlanIdea, 'id' | 'createdAt'>>,
  id: string,
  ideas: readonly PlanIdea[],
  now: number,
): PlanIdea {
  return {
    id,
    type: 'note',
    title: null,
    body: null,
    url: null,
    ogPreview: null,
    imagePath: null,
    color: 'default',
    tags: [],
    pinned: false,
    items: [],
    linkedTaskId: null,
    linkedVendorId: null,
    linkedBudgetItemId: null,
    sort: ideas.length ? Math.min(...ideas.map((i) => i.sort)) - 10 : -10,
    createdAt: new Date(now).toISOString(),
    ...fields,
  };
}

/** The fields to send to put a deleted card back as it was (Undo). */
export function restorePatch(idea: PlanIdea): IdeaPatchInput {
  return {
    id: idea.id,
    type: idea.type,
    title: idea.title,
    body: idea.body,
    url: idea.url,
    ogPreview: idea.ogPreview,
    imagePath: idea.imagePath,
    color: idea.color,
    tags: idea.tags,
    pinned: idea.pinned,
    items: idea.items,
    sort: idea.sort,
  };
}

// ─── turning a card into something ──────────────────────────────────────────────────────────────

const firstLine = (s: string) =>
  s
    .split('\n')
    .find((l) => l.trim())
    ?.trim() ?? '';

/** A name for what a card becomes: its title, else the first line of its text, else its page's title or host. */
export function suggestName(idea: PlanIdea, max: number): string {
  const name =
    idea.title?.trim() ||
    firstLine(idea.body ?? '') ||
    idea.ogPreview?.title ||
    (idea.url ? hostnameOf(idea.url) : '') ||
    idea.items[0]?.text ||
    '';
  return Array.from(name).slice(0, max).join('').trim();
}

/** The notes a card brings along: its text (and checklist), and its address. */
export function suggestNotes(idea: PlanIdea, max: number): string {
  const lines = [
    idea.body?.trim(),
    ...idea.items.map((l) => `${l.done ? '✓' : '○'} ${l.text}`),
    idea.url,
  ].filter((s): s is string => !!s);
  return lines.join('\n').slice(0, max);
}

// ─── the editor's draft ─────────────────────────────────────────────────────────────────────────

export interface IdeaDraft {
  type: IdeaType;
  title: string;
  body: string;
  url: string;
  imagePath: string | null;
  color: IdeaColor;
  tags: string[];
  pinned: boolean;
  items: { text: string; done: boolean }[];
}

export const emptyDraft = (type: IdeaType = 'note'): IdeaDraft => ({
  type,
  title: '',
  body: '',
  url: '',
  imagePath: null,
  color: 'default',
  tags: [],
  pinned: false,
  items: type === 'list' ? [{ text: '', done: false }] : [],
});

export const draftOf = (idea: PlanIdea): IdeaDraft => ({
  type: idea.type,
  title: idea.title ?? '',
  body: idea.body ?? '',
  url: idea.url ?? '',
  imagePath: idea.imagePath,
  color: idea.color,
  tags: idea.tags,
  pinned: idea.pinned,
  items: idea.items.length ? idea.items : idea.type === 'list' ? [{ text: '', done: false }] : [],
});

/** A tag as typed: trimmed, a leading # dropped, at most 30 characters. */
export const cleanTag = (s: string): string => s.trim().replace(/^#+/, '').trim().slice(0, MAX_TAG);

/** Adds typed tags (separated by commas) to a list: no repeats, at most twelve. */
export function addTags(tags: readonly string[], typed: string): string[] {
  const out = [...tags];
  for (const raw of typed.split(/[,،\n]/)) {
    const tag = cleanTag(raw);
    if (tag && !out.includes(tag) && out.length < MAX_TAGS) out.push(tag);
  }
  return out;
}

/** Whether a draft says anything (the board has no empty cards). */
export function draftHasContent(d: IdeaDraft): boolean {
  return !!(
    d.title.trim() ||
    d.body.trim() ||
    d.url.trim() ||
    d.imagePath ||
    d.items.some((l) => l.text.trim())
  );
}

/**
 * The changes a draft makes to a card (all the fields for a new one): only what differs, so a save never
 * overwrites what someone else changed meanwhile. The page's preview is dropped when the address changes.
 */
export function draftPatch(d: IdeaDraft, original?: PlanIdea): IdeaPatchInput {
  const url = d.url.trim() ? (normalizeUrl(d.url) ?? d.url.trim()) : null;
  const items = d.items.map((l) => ({ text: l.text.trim(), done: l.done })).filter((l) => l.text);
  // a card is what it holds: a link without an address, a picture without a file or a checklist without
  // lines is a note
  const type: IdeaType =
    (d.type === 'link' && !url) ||
    (d.type === 'image' && !d.imagePath) ||
    (d.type === 'list' && !items.length)
      ? 'note'
      : d.type;
  const next = {
    type,
    title: d.title.trim() || null,
    body: d.body.trim() || null,
    url,
    imagePath: d.imagePath,
    color: d.color,
    tags: d.tags,
    pinned: d.pinned,
    items,
  };
  if (!original) return next;
  const patch: Record<string, unknown> = {};
  const before = {
    type: original.type,
    title: original.title,
    body: original.body,
    url: original.url,
    imagePath: original.imagePath,
    color: original.color,
    tags: original.tags,
    pinned: original.pinned,
    items: original.items,
  };
  for (const key of Object.keys(next) as (keyof typeof next)[])
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) patch[key] = next[key];
  if ('url' in patch && original.ogPreview) patch.ogPreview = null;
  return patch as IdeaPatchInput;
}

/** A preview as the card holds it: only what the page offered. */
export const hasPreview = (p: OgPreview | null): p is OgPreview =>
  !!p && !!(p.title || p.description || p.image || p.site);

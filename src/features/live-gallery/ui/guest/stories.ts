import type { FeedItem } from '../../types';

/**
 * The feed as stories: what each person uploaded, one story per person, played oldest first. A named
 * guest is one person by their name (two phones with the same name are one story); an unnamed guest
 * is told apart by the feed's opaque `by` key (a name typed later joins what the same phone sent
 * before); the hosts' own items are one story. Without a `by` (an older answer) unnamed items share one.
 */

export interface Story {
  /** a stable key for the person: their name, else the opaque uploader key, else 'anon' */
  key: string;
  /** null for the hosts and for guests who gave no name */
  name: string | null;
  host: boolean;
  /** which unnamed guest this is (1, 2…), by who came first; null when named or the hosts */
  anonymous: number | null;
  /** oldest first: the order a story plays */
  items: FeedItem[];
  /** the newest item, for the ring (new since this phone last looked) */
  newestId: string;
  newestAt: string;
}

const tidy = (name: string | null | undefined) => (name ?? '').trim().replace(/\s+/g, ' ');
const nameKey = (name: string) => `n:${name.toLocaleLowerCase()}`;

/** `feed` is the feed's order, newest first. Stories come out newest activity first. */
export function groupStories(feed: readonly FeedItem[]): Story[] {
  // a phone's name: the newest one it gave, for the items it sent before it typed one
  const nameOfUploader = new Map<string, string>();
  for (const item of feed) {
    const name = tidy(item.name);
    if (item.by && name && !nameOfUploader.has(item.by)) nameOfUploader.set(item.by, name);
  }

  const groups = new Map<string, { name: string | null; host: boolean; items: FeedItem[] }>();
  for (const item of feed) {
    const host = item.by === 'host';
    const name = host ? '' : tidy(item.name) || (item.by ? (nameOfUploader.get(item.by) ?? '') : '');
    const key = host ? 'host' : name ? nameKey(name) : item.by ? `b:${item.by}` : 'anon';
    const group = groups.get(key);
    // the first name met is the newest: the spelling the story shows
    if (group) group.items.push(item);
    else groups.set(key, { name: name || null, host, items: [item] });
  }

  const stories: Story[] = [...groups.entries()].map(([key, g]) => {
    const items = [...g.items].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    const newest = items[items.length - 1]!;
    return {
      key,
      name: g.name,
      host: g.host,
      anonymous: null,
      items,
      newestId: newest.id,
      newestAt: newest.at,
    };
  });

  // "Guest 1, Guest 2": numbered by who uploaded first, so a number never moves when others join
  stories
    .filter((s) => !s.name && !s.host)
    .sort((a, b) => (a.items[0]!.at < b.items[0]!.at ? -1 : 1))
    .forEach((s, i) => {
      s.anonymous = i + 1;
    });

  return stories.sort((a, b) => (a.newestAt < b.newestAt ? 1 : a.newestAt > b.newestAt ? -1 : 0));
}

/** "5m ago", "2 hours ago", "yesterday", in the page's language; '' when the browser can't say. */
export function ago(iso: string, now: number, intl: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  try {
    const rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto', style: 'short' });
    if (seconds < 45) return rtf.format(0, 'second');
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.round(hours / 24), 'day');
  } catch {
    return '';
  }
}

// ── what this phone has already watched (a ring that turns grey), kept on the phone only ──

const seenKey = (token: string) => `badook-gallery:seen:${token.slice(0, 10)}`;

/** story key → the newest item id watched */
export function readSeen(token: string): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(seenKey(token)) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

export function writeSeen(token: string, seen: Record<string, string>): void {
  try {
    // a long party: keep the newest 300 entries
    const entries = Object.entries(seen).slice(-300);
    localStorage.setItem(seenKey(token), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // private mode: the rings simply start fresh next time
  }
}

export const isUnseen = (story: Story, seen: Record<string, string>) => seen[story.key] !== story.newestId;

import type {
  HHmm,
  ISODate,
  InvitationDocument,
  L10n,
  TimelineIcon,
} from '@/features/invitations/contracts/types';
import { addDaysISO, zonedTimeToUtc } from '@/features/invitations/lib/dates';
import { qualityScore, sameMoment, spread, type FilmCandidate } from '@/features/film/select';
import { ALBUM } from './config';

/**
 * The album as plain math (tested in tests/unit/album.test.ts): when it opens, its cover and its best
 * moments — weighed like the highlights film weighs its shots (sharpness, exposure, size, the automatic
 * check's quality; one of each moment; spread over the event) — its chapters, from the invitation's
 * own timeline when it has one (the chuppah, the dinner, the party…) or from the pauses between the
 * photos, and the justified rows the page lays the photos out in. Isomorphic.
 */

/** Where the album stands for guests: open, not yet (the morning after), or off. */
export type AlbumState = 'open' | 'soon' | 'off';

/**
 * When the album opens: the hosts' own moment, else the morning after the event (ALBUM.opensAt in the
 * event's time zone, the day after its date — an evening that ends after midnight included). null when
 * the event's date can't be read (it is then open).
 */
export function albumOpensAt(
  opensAt: string | null,
  doc: Pick<InvitationDocument, 'event' | 'timezone'>,
): Date | null {
  if (opensAt) {
    const at = new Date(opensAt);
    if (Number.isFinite(at.getTime())) return at;
  }
  try {
    const at = zonedTimeToUtc(addDaysISO(doc.event.date, 1), ALBUM.opensAt, doc.timezone);
    return Number.isFinite(at.getTime()) ? at : null;
  } catch {
    return null;
  }
}

export function albumState(input: {
  /** the event has the feature */
  feature: boolean;
  /** the album is on (the hosts' switch) */
  enabled: boolean;
  /** the gallery it comes from is on */
  galleryEnabled: boolean;
  opensAt: Date | null;
  now: number;
}): AlbumState {
  if (!input.feature || !input.enabled || !input.galleryEnabled) return 'off';
  return !input.opensAt || input.now >= input.opensAt.getTime() ? 'open' : 'soon';
}

/** A photo or video as the album weighs it. */
export interface AlbumEntry {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** when it was taken, else when it entered the gallery (ISO) */
  at: string;
  sharpness: number | null;
  brightness: number | null;
  aiQuality: number | null;
  phash: string | null;
}

const candidate = (e: AlbumEntry): FilmCandidate => ({ ...e, faces: null });
const timeOf = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** 0..1: how good a picture it is, for a page seen on phones and wide screens alike. */
export function albumScore(e: AlbumEntry): number {
  const c = candidate(e);
  return (qualityScore(c, 'vertical') + qualityScore(c, 'horizontal')) / 2;
}

/** The cover: the hosts' choice while it is in the album, else the best photo (null: no photos). */
export function pickCover(entries: readonly AlbumEntry[], chosen: string | null): string | null {
  if (chosen && entries.some((e) => e.id === chosen && e.kind === 'image')) return chosen;
  let best: AlbumEntry | null = null;
  let bestScore = -1;
  for (const e of entries) {
    if (e.kind !== 'image') continue;
    const s = albumScore(e);
    if (s > bestScore) {
      best = e;
      bestScore = s;
    }
  }
  return best?.id ?? null;
}

/**
 * The best moments: up to `count` photos (not the cover), one of each moment, spread over the event,
 * in time order — none for a small album (it would show the same photos twice).
 */
export function pickHighlights(
  entries: readonly AlbumEntry[],
  coverId: string | null,
  count: number = ALBUM.highlights.count,
): string[] {
  if (entries.length < ALBUM.highlights.from) return [];
  const pool = entries
    .filter((e) => e.kind === 'image' && e.id !== coverId)
    .map((e) => ({ e, c: candidate(e), score: albumScore(e), t: timeOf(e.at) }))
    .sort((a, b) => b.score - a.score);
  const distinct: typeof pool = [];
  for (const s of pool) if (!distinct.some((k) => sameMoment(k.c, s.c))) distinct.push(s);
  return spread(distinct, count).map((s) => s.e.id);
}

// ─── chapters ───────────────────────────────────────────────────────────────────────────────────

/** An automatic chapter's place in the event (its name comes from the page's dictionary). */
export type AutoChapter = 'opening' | 'heart' | 'more' | 'ending';

export interface AlbumChapter {
  key: string;
  /** a timeline moment's own words (the invitation's), or null */
  label: L10n | null;
  /** an automatic chapter's name, or null */
  auto: AutoChapter | null;
  icon: TimelineIcon | null;
  /** the timeline moment's time, or null (the page shows its first photo's time) */
  time: HHmm | null;
  /** when its first item was taken (ISO) */
  start: string | null;
  ids: string[];
}

export interface TimelineMoment {
  time: HHmm;
  label: L10n;
  icon: TimelineIcon;
}

/** The invitation's timeline (its first timeline section that is on), when it has one. */
export function timelineOf(doc: Pick<InvitationDocument, 'sections'>): TimelineMoment[] {
  for (const s of doc.sections) {
    if (s.type !== 'timeline' || !s.enabled) continue;
    const items = (s.data as { items?: TimelineMoment[] }).items ?? [];
    return items.filter((i) => /^([01]\d|2[0-3]):[0-5]\d$/.test(i.time));
  }
  return [];
}

interface Timed {
  id: string;
  t: number;
}

const one = (items: Timed[]): AlbumChapter[] => [
  {
    key: 'all',
    label: null,
    auto: null,
    icon: null,
    time: null,
    start: items[0] ? new Date(items[0].t).toISOString() : null,
    ids: items.map((i) => i.id),
  },
];

/** The timeline's moments as instants: in order, a time earlier than the one before is the next day. */
function momentsAt(moments: readonly TimelineMoment[], date: ISODate, timeZone: string): number[] {
  const out: number[] = [];
  let day = date;
  for (const m of moments) {
    let t = zonedTimeToUtc(day, m.time, timeZone).getTime();
    const prev = out.at(-1);
    if (prev !== undefined && t < prev) {
      day = addDaysISO(day, 1);
      t = zonedTimeToUtc(day, m.time, timeZone).getTime();
    }
    out.push(t);
  }
  return out;
}

function byTimeline(
  items: Timed[],
  moments: readonly TimelineMoment[],
  date: ISODate,
  timeZone: string,
): AlbumChapter[] {
  const at = momentsAt(moments, date, timeZone);
  const lead = ALBUM.chapters.leadMinutes * 60_000;
  const groups: Timed[][] = moments.map(() => []);
  for (const item of items) {
    let index = 0;
    for (let k = 0; k < at.length; k++) if (at[k]! - lead <= item.t) index = k;
    groups[index]!.push(item);
  }
  return moments.flatMap((m, k) =>
    groups[k]!.length
      ? [
          {
            key: `t${k}`,
            label: m.label,
            auto: null,
            icon: m.icon,
            time: m.time,
            start: new Date(groups[k]![0]!.t).toISOString(),
            ids: groups[k]!.map((i) => i.id),
          },
        ]
      : [],
  );
}

/** Chapters from the pauses between photos: small ones join their nearest neighbour, at most `max`. */
function byGaps(items: Timed[]): AlbumChapter[] {
  const { gapMinutes, minItems, max } = ALBUM.chapters;
  const groups: Timed[][] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && item.t - last.at(-1)!.t <= gapMinutes * 60_000) last.push(item);
    else groups.push([item]);
  }
  const gapBetween = (a: Timed[], b: Timed[]) => b[0]!.t - a.at(-1)!.t;
  const mergeAt = (k: number) => {
    // group k joins group k + 1
    groups.splice(k, 2, [...groups[k]!, ...groups[k + 1]!]);
  };
  // a chapter too small joins the neighbour closest in time
  for (let small = groups.findIndex((g) => g.length < minItems); small >= 0 && groups.length > 1;) {
    if (small === 0) mergeAt(0);
    else if (small === groups.length - 1) mergeAt(small - 1);
    else
      mergeAt(
        gapBetween(groups[small - 1]!, groups[small]!) <= gapBetween(groups[small]!, groups[small + 1]!)
          ? small - 1
          : small,
      );
    small = groups.findIndex((g) => g.length < minItems);
  }
  while (groups.length > max) {
    let k = 0;
    for (let j = 1; j < groups.length - 1; j++)
      if (gapBetween(groups[j]!, groups[j + 1]!) < gapBetween(groups[k]!, groups[k + 1]!)) k = j;
    mergeAt(k);
  }
  return groups.map((g, k) => ({
    key: `g${k}`,
    label: null,
    auto: k === 0 ? 'opening' : k === groups.length - 1 ? 'ending' : k === 1 ? 'heart' : 'more',
    icon: null,
    time: null,
    start: new Date(g[0]!.t).toISOString(),
    ids: g.map((i) => i.id),
  }));
}

/**
 * The album's chapters, every item in one, in time order: by the invitation's timeline when it has
 * two moments or more and the photos fall into at least two of them; else by the pauses between the
 * photos; one chapter (no title) when the hosts turned chapters off or the event was one stretch.
 */
export function albumChapters(
  entries: readonly Pick<AlbumEntry, 'id' | 'at'>[],
  ctx: {
    on: boolean;
    timeline: readonly TimelineMoment[];
    date: ISODate;
    timeZone: string;
  },
): AlbumChapter[] {
  const items = entries.map((e) => ({ id: e.id, t: timeOf(e.at) })).sort((a, b) => a.t - b.t);
  if (!ctx.on || items.length < ALBUM.chapters.minItems * 2) return one(items);
  if (ctx.timeline.length >= 2) {
    try {
      const chapters = byTimeline(items, ctx.timeline, ctx.date, ctx.timeZone);
      if (chapters.length >= 2) return chapters;
    } catch {
      // a date or zone that can't be read: by the pauses
    }
  }
  const chapters = byGaps(items);
  return chapters.length >= 2 ? chapters : one(items);
}

// ─── the rows ───────────────────────────────────────────────────────────────────────────────────

export interface RowItem {
  id: string;
  /** width / height */
  aspect: number;
}

export interface Row {
  items: { id: string; width: number }[];
  height: number;
  /** the row fills the width (the last one may not: it keeps its photos' size) */
  full: boolean;
}

/** A photo's shape as the album lays it out (an unknown one is a 4:3 landscape). */
export function aspectOf(width: number | null, height: number | null): number {
  const { min, max } = ALBUM.layout.aspect;
  const a = width && height ? width / height : 4 / 3;
  return Math.min(max, Math.max(min, a));
}

/**
 * Justified rows: photos side by side at one height per row, each row filling `width` exactly (the
 * gaps included); the last row keeps the target height rather than blowing up a lone photo.
 */
export function justifyRows(items: readonly RowItem[], width: number, target: number, gap: number): Row[] {
  const rows: Row[] = [];
  if (width <= 0) return rows;
  let row: RowItem[] = [];
  let sum = 0;
  const close = (height: number, full: boolean) => {
    rows.push({
      items: row.map((i) => ({ id: i.id, width: Math.max(1, Math.floor(i.aspect * height)) })),
      height: Math.round(height),
      full,
    });
    row = [];
    sum = 0;
  };
  for (const item of items) {
    row.push(item);
    sum += item.aspect;
    const height = (width - gap * (row.length - 1)) / sum;
    if (height <= target) close(height, true);
  }
  if (row.length) {
    const height = (width - gap * (row.length - 1)) / sum;
    close(Math.min(target, height), height <= target);
  }
  return rows;
}

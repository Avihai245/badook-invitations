import { hamming as hashDistance } from '@/features/live-gallery/image-metrics';
import { FILM, type FilmShape } from './config';

/**
 * Which photos and clips make the film, as plain math (tested in tests/unit/film.test.ts): each is
 * weighed by what the gallery measured when it arrived — sharpness, exposure, resolution, the
 * automatic check's quality score — and by its faces when face search found them, and by how well it
 * fits the film's shape; near-duplicates (the same moment, a burst) are left to their best one; the
 * choice spreads over the event's timeline and mixes photos with short clips. The host's pins always
 * go in, what they left out never does, and their order wins.
 */

/** x, y, width, height as fractions of the photo */
export type Box = [number, number, number, number];

export interface FilmCandidate {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** when it was taken (else when it entered the gallery), ISO */
  at: string;
  /** variance of the Laplacian (the gallery's measure), null when not measured */
  sharpness: number | null;
  /** mean luminance 0..1 */
  brightness: number | null;
  /** the automatic check's quality score 0..1 */
  aiQuality: number | null;
  /** 64-bit perceptual hash, hex */
  phash: string | null;
  /** faces face search found; null when it didn't look */
  faces: Box[] | null;
}

export interface FilmChoice {
  /** always in, in this order among themselves */
  pinned: string[];
  /** never in */
  excluded: string[];
  /** the host's own order of the shots (ids); new shots find their place by time */
  order: string[];
}

export const NO_CHOICE: FilmChoice = { pinned: [], excluded: [], order: [] };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const timeOf = (c: Pick<FilmCandidate, 'at'>) => {
  const t = Date.parse(c.at);
  return Number.isFinite(t) ? t : 0;
};

/** The item can be in the film at all: a photo with its size, a clip long enough. */
export function usable(c: FilmCandidate): boolean {
  if (c.kind === 'video') return (c.durationMs ?? 0) >= FILM.shots.clipMinSeconds * 1000;
  return true;
}

/** How well a photo's shape fits the film's (1: no crop to speak of). */
export function shapeFit(c: Pick<FilmCandidate, 'width' | 'height'>, shape: FilmShape): number {
  if (!c.width || !c.height) return 0.6;
  const aspect = c.width / c.height;
  if (shape === 'vertical') return aspect <= 0.9 ? 1 : aspect <= 1.1 ? 0.7 : 0.45;
  return aspect >= 1.1 ? 1 : aspect >= 0.9 ? 0.7 : 0.45;
}

/** 0..1: how good a shot the item makes. */
export function qualityScore(c: FilmCandidate, shape: FilmShape): number {
  // sharpness: the gallery holds back under 18 (blurry); ~400 is crisp
  const sharp =
    c.sharpness === null
      ? 0.55
      : clamp01((Math.log(c.sharpness + 1) - Math.log(19)) / (Math.log(401) - Math.log(19)));
  const exposure = c.brightness === null ? 0.6 : clamp01(1 - Math.abs(c.brightness - 0.48) / 0.4);
  const resolution = c.width && c.height ? clamp01(Math.sqrt((c.width * c.height) / (1920 * 1080))) : 0.5;
  const ai = c.aiQuality ?? 0.6;
  // people make an event's film: faces (bigger ones better) when face search looked, neutral when not
  let faces = 0.5;
  if (c.faces) {
    const largest = c.faces.reduce((m, [, , w, h]) => Math.max(m, w * h), 0);
    faces = c.faces.length
      ? clamp01(0.62 + 0.06 * Math.min(c.faces.length, 4) + Math.sqrt(largest) * 0.5)
      : 0.25;
  }
  return (
    0.27 * sharp + 0.14 * exposure + 0.1 * resolution + 0.17 * ai + 0.2 * faces + 0.12 * shapeFit(c, shape)
  );
}

/** Bits that differ between two 64-bit hashes (hex); 64 when either is missing. */
export const hamming = (a: string | null, b: string | null): number => (a && b ? hashDistance(a, b) : 64);

/** The same moment: nearly the same picture, or a burst (taken seconds apart, much alike). */
export function sameMoment(a: FilmCandidate, b: FilmCandidate): boolean {
  const bits = hamming(a.phash, b.phash);
  if (bits <= FILM.select.duplicateBits) return true;
  return Math.abs(timeOf(a) - timeOf(b)) <= FILM.select.burstSeconds * 1000 && bits <= FILM.select.burstBits;
}

interface Scored {
  c: FilmCandidate;
  score: number;
  t: number;
}

/** Keeps the best of each moment (`keep` are already in: their duplicates go). */
function distinct(pool: Scored[], keep: Scored[]): Scored[] {
  const kept: Scored[] = [...keep];
  const out: Scored[] = [];
  for (const s of [...pool].sort((a, b) => b.score - a.score)) {
    if (kept.some((k) => sameMoment(k.c, s.c))) continue;
    kept.push(s);
    out.push(s);
  }
  return out;
}

/**
 * `count` items spread over the timeline: the pool in time order is cut into `count` stretches —
 * halfway between equal numbers of items and equal lengths of time, so every part of the event is
 * there and busy parts have more — and the best of each stretch is taken; a stretch with nothing in
 * it gives its turn to the best left anywhere.
 */
export function spread<T extends { t: number; score: number }>(pool: T[], count: number): T[] {
  if (count <= 0) return [];
  const sorted = [...pool].sort((a, b) => a.t - b.t);
  if (sorted.length <= count) return sorted;
  const first = sorted[0]!.t;
  const last = sorted.at(-1)!.t;
  const n = sorted.length;
  const bounds: number[] = [];
  for (let i = 1; i < count; i++) {
    const byCount = sorted[Math.min(n - 1, Math.floor((i * n) / count))]!.t;
    const byTime = first + ((last - first) * i) / count;
    bounds.push((byCount + byTime) / 2);
  }
  const taken = new Set<T>();
  let spare = 0;
  let from = 0;
  for (let i = 0; i < count; i++) {
    const until = i < count - 1 ? bounds[i]! : Infinity;
    let best: T | null = null;
    while (from < n && sorted[from]!.t < until) {
      const s = sorted[from]!;
      if (!best || s.score > best.score) best = s;
      from++;
    }
    if (best) taken.add(best);
    else spare++;
  }
  for (const s of [...sorted].sort((a, b) => b.score - a.score)) {
    if (spare <= 0) break;
    if (taken.has(s)) continue;
    taken.add(s);
    spare--;
  }
  return sorted.filter((s) => taken.has(s));
}

/**
 * The host's order first (the ids still in), then each new shot after the last one taken before it
 * (or first of all).
 */
export function arrange<T extends { id: string; at: string }>(items: T[], order: readonly string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: T[] = order.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
  const placed = new Set(out.map((i) => i.id));
  for (const item of [...items].sort((a, b) => timeOf(a) - timeOf(b))) {
    if (placed.has(item.id)) continue;
    const t = timeOf(item);
    let at = 0;
    for (let i = 0; i < out.length; i++) if (timeOf(out[i]!) <= t) at = i + 1;
    out.splice(at, 0, item);
    placed.add(item.id);
  }
  return out;
}

export interface Selection {
  /** the shots, in the film's order */
  items: FilmCandidate[];
  /** each shot's weight (pins count most): what the edit drops first when there's too much */
  priority: Map<string, number>;
}

/** The film's shots: about `count` of them (all the pins, even beyond it). */
export function selectShots(
  candidates: FilmCandidate[],
  { count, shape, choice = NO_CHOICE }: { count: number; shape: FilmShape; choice?: FilmChoice },
): Selection {
  const excluded = new Set(choice.excluded);
  const pinnedIds = choice.pinned.filter((id) => !excluded.has(id));
  const pool: Scored[] = candidates
    .filter((c) => usable(c) && !excluded.has(c.id))
    .map((c) => ({ c, score: qualityScore(c, shape), t: timeOf(c) }));
  const byId = new Map(pool.map((s) => [s.c.id, s]));
  const pinned = pinnedIds.flatMap((id) => {
    const s = byId.get(id);
    return s ? [s] : [];
  });
  const pinnedSet = new Set(pinned);
  const rest = distinct(
    pool.filter((s) => !pinnedSet.has(s)),
    pinned,
  );

  const slots = Math.max(0, count - pinned.length);
  const clips = rest.filter((s) => s.c.kind === 'video');
  const photos = rest.filter((s) => s.c.kind === 'image');
  let clipSlots = Math.min(clips.length, Math.round(slots * FILM.select.clipShare));
  if (photos.length < slots - clipSlots) clipSlots = Math.min(clips.length, slots - photos.length);
  const picked = [...spread(clips, clipSlots), ...spread(photos, slots - clipSlots)];

  const chosen = [...pinned, ...picked];
  const priority = new Map<string, number>();
  for (const s of picked) priority.set(s.c.id, s.score);
  for (const s of pinned) priority.set(s.c.id, 10 + s.score);
  return {
    items: arrange(
      chosen.map((s) => s.c),
      choice.order,
    ),
    priority,
  };
}

import { GALLERY, type MediaKind } from './config';
import type { Reason } from './moderation';

/**
 * The guest's upload queue, as plain data and decisions (the browser keeps it in IndexedDB and the
 * uploader carries out what `nextAction` says). An item goes: queued → reserved (the server gave it
 * an id and upload URLs) → its preview files → "complete" (it is checked and enters the feed or the
 * host's queue) → its original → done. Previews of every item go before any original, so photos
 * reach the feed and the screen quickly even on slow Wi-Fi; a failed step waits (backoff) and tries
 * again, without holding up the others.
 */

export type PartName = 'thumb' | 'display' | 'original';

export interface PartState {
  type: string;
  size: number;
  done: boolean;
  /** where it goes (set when reserved) */
  bucket?: string;
  path?: string;
  /** the signed upload token and URL, and when they were issued (they last two hours) */
  token?: string;
  url?: string;
  issuedAt?: number;
  /** a resumable upload under way: its address and how much the server has */
  resumable?: { endpoint: string; location: string | null; offset: number } | null;
  /** the storage's public key, sent along like Supabase's own client does */
  apiKey?: string;
}

export type Stage = 'queued' | 'reserved' | 'visible' | 'done' | 'failed' | 'skipped';

export interface QueueItem {
  localId: string;
  kind: MediaKind;
  createdAt: number;
  /** the server's id, once reserved */
  remoteId: string | null;
  stage: Stage;
  parts: Partial<Record<PartName, PartState>>;
  meta: {
    width: number | null;
    height: number | null;
    durationMs: number | null;
    takenAt: string | null;
  };
  metrics: { sharpness: number; brightness: number; phash: string; enhanced: boolean } | null;
  /** where it ended up (after "complete") */
  result: { status: 'published' | 'pending' | 'rejected'; reason: Reason } | null;
  /** failed attempts of the current step, and when the next may start */
  attempts: number;
  nextAt: number;
  /** why the last attempt failed (a code for the screen) */
  error: string | null;
  /** bytes sent of all parts (progress) */
  sent: number;
  /** times the server didn't find a file this phone had sent (bounded: GALLERY.queue.maxMismatches) */
  mismatches?: number;
}

export type Action =
  | { type: 'reserve'; ids: string[] }
  | { type: 'upload'; id: string; part: PartName }
  | { type: 'complete'; id: string; originalDone: boolean }
  | { type: 'wait'; until: number }
  | { type: 'idle' };

/** The parts an item needs before it can go to the feed (a photo's original can come later). */
export function previewParts(item: Pick<QueueItem, 'kind' | 'parts'>): PartName[] {
  const names = (['thumb', 'display', 'original'] as const).filter((p) => item.parts[p]);
  const lateOriginal = item.kind === 'image' && !!item.parts.thumb && !!item.parts.display;
  return lateOriginal ? names.filter((p) => p !== 'original') : [...names];
}

const due = (item: QueueItem, now: number) => item.nextAt <= now;
const byAge = (a: QueueItem, b: QueueItem) => a.createdAt - b.createdAt || (a.localId < b.localId ? -1 : 1);

/**
 * What to do next: reserve what is new (several at once), then the preview files of every item,
 * then check them in ("complete"), then originals, then record that the originals arrived. Items
 * waiting after a failure are skipped until their time; `blocked` (the gallery is paused or closed,
 * or needs the code) stops new reservations only.
 */
export function nextAction(
  items: readonly QueueItem[],
  now: number,
  { blocked = false }: { blocked?: boolean } = {},
): Action {
  const live = [...items]
    .filter((i) => i.stage !== 'done' && i.stage !== 'failed' && i.stage !== 'skipped')
    .sort(byAge);
  const ready = live.filter((i) => due(i, now));
  if (!blocked) {
    const fresh = ready.filter((i) => i.stage === 'queued').slice(0, GALLERY.limits.itemsPerRequest);
    if (fresh.length) return { type: 'reserve', ids: fresh.map((i) => i.localId) };
  }
  for (const item of ready) {
    if (item.stage !== 'reserved') continue;
    const missing = previewParts(item).find((p) => !item.parts[p]!.done);
    if (missing) return { type: 'upload', id: item.localId, part: missing };
  }
  for (const item of ready) {
    if (item.stage !== 'reserved') continue;
    return { type: 'complete', id: item.localId, originalDone: !!item.parts.original?.done };
  }
  for (const item of ready) {
    if (item.stage === 'visible' && item.parts.original && !item.parts.original.done)
      return { type: 'upload', id: item.localId, part: 'original' };
  }
  for (const item of ready) {
    if (item.stage === 'visible' && (!item.parts.original || item.parts.original.done))
      return { type: 'complete', id: item.localId, originalDone: true };
  }
  const waiting = live.filter((i) => !due(i, now) && (i.stage !== 'queued' || !blocked));
  if (waiting.length) return { type: 'wait', until: Math.min(...waiting.map((i) => i.nextAt)) };
  return { type: 'idle' };
}

/** How long to wait before attempt `attempts + 1` (with a little jitter so phones don't retry together). */
export function backoff(attempts: number, random = Math.random): number {
  const steps = GALLERY.queue.backoffMs;
  const base = steps[Math.min(Math.max(attempts, 1), steps.length) - 1]!;
  const jitter = GALLERY.queue.jitter;
  return Math.round(base * (1 - jitter + 2 * jitter * random()));
}

/** A step failed: count it and set when to try again. */
export function failed(item: QueueItem, error: string, now: number, random = Math.random): QueueItem {
  const attempts = item.attempts + 1;
  return { ...item, attempts, error, nextAt: now + backoff(attempts, random) };
}

/** A step succeeded: the next one may start at once. */
export const succeeded = (item: QueueItem): QueueItem => ({ ...item, attempts: 0, error: null, nextAt: 0 });

/** The network came back: everything waiting may try now. */
export const retryNow = (items: readonly QueueItem[]): QueueItem[] =>
  items.map((i) =>
    i.stage === 'failed' || i.stage === 'done' || i.stage === 'skipped' ? i : { ...i, nextAt: 0 },
  );

export interface Progress {
  /** items fully uploaded (the original too) */
  done: number;
  /** items in this round (not skipped) */
  total: number;
  /** in the feed or the host's queue already, the original may still be on its way */
  visible: number;
  failed: number;
  bytesSent: number;
  bytesTotal: number;
}

const partBytes = (item: QueueItem) => Object.values(item.parts).reduce((sum, p) => sum + (p?.size ?? 0), 0);

export function progress(items: readonly QueueItem[]): Progress {
  const counted = items.filter((i) => i.stage !== 'skipped');
  return {
    done: counted.filter((i) => i.stage === 'done').length,
    total: counted.length,
    visible: counted.filter((i) => i.stage === 'visible' || i.stage === 'done').length,
    failed: counted.filter((i) => i.stage === 'failed').length,
    bytesSent: counted.reduce(
      (sum, i) => sum + (i.stage === 'done' ? partBytes(i) : Math.min(i.sent, partBytes(i))),
      0,
    ),
    bytesTotal: counted.reduce((sum, i) => sum + partBytes(i), 0),
  };
}

/** Everything is uploaded (or failed for good): the round is over. */
export const settled = (items: readonly QueueItem[]): boolean =>
  items.every((i) => i.stage === 'done' || i.stage === 'failed' || i.stage === 'skipped');

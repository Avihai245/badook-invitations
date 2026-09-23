/**
 * Undo/redo for the editor (§7.6: in-memory, 50 steps). Typing into one field is one step: commits with
 * the same `key` (the field path) within `coalesceMs` replace the latest step instead of adding one.
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** key + time of the latest commit, for coalescing */
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 50;
export const COALESCE_MS = 1000;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit<T>(
  h: History<T>,
  next: T,
  {
    key = null,
    now = Date.now(),
    coalesceMs = COALESCE_MS,
    limit = HISTORY_LIMIT,
  }: {
    key?: string | null;
    now?: number;
    coalesceMs?: number;
    limit?: number;
  } = {},
): History<T> {
  if (Object.is(next, h.present)) return h;
  const coalesce = key !== null && key === h.lastKey && now - h.lastAt < coalesceMs;
  if (coalesce) return { ...h, present: next, future: [], lastAt: now };
  const past = [...h.past, h.present];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1);
  if (prev === undefined) return h;
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 };
}

/** Replace the present without an undo step (e.g. a server conflict resolution, a restored version). */
export function replacePresent<T>(
  h: History<T>,
  present: T,
  { clear = false }: { clear?: boolean } = {},
): History<T> {
  return clear ? createHistory(present) : { ...h, present, lastKey: null, lastAt: 0 };
}

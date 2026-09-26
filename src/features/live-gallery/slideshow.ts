/**
 * The venue screen's slideshow, as plain state: it goes round the gallery (newest first), and photos
 * that just arrived jump the line — in the order they were taken — each with its entrance. Removed
 * photos (hidden or deleted by the host) leave at once, even mid-show. Testable without a browser.
 */

export interface SlideState {
  /** the item on screen */
  current: string | null;
  /** arrivals waiting for their entrance, oldest first */
  fresh: string[];
  /** position in the rotation (index into the ids, newest first) */
  cursor: number;
}

export const EMPTY_SHOW: SlideState = { current: null, fresh: [], cursor: -1 };

/** The next slide: an arrival if one waits, else the next in the rotation (round and round). */
export function advance(
  state: SlideState,
  ids: readonly string[],
): { state: SlideState; id: string | null; fresh: boolean } {
  const known = new Set(ids);
  const waiting = state.fresh.filter((id) => known.has(id));
  if (waiting.length) {
    const [id, ...rest] = waiting;
    return { state: { ...state, current: id!, fresh: rest }, id: id!, fresh: true };
  }
  if (!ids.length)
    return { state: { ...state, current: null, fresh: [], cursor: -1 }, id: null, fresh: false };
  // one photo only: it stays
  const cursor = (state.cursor + 1) % ids.length;
  return { state: { ...state, current: ids[cursor]!, fresh: [], cursor }, id: ids[cursor]!, fresh: false };
}

/** New items (newest first, as the API sends them) join the queue of arrivals, oldest first. */
export function arrive(state: SlideState, newestFirst: readonly string[]): SlideState {
  const queued = new Set(state.fresh);
  const incoming = [...newestFirst].reverse().filter((id) => !queued.has(id) && id !== state.current);
  // the rotation's position moves with the ids added in front of it
  return { ...state, fresh: [...state.fresh, ...incoming], cursor: state.cursor + incoming.length };
}

/**
 * Removed items leave the queue and the rotation (`ids`: the rotation before they left); `skip` says
 * the one on screen has to go now.
 */
export function depart(
  state: SlideState,
  ids: readonly string[],
  removed: readonly string[],
): { state: SlideState; skip: boolean } {
  if (!removed.length) return { state, skip: false };
  const gone = new Set(removed);
  const before = ids.slice(0, Math.max(0, state.cursor)).filter((id) => gone.has(id)).length;
  return {
    state: { ...state, fresh: state.fresh.filter((id) => !gone.has(id)), cursor: state.cursor - before },
    skip: state.current !== null && gone.has(state.current),
  };
}

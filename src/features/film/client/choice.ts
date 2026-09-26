import { isFilmLength, type FilmLength, type FilmShape } from '../config';
import { NO_CHOICE, type FilmChoice } from '../select';

/**
 * The host's choices for an event's film — pins, removals, order, length and shape — kept in this
 * browser (localStorage; a convenience: without it the film simply starts from its own choice).
 */

export interface SavedFilm extends FilmChoice {
  length: FilmLength | null;
  shape: FilmShape | null;
}

const key = (invitationId: string) => `badook-film:${invitationId}`;
const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 3000) : [];

export function loadFilmChoice(invitationId: string): SavedFilm {
  const empty: SavedFilm = { ...NO_CHOICE, length: null, shape: null };
  try {
    const raw = window.localStorage.getItem(key(invitationId));
    if (!raw) return empty;
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      pinned: ids(v.pinned),
      excluded: ids(v.excluded),
      order: ids(v.order),
      length: isFilmLength(v.length) ? v.length : null,
      shape: v.shape === 'vertical' || v.shape === 'horizontal' ? v.shape : null,
    };
  } catch {
    return empty;
  }
}

export function saveFilmChoice(invitationId: string, saved: SavedFilm): void {
  try {
    window.localStorage.setItem(key(invitationId), JSON.stringify(saved));
  } catch {
    // private mode, blocked storage: the choice lasts as long as the page
  }
}

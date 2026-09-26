/**
 * Every save recoverable (Phase 5C): the invitation's history keeps its publishes (numbered, for as long
 * as the invitation exists) and copies of the draft taken while the host edits — at most one per
 * stretch of editing (`saveEverySeconds`), one before a restore and one before a design concept
 * replaces the design. Saves are capped per invitation and the daily run purges older ones; the
 * database applies the numbers it is given (supabase/migrations/*_studio.sql). Isomorphic.
 */
export const VERSIONS = {
  /** a copy of the draft at most this often while the host edits */
  saveEverySeconds: 600,
  /** saves kept per invitation (the oldest go first) */
  maxSaves: 60,
  /** saves older than this go in the daily run (publishes stay) */
  keepSavesDays: 90,
  /** entries the history lists */
  historyLimit: 200,
} as const;

export type HistoryKind = 'publish' | 'save';
export type SaveReason = 'autosave' | 'restore' | 'concept';

/** One entry of the history (its document is fetched when needed). */
export interface HistoryEntry {
  id: number;
  kind: HistoryKind;
  /** a publish's number; null for a save */
  version: number | null;
  /** why a save was kept; null for a publish */
  reason: SaveReason | null;
  /** the design it was on */
  templateId: string | null;
  createdAt: string;
}

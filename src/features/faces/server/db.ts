import 'server-only';
import type { ItemRow } from '@/features/live-gallery/server/db';
import { serviceDb } from '@/lib/supabase/server';
import type { Face } from '../model';

/**
 * Typed access to face search's database functions (supabase/migrations/*_gallery_film_faces.sql).
 * Always the service role; guests' calls come after the server resolved the gallery's link, the host's
 * are checked against the owner by the functions themselves.
 */

export interface FaceState {
  eventDate: string | null;
  timezone: string | null;
  gallery: boolean;
  photos: number;
  scanned: number;
  faces: number;
  excluded: number;
  optouts: number;
}

export interface PendingPhoto {
  id: string;
  displayPath: string;
  width: number | null;
  height: number | null;
}

type AddResult =
  | { ok: true; faces: number; excluded: number; already?: boolean }
  | { ok: false; code: 'not_found' | 'invalid' };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

export const facesDb = {
  // ── guests (the server resolved the gallery's link first) ──
  indexUpload: (invitationId: string, itemId: string, uploaderHash: string, faces: Face[], exclude: number) =>
    rpc<AddResult>('gallery_face_index_upload', {
      p_invitation_id: invitationId,
      p_item_id: itemId,
      p_uploader_hash: uploaderHash,
      p_faces: faces,
      p_exclude: exclude,
    }),
  /** compared only — never stored */
  search: (invitationId: string, descriptor: number[], threshold: number, limit: number) =>
    rpc<(ItemRow & { distance: number })[] | null>('gallery_face_search', {
      p_invitation_id: invitationId,
      p_descriptor: descriptor,
      p_threshold: threshold,
      p_limit: limit,
    }),
  leaveOut: (invitationId: string, descriptor: number[], threshold: number) =>
    rpc<{ excluded: number } | null>('gallery_face_leave_out', {
      p_invitation_id: invitationId,
      p_descriptor: descriptor,
      p_threshold: threshold,
    }),
  forget: (invitationId: string, descriptor: number[], threshold: number) =>
    rpc<{ erased: number; optouts: number } | null>('gallery_face_forget', {
      p_invitation_id: invitationId,
      p_descriptor: descriptor,
      p_threshold: threshold,
    }),

  // ── the host ──
  ownerState: (id: string, ownerId: string) =>
    rpc<FaceState | null>('gallery_face_owner_state', { p_id: id, p_owner_id: ownerId }),
  ownerPending: (id: string, ownerId: string, limit: number) =>
    rpc<PendingPhoto[] | null>('gallery_face_owner_pending', {
      p_id: id,
      p_owner_id: ownerId,
      p_limit: limit,
    }),
  ownerIndex: (id: string, ownerId: string, results: { id: string; faces: Face[] }[], exclude: number) =>
    rpc<{ done: number; faces: number; excluded: number; invalid: number } | null>(
      'gallery_face_owner_index',
      {
        p_id: id,
        p_owner_id: ownerId,
        p_results: results,
        p_exclude: exclude,
      },
    ),
  ownerErase: (id: string, ownerId: string) =>
    rpc<{ faces: number; scans: number; optouts: number } | null>('gallery_face_owner_erase', {
      p_id: id,
      p_owner_id: ownerId,
    }),

  // ── keeping it short (the daily run) ──
  events: () => rpc<string[]>('gallery_face_events', {}),
  eraseEvents: (ids: string[]) => rpc<number>('gallery_face_erase_events', { p_ids: ids }),
  maintenance: (days: number) => rpc<{ events: number }>('gallery_face_maintenance', { p_days: days }),
};

export type FacesDb = typeof facesDb;

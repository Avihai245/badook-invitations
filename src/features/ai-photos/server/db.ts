import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import type { Role } from '../model';

/**
 * Typed access to the AI photos' database functions (supabase/migrations/*_ai_photos.sql). Always the
 * service role; each function checks the owner itself, or works on an invitation the server resolved
 * from the gallery's link.
 */

export interface AiSettings {
  enabled: boolean;
  perGuest: number;
  perEvent: number;
  toGallery: boolean;
  consentAt: string | null;
}

export interface PersonRow {
  id: string;
  seq: number;
  role: Role;
  name: Record<string, string>;
  description: string | null;
  photoPath: string | null;
  updatedAt: string;
}

export type PhotoStatus = 'queued' | 'running' | 'done' | 'failed' | 'blocked';

export interface PhotoRow {
  id: string;
  status: PhotoStatus;
  error: string | null;
  prompt: string;
  people: string[];
  locale: string | null;
  guestName: string | null;
  guestId: string | null;
  sourcePath: string | null;
  resultPath: string | null;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  externalId: string | null;
  attempts: number;
  galleryItemId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** A photo the worker claimed, with what its request needs. */
export interface ClaimedPhoto extends PhotoRow {
  invitationId: string;
  document: unknown;
  persons: PersonRow[];
}

export interface OwnerAi {
  slug: string;
  document: unknown;
  settings: AiSettings;
  people: PersonRow[];
  counts: { done: number; used: number; blocked: number };
  /** the event's gallery is on (guests reach the photos from its page) */
  gallery: boolean;
}

export interface GuestAi {
  settings: AiSettings;
  people: { id: string; role: Role; name: Record<string, string> }[];
  used: { guest: number; event: number };
  mine: PhotoRow[];
}

export type CreateResult =
  | { ok: true; left: number }
  | { ok: false; code: 'off' | 'no_people' | 'guest_limit' | 'event_limit' | 'daily_limit'; limit?: number };

export type ShareResult =
  | { ok: true; status: 'published' | 'pending'; itemId: string }
  | { ok: false; code: 'not_found' | 'not_done' | 'shared' | 'off' | 'no_gallery' | 'full' };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

export const aiPhotoDb = {
  // ── the host ──
  ownerGet: (id: string, ownerId: string) =>
    rpc<OwnerAi | null>('ai_photo_owner_get', { p_id: id, p_owner: ownerId }),
  ownerSettings: (id: string, ownerId: string, patch: Record<string, unknown>) =>
    rpc<{ ok: true } | { ok: false; code: 'consent' | 'no_people' } | null>('ai_photo_owner_settings', {
      p_id: id,
      p_owner: ownerId,
      p_patch: patch,
    }),
  personSave: (id: string, ownerId: string, person: Record<string, unknown>, max: number) =>
    rpc<PersonRow | { error: 'full' } | null>('ai_photo_person_save', {
      p_id: id,
      p_owner: ownerId,
      p_person: person,
      p_max: max,
    }),
  personDelete: (id: string, ownerId: string, personId: string) =>
    rpc<boolean | null>('ai_photo_person_delete', { p_id: id, p_owner: ownerId, p_person: personId }),
  ownerList: (id: string, ownerId: string, before: string | null, limit: number) =>
    rpc<PhotoRow[] | null>('ai_photo_owner_list', {
      p_id: id,
      p_owner: ownerId,
      p_before: before,
      p_limit: limit,
    }),
  ownerDelete: (id: string, ownerId: string, ids: string[]) =>
    rpc<number | null>('ai_photo_owner_delete', { p_id: id, p_owner: ownerId, p_ids: ids }),

  // ── guests (the gallery's link resolved first) ──
  guestState: (invitationId: string, uploaderHash: string, limit: number) =>
    rpc<GuestAi>('ai_photo_guest_state', {
      p_invitation_id: invitationId,
      p_uploader_hash: uploaderHash,
      p_limit: limit,
    }),
  create: (
    invitationId: string,
    uploaderHash: string,
    guestId: string | null,
    name: string | null,
    photo: { id: string; prompt: string; people: string[]; locale: string; sourcePath: string | null },
    dailyLimit: number,
  ) =>
    rpc<CreateResult>('ai_photo_create', {
      p_invitation_id: invitationId,
      p_uploader_hash: uploaderHash,
      p_guest_id: guestId,
      p_name: name,
      p_photo: photo,
      p_daily_limit: dailyLimit,
    }),
  guestGet: (invitationId: string, uploaderHash: string, photoId: string) =>
    rpc<PhotoRow | null>('ai_photo_guest_get', {
      p_invitation_id: invitationId,
      p_uploader_hash: uploaderHash,
      p_photo: photoId,
    }),
  guestDelete: (invitationId: string, uploaderHash: string, photoId: string) =>
    rpc<boolean>('ai_photo_guest_delete', {
      p_invitation_id: invitationId,
      p_uploader_hash: uploaderHash,
      p_photo: photoId,
    }),
  share: (
    invitationId: string,
    uploaderHash: string,
    photoId: string,
    item: Record<string, unknown>,
    maxItems: number,
  ) =>
    rpc<ShareResult>('ai_photo_share', {
      p_invitation_id: invitationId,
      p_uploader_hash: uploaderHash,
      p_photo: photoId,
      p_item: item,
      p_max_items: maxItems,
    }),

  // ── the worker ──
  claim: (invitationId: string | null, limit: number, staleSeconds: number, maxAttempts: number) =>
    rpc<ClaimedPhoto[]>('ai_photo_claim', {
      p_id: invitationId,
      p_limit: limit,
      p_stale_seconds: staleSeconds,
      p_max_attempts: maxAttempts,
    }),
  started: (photoId: string, externalId: string) =>
    rpc<boolean | null>('ai_photo_started', { p_photo: photoId, p_external_id: externalId }),
  checks: (invitationId: string | null, limit: number, everySeconds: number, giveUpSeconds: number) =>
    rpc<(PhotoRow & { invitationId: string })[]>('ai_photo_checks', {
      p_id: invitationId,
      p_limit: limit,
      p_every_seconds: everySeconds,
      p_give_up_seconds: giveUpSeconds,
    }),
  done: (photoId: string, resultPath: string, thumbPath: string, width: number, height: number) =>
    rpc<boolean | null>('ai_photo_done', {
      p_photo: photoId,
      p_result_path: resultPath,
      p_thumb_path: thumbPath,
      p_width: width,
      p_height: height,
    }),
  fail: (photoId: string, status: 'failed' | 'blocked', error: string) =>
    rpc<boolean | null>('ai_photo_fail', { p_photo: photoId, p_status: status, p_error: error }),
  retry: (photoId: string, error: string, maxAttempts: number) =>
    rpc<boolean>('ai_photo_retry', { p_photo: photoId, p_error: error, p_max_attempts: maxAttempts }),
  maintenance: (days: number) =>
    rpc<{ photos: number; people: number }>('ai_photo_maintenance', { p_days: days }),
};

export type AiPhotoDb = typeof aiPhotoDb;

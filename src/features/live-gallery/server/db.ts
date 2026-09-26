import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import type { MediaKind } from '../config';
import type { CheckRecord, ItemStatus, Reason } from '../moderation';

/**
 * Typed access to the gallery's database functions (supabase/migrations/*_live_gallery.sql). Always
 * the service role; each function checks the owner or the link's hash itself.
 */

export interface GallerySettings {
  invitationId: string;
  enabled: boolean;
  mode: 'instant' | 'approval';
  paused: boolean;
  opensAt: string | null;
  closesAt: string | null;
  hasCode: boolean;
  uploadTokenHash: string;
  uploadTokenNonce: string;
  projectorTokenHash: string;
  projectorTokenNonce: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryCounts {
  total: number;
  published: number;
  pending: number;
  hidden: number;
  rejected: number;
  uploading: number;
  images: number;
  videos: number;
  uploaders: number;
  bytes: number;
}

export interface ItemRow {
  id: string;
  kind: MediaKind;
  status: ItemStatus;
  reason: Reason | null;
  originalPath: string;
  originalType: string;
  originalSize: number;
  originalDone: boolean;
  displayPath: string | null;
  displaySize: number | null;
  thumbPath: string | null;
  thumbSize: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  takenAt: string | null;
  sharpness: number | null;
  brightness: number | null;
  enhanced: boolean;
  aiNsfw: number | null;
  aiQuality: number | null;
  phash: string | null;
  name: string | null;
  guestId: string | null;
  createdAt: string;
  completedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  /** the host's list: the guest's name from the guest list */
  guestName?: string | null;
  /** gallery_item_for_uploader: the closest hash distance to another item */
  nearest?: number | null;
}

/** What a link opens: the gallery and what its pages show about the event. */
export interface TokenLookup {
  gallery: GallerySettings & { accessCodeHash: string | null; accessCodeSalt: string | null };
  invitation: {
    id: string;
    slug: string;
    status: 'draft' | 'published' | 'archived';
    eventType: string;
    templateId: string;
    hosts: {
      primary: Partial<Record<string, string>>;
      secondary: Partial<Record<string, string>> | null;
      joiner: Partial<Record<string, string>> | null;
    } | null;
    date: string | null;
    timezone: string | null;
    locales: string[] | null;
    defaultLocale: string | null;
    palette: Record<string, string> | null;
  };
}

export interface ReserveItem {
  id: string;
  kind: MediaKind;
  originalPath: string;
  originalType: string;
  originalSize: number;
  displayPath: string | null;
  displaySize: number | null;
  thumbPath: string | null;
  thumbSize: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  takenAt: string | null;
}

export interface OwnerGallery {
  slug: string;
  status: 'draft' | 'published' | 'archived';
  timezone: string | null;
  gallery: GallerySettings | null;
  counts: GalleryCounts | null;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

export const galleryDb = {
  // ── the host ──
  ownerGet: (id: string, ownerId: string) =>
    rpc<OwnerGallery | null>('gallery_owner_get', { p_id: id, p_owner_id: ownerId }),

  ownerCreate: (
    id: string,
    ownerId: string,
    links: { uploadHash: string; uploadNonce: string; projectorHash: string; projectorNonce: string },
    channel: string,
  ) =>
    rpc<OwnerGallery | null>('gallery_owner_create', {
      p_id: id,
      p_owner_id: ownerId,
      p_upload_hash: links.uploadHash,
      p_upload_nonce: links.uploadNonce,
      p_projector_hash: links.projectorHash,
      p_projector_nonce: links.projectorNonce,
      p_channel: channel,
    }),

  ownerUpdate: (id: string, ownerId: string, patch: Record<string, unknown>) =>
    rpc<OwnerGallery | null>('gallery_owner_update', { p_id: id, p_owner_id: ownerId, p_patch: patch }),

  ownerRotate: (
    id: string,
    ownerId: string,
    which: 'upload' | 'projector',
    hash: string,
    nonce: string,
    channel: string,
  ) =>
    rpc<OwnerGallery | null>('gallery_owner_rotate', {
      p_id: id,
      p_owner_id: ownerId,
      p_which: which,
      p_hash: hash,
      p_nonce: nonce,
      p_channel: channel,
    }),

  ownerDelete: (id: string, ownerId: string) =>
    rpc<boolean>('gallery_owner_delete', { p_id: id, p_owner_id: ownerId }),

  ownerItems: (
    id: string,
    ownerId: string,
    status: ItemStatus | 'all',
    before: { at: string; id: string } | null,
    limit: number,
  ) =>
    rpc<ItemRow[] | null>('gallery_owner_items', {
      p_id: id,
      p_owner_id: ownerId,
      p_status: status,
      p_before_at: before?.at ?? null,
      p_before_id: before?.id ?? null,
      p_limit: limit,
    }),

  ownerModerate: (
    id: string,
    ownerId: string,
    itemIds: string[],
    action: 'publish' | 'hide' | 'reject' | 'delete',
  ) =>
    rpc<{ count: number; ids: string[] } | null>('gallery_owner_moderate', {
      p_id: id,
      p_owner_id: ownerId,
      p_item_ids: itemIds,
      p_action: action,
    }),

  ownerOriginals: (
    id: string,
    ownerId: string,
    scope: 'all' | 'published',
    after: { at: string; id: string } | null,
    limit: number,
  ) =>
    rpc<{ items: ItemRow[]; total: number; bytes: number } | null>('gallery_owner_originals', {
      p_id: id,
      p_owner_id: ownerId,
      p_scope: scope,
      p_after_at: after?.at ?? null,
      p_after_id: after?.id ?? null,
      p_limit: limit,
    }),

  // ── guests and the screen ──
  byToken: (hash: string, kind: 'upload' | 'projector') =>
    rpc<TokenLookup | null>('gallery_by_token', { p_token_hash: hash, p_kind: kind }),

  slugLocale: (slug: string) =>
    rpc<{ defaultLocale: string | null; locales: string[] | null } | null>('gallery_slug_locale', {
      p_slug: slug,
    }),

  reserve: (
    invitationId: string,
    uploaderHash: string,
    guestId: string | null,
    name: string | null,
    items: ReserveItem[],
    maxItems: number,
  ) =>
    rpc<{ ok: true } | { ok: false; code: 'full' | 'not_found'; left?: number }>('gallery_reserve', {
      p_invitation_id: invitationId,
      p_uploader_hash: uploaderHash,
      p_guest_id: guestId,
      p_name: name,
      p_items: items,
      p_max_items: maxItems,
    }),

  itemForUploader: (invitationId: string, itemId: string, uploaderHash: string, phash: string | null) =>
    rpc<ItemRow | null>('gallery_item_for_uploader', {
      p_invitation_id: invitationId,
      p_item_id: itemId,
      p_uploader_hash: uploaderHash,
      p_phash: phash,
    }),

  complete: (args: {
    invitationId: string;
    itemId: string;
    uploaderHash: string;
    status: 'published' | 'pending' | 'rejected' | null;
    reason: Reason | null;
    metrics: Record<string, unknown>;
    checks: CheckRecord[];
    sizes: { thumb?: number; display?: number; original?: number };
    originalDone: boolean;
  }) =>
    rpc<{ status: ItemStatus; reason: Reason | null; originalDone: boolean; first: boolean } | null>(
      'gallery_complete',
      {
        p_invitation_id: args.invitationId,
        p_item_id: args.itemId,
        p_uploader_hash: args.uploaderHash,
        p_status: args.status,
        p_reason: args.reason,
        p_metrics: args.metrics,
        p_checks: args.checks,
        p_sizes: args.sizes,
        p_original_done: args.originalDone,
      },
    ),

  feed: (invitationId: string, before: { at: string; id: string } | null, limit: number) =>
    rpc<ItemRow[]>('gallery_feed', {
      p_invitation_id: invitationId,
      p_before_at: before?.at ?? null,
      p_before_id: before?.id ?? null,
      p_limit: limit,
    }),

  changes: (invitationId: string, since: string, limit: number) =>
    rpc<{ now: string; added: ItemRow[]; removed: string[] }>('gallery_changes', {
      p_invitation_id: invitationId,
      p_since: since,
      p_limit: limit,
    }),

  uploaderItems: (invitationId: string, uploaderHash: string) =>
    rpc<ItemRow[]>('gallery_uploader_items', {
      p_invitation_id: invitationId,
      p_uploader_hash: uploaderHash,
    }),

  guestDelete: (invitationId: string, itemId: string, uploaderHash: string) =>
    rpc<boolean>('gallery_guest_delete', {
      p_invitation_id: invitationId,
      p_item_id: itemId,
      p_uploader_hash: uploaderHash,
    }),

  rateHit: (key: string, limit: number, windowSeconds: number) =>
    rpc<boolean>('gallery_rate_hit', { p_key_hash: key, p_limit: limit, p_window_seconds: windowSeconds }),

  guestByToken: (invitationId: string, token: string) =>
    rpc<string | null>('guest_by_token', { p_invitation_id: invitationId, p_token: token }),

  // ── housekeeping ──
  trashClaim: (limit: number) =>
    rpc<{ id: number; bucket: string; path: string }[]>('gallery_trash_claim', { p_limit: limit }),
  trashDone: (ids: number[]) => rpc<number>('gallery_trash_done', { p_ids: ids }),
  maintenance: (abandonedHours: number, tombstoneDays: number) =>
    rpc<{ abandoned: number; tombstones: number; rate: number }>('gallery_maintenance', {
      p_abandoned_hours: abandonedHours,
      p_tombstone_days: tombstoneDays,
    }),
};

export type GalleryDb = typeof galleryDb;

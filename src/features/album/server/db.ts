import 'server-only';
import type { ItemRow } from '@/features/live-gallery/server/db';
import { serviceDb } from '@/lib/supabase/server';

/**
 * Typed access to the album's database functions (supabase/migrations/*_album.sql). Always the service
 * role; each function checks the owner or the link's hash itself.
 */

export interface AlbumSettings {
  enabled: boolean;
  opensAt: string | null;
  title: Record<string, string> | null;
  message: Record<string, string> | null;
  coverItemId: string | null;
  hiddenItems: string[];
  showVideos: boolean;
  chapters: boolean;
  tokenHash: string;
  tokenNonce: string;
  readyMailedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerAlbum {
  slug: string;
  status: 'draft' | 'published' | 'archived';
  /** the invitation as guests read it (published, else the draft) */
  document: unknown;
  gallery: { enabled: boolean } | null;
  album: AlbumSettings | null;
  counts: { images: number; videos: number };
}

export interface AlbumLookup {
  album: AlbumSettings;
  gallery: { enabled: boolean };
  invitation: { id: string; slug: string; status: 'draft' | 'published' | 'archived'; document: unknown };
}

/** An item of the album: the gallery's row, and whether the hosts left it out. */
export type AlbumItemRow = ItemRow & { hidden?: boolean };

export interface ReadyCandidate {
  invitationId: string;
  ownerId: string;
  email: string | null;
  slug: string;
  document: unknown;
  album: AlbumSettings | null;
  photos: number;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

export const albumDb = {
  ownerGet: (id: string, ownerId: string) =>
    rpc<OwnerAlbum | null>('album_owner_get', { p_id: id, p_owner: ownerId }),
  ownerEnsure: (id: string, ownerId: string, hash: string, nonce: string) =>
    rpc<OwnerAlbum | null>('album_owner_ensure', {
      p_id: id,
      p_owner: ownerId,
      p_hash: hash,
      p_nonce: nonce,
    }),
  ownerUpdate: (id: string, ownerId: string, patch: Record<string, unknown>) =>
    rpc<OwnerAlbum | null>('album_owner_update', { p_id: id, p_owner: ownerId, p_patch: patch }),
  ownerRotate: (id: string, ownerId: string, hash: string, nonce: string) =>
    rpc<OwnerAlbum | null>('album_owner_rotate', {
      p_id: id,
      p_owner: ownerId,
      p_hash: hash,
      p_nonce: nonce,
    }),
  ownerItems: (id: string, ownerId: string, limit: number) =>
    rpc<AlbumItemRow[] | null>('album_owner_items', { p_id: id, p_owner: ownerId, p_limit: limit }),
  /** what the album shows (its link was checked first) */
  items: (invitationId: string, limit: number) =>
    rpc<AlbumItemRow[]>('album_items', { p_invitation_id: invitationId, p_all: false, p_limit: limit }),
  byToken: (hash: string) => rpc<AlbumLookup | null>('album_by_token', { p_token_hash: hash }),
  slugLocale: (slug: string) =>
    rpc<{ defaultLocale: string | null; locales: string[] | null } | null>('album_slug_locale', {
      p_slug: slug,
    }),
  invitationLink: (invitationId: string) =>
    rpc<{ tokenHash: string; tokenNonce: string; opensAt: string | null } | null>('album_invitation_link', {
      p_invitation_id: invitationId,
    }),
  readyCandidates: (from: string, to: string, limit: number) =>
    rpc<ReadyCandidate[]>('album_ready_candidates', { p_from: from, p_to: to, p_limit: limit }),
  readyMark: (invitationId: string) =>
    rpc<boolean | null>('album_ready_mark', { p_invitation_id: invitationId }),
  rateHit: (key: string, limit: number, windowSeconds: number) =>
    rpc<boolean>('gallery_rate_hit', { p_key_hash: key, p_limit: limit, p_window_seconds: windowSeconds }),
};

export type AlbumDb = typeof albumDb;

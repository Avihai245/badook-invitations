import 'server-only';
import type { GalleryNoticeRow, QueueResult, Skipped } from '@/features/live-gallery/server/notices-db';
import { serviceDb } from '@/lib/supabase/server';

/**
 * Typed access to the album thank-you's database functions (supabase/migrations/*_album.sql): the
 * hosts' dialog, queueing (a credit each) and marking, and the sender's queue. Always the service
 * role; each function checks the owner itself. The rows are the gallery link's (same dialog).
 */

export type AlbumNoticeRow = GalleryNoticeRow;
export type { Skipped };
export type AlbumQueueResult =
  | Extract<QueueResult, { ok: true }>
  | Extract<QueueResult, { code: 'credits' }>
  | { ok: false; code: 'nobody' | 'no_album'; skipped?: Skipped };

export interface ClaimedAlbumNotice {
  id: string;
  invitationId: string;
  toPhone: string;
  attempts: number | null;
  guestName: string | null;
  guestToken: string | null;
  guestLanguage?: string | null;
  slug: string;
  document: unknown;
  albumTokenHash: string | null;
  albumTokenNonce: string | null;
  albumEnabled: boolean;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

export const albumNoticesDb = {
  state: (id: string, ownerId: string) =>
    rpc<{ album: boolean; rows: AlbumNoticeRow[] } | null>('album_notices_state', {
      p_id: id,
      p_owner: ownerId,
    }),
  queue: (id: string, ownerId: string, guestIds: string[], priceUsd: number) =>
    rpc<AlbumQueueResult | null>('album_notice_queue', {
      p_id: id,
      p_owner: ownerId,
      p_guest_ids: guestIds,
      p_price_usd: priceUsd,
    }),
  mark: (id: string, ownerId: string, guestIds: string[]) =>
    rpc<number | null>('album_notice_mark', { p_id: id, p_owner: ownerId, p_guest_ids: guestIds }),
  claim: (id: string | null, limit: number) =>
    rpc<ClaimedAlbumNotice[]>('album_notice_claim', { p_id: id, p_limit: limit }),
  result: (noticeId: string, waId: string | null, error: string | null) =>
    rpc<void>('album_notice_result', { p_notice_id: noticeId, p_wa_id: waId, p_error: error }),
  requeue: (noticeId: string, error: string, waitSeconds: number) =>
    rpc<boolean>('album_notice_requeue', {
      p_notice_id: noticeId,
      p_error: error,
      p_wait_seconds: waitSeconds,
    }),
  status: (waId: string, status: string, error: string | null) =>
    rpc<boolean>('album_notice_status', { p_wa_id: waId, p_status: status, p_error: error }),
  pending: (id: string) => rpc<number>('album_notice_pending', { p_id: id }),
};

export type AlbumNoticesDb = typeof albumNoticesDb;

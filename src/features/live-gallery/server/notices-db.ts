import 'server-only';
import { serviceDb } from '@/lib/supabase/server';

/**
 * Typed access to the gallery link's database functions (supabase/migrations/*_gallery_link.sql): the
 * host's dialog, queueing (a credit each) and marking, and the sender's queue. Always the service role;
 * each function checks the owner itself.
 */

export type Reach = 'ok' | 'none' | 'landline' | 'opted_out';

export interface GalleryNoticeRow {
  guestId: string;
  name: string;
  phone: string | null;
  token: string;
  group: string | null;
  reach: Reach;
  /** the last gallery link this guest got (a failed one only when nothing else) */
  last: { channel: 'whatsapp' | 'manual'; status: string; at: string } | null;
  queued: boolean;
}

export type Skipped = Partial<Record<'noPhone' | 'landline' | 'optedOut' | 'queued', number>>;

export type QueueResult =
  | { ok: true; queued: number; balance: number; skipped?: Skipped }
  | { ok: false; code: 'credits'; needed: number; balance: number; skipped?: Skipped }
  | { ok: false; code: 'nobody' | 'no_gallery'; skipped?: Skipped };

export interface ClaimedGalleryNotice {
  id: string;
  invitationId: string;
  toPhone: string;
  attempts: number | null;
  guestName: string | null;
  guestToken: string | null;
  slug: string;
  document: unknown;
  uploadTokenHash: string | null;
  uploadTokenNonce: string | null;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

export const galleryNoticesDb = {
  state: (id: string, ownerId: string) =>
    rpc<{ gallery: boolean; rows: GalleryNoticeRow[] } | null>('gallery_notices_state', {
      p_id: id,
      p_owner: ownerId,
    }),
  queue: (id: string, ownerId: string, guestIds: string[], priceUsd: number) =>
    rpc<QueueResult | null>('gallery_notice_queue', {
      p_id: id,
      p_owner: ownerId,
      p_guest_ids: guestIds,
      p_price_usd: priceUsd,
    }),
  mark: (id: string, ownerId: string, guestIds: string[]) =>
    rpc<number | null>('gallery_notice_mark', { p_id: id, p_owner: ownerId, p_guest_ids: guestIds }),
  claim: (id: string | null, limit: number) =>
    rpc<ClaimedGalleryNotice[]>('gallery_notice_claim', { p_id: id, p_limit: limit }),
  result: (noticeId: string, waId: string | null, error: string | null) =>
    rpc<void>('gallery_notice_result', { p_notice_id: noticeId, p_wa_id: waId, p_error: error }),
  requeue: (noticeId: string, error: string, waitSeconds: number) =>
    rpc<boolean>('gallery_notice_requeue', {
      p_notice_id: noticeId,
      p_error: error,
      p_wait_seconds: waitSeconds,
    }),
  status: (waId: string, status: string, error: string | null) =>
    rpc<boolean>('gallery_notice_status', { p_wa_id: waId, p_status: status, p_error: error }),
  pending: (id: string) => rpc<number>('gallery_notice_pending', { p_id: id }),
};

export type GalleryNoticesDb = typeof galleryNoticesDb;

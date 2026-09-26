import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import type { DayInvitation, NoticeRow, Party, RecentCheckin, SeatingChange, Told, Totals } from '../model';

/**
 * Typed access to the event day's database functions (supabase/migrations/*_event_day.sql). Always the
 * service role; each function checks the owner or the link's hash itself.
 */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

type Rate = { ok: false; code: 'rate' };

export interface GuideRow {
  ok: true;
  invitation: DayInvitation;
  guest: { id: string; name: string };
  unit: { id: string; status: Party['status']; seats: number } | null;
  table: Record<string, unknown> | null;
  arrived: number;
  layout: Record<string, unknown>;
  tables: Record<string, unknown>[];
}

export interface StationOpenRow {
  ok: true;
  invitation: DayInvitation;
  channel: string;
  totals: Totals;
  recent: RecentCheckin[];
}

export type ArriveRow =
  | { ok: true; checkinId: string; party: Party; totals: Totals }
  | { ok: false; code: 'not_found' | 'invalid' };

export type UndoRow = { ok: true; party: Party; totals: Totals } | { ok: false; code: 'not_found' };

export interface OwnerDayRow {
  invitation: DayInvitation;
  day: {
    stationTokenHash: string;
    stationTokenNonce: string;
    channel: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface LiveRow {
  invitation: DayInvitation;
  layout: Record<string, unknown> & { version: number };
  tables: Record<string, unknown>[];
  parties: Party[];
  totals: Totals;
  changes: SeatingChange[];
  told: Record<string, Told>;
}

export type ReseatRow =
  | { ok: true; change: SeatingChange }
  | { ok: false; code: 'full'; table: number; capacity?: number; load?: number; need?: number }
  | { ok: false; code: 'not_found' | 'same_table' | 'empty' | 'stale' | 'number_taken' | 'already' };

export type Skipped = {
  noPhone: number;
  landline: number;
  optedOut: number;
  noTable: number;
  queued: number;
};
export type QueueRow = { skipped?: Skipped } & (
  | { ok: true; queued: number; balance: number }
  | { ok: false; code: 'credits'; needed: number; balance: number }
  | { ok: false; code: 'nobody' | 'not_published' }
);

export interface ClaimedNotice {
  id: string;
  invitationId: string;
  toPhone: string;
  attempts?: number;
  guestName: string | null;
  guestToken: string | null;
  slug: string;
  tableNumber: number;
  tableLabel: string | null;
  document: unknown;
}

export const eventDayDb = {
  // ── the guest's guide ──
  guide: (slug: string, tokenHash: string, rateKey: string) =>
    rpc<GuideRow | Rate | null>('seating_guide', {
      p_slug: slug,
      p_token_hash: tokenHash,
      p_rate_key: rateKey,
    }),

  slugLocale: (slug: string) => rpc<string | null>('event_day_slug_locale', { p_slug: slug }),

  // ── the entrance stations ──
  stationLink: (tokenHash: string) =>
    rpc<{ invitationId: string; channel: string } | null>('checkin_station_link', {
      p_token_hash: tokenHash,
    }),
  stationOpen: (tokenHash: string, rateKey: string) =>
    rpc<StationOpenRow | Rate | null>('checkin_station_open', {
      p_token_hash: tokenHash,
      p_rate_key: rateKey,
    }),
  stationFind: (tokenHash: string, code: string, rateKey: string) =>
    rpc<{ ok: true; party: Party } | { ok: false; code: 'unknown_code' } | Rate | null>(
      'checkin_station_find',
      {
        p_token_hash: tokenHash,
        p_code: code,
        p_rate_key: rateKey,
      },
    ),
  stationSearch: (tokenHash: string, query: string, rateKey: string) =>
    rpc<{ ok: true; parties: Party[] } | Rate | null>('checkin_station_search', {
      p_token_hash: tokenHash,
      p_query: query,
      p_rate_key: rateKey,
    }),
  stationArrive: (
    tokenHash: string,
    id: string,
    unitId: string,
    count: number,
    station: string,
    rateKey: string,
  ) =>
    rpc<ArriveRow | Rate | null>('checkin_station_arrive', {
      p_token_hash: tokenHash,
      p_checkin_id: id,
      p_unit_id: unitId,
      p_count: count,
      p_station: station,
      p_rate_key: rateKey,
    }),
  stationUndo: (tokenHash: string, id: string, rateKey: string) =>
    rpc<UndoRow | Rate | null>('checkin_station_undo', {
      p_token_hash: tokenHash,
      p_checkin_id: id,
      p_rate_key: rateKey,
    }),

  // ── the host ──
  ownerGet: (id: string, ownerId: string) =>
    rpc<OwnerDayRow | null>('event_day_owner_get', { p_id: id, p_owner: ownerId }),
  ownerSetup: (id: string, ownerId: string, hash: string, nonce: string, channel: string) =>
    rpc<OwnerDayRow | null>('event_day_owner_setup', {
      p_id: id,
      p_owner: ownerId,
      p_hash: hash,
      p_nonce: nonce,
      p_channel: channel,
    }),
  ownerRotate: (id: string, ownerId: string, hash: string, nonce: string, channel: string) =>
    rpc<OwnerDayRow | null>('event_day_owner_rotate', {
      p_id: id,
      p_owner: ownerId,
      p_hash: hash,
      p_nonce: nonce,
      p_channel: channel,
    }),
  live: (id: string, ownerId: string) =>
    rpc<LiveRow | null>('event_day_live', { p_id: id, p_owner: ownerId }),
  ownerArrive: (id: string, ownerId: string, checkinId: string, unitId: string, count: number) =>
    rpc<ArriveRow | null>('checkin_owner_arrive', {
      p_id: id,
      p_owner: ownerId,
      p_checkin_id: checkinId,
      p_unit_id: unitId,
      p_count: count,
    }),
  ownerUndo: (id: string, ownerId: string, checkinId: string) =>
    rpc<UndoRow | null>('checkin_owner_undo', { p_id: id, p_owner: ownerId, p_checkin_id: checkinId }),

  // ── re-seating and the audit trail ──
  move: (
    id: string,
    ownerId: string,
    unitId: string,
    tableId: string,
    reason: string | null,
    released: boolean,
    force: boolean,
  ) =>
    rpc<ReseatRow | null>('seating_live_move', {
      p_id: id,
      p_owner: ownerId,
      p_unit_id: unitId,
      p_table_id: tableId,
      p_reason: reason,
      p_released: released,
      p_force: force,
    }),
  merge: (
    id: string,
    ownerId: string,
    from: string,
    into: string,
    reason: string | null,
    released: boolean,
    force: boolean,
  ) =>
    rpc<ReseatRow | null>('seating_live_merge', {
      p_id: id,
      p_owner: ownerId,
      p_from: from,
      p_into: into,
      p_reason: reason,
      p_released: released,
      p_force: force,
    }),
  undoChange: (id: string, ownerId: string, changeId: string, released: boolean, force: boolean) =>
    rpc<ReseatRow | null>('seating_change_undo', {
      p_id: id,
      p_owner: ownerId,
      p_change_id: changeId,
      p_released: released,
      p_force: force,
    }),
  changes: (id: string, ownerId: string, limit: number) =>
    rpc<SeatingChange[] | null>('seating_changes_list', { p_id: id, p_owner: ownerId, p_limit: limit }),

  // ── telling guests their table ──
  notices: (id: string, ownerId: string) =>
    rpc<{ rows: NoticeRow[] } | null>('seating_notices_state', { p_id: id, p_owner: ownerId }),
  queueNotices: (id: string, ownerId: string, unitIds: string[], priceUsd: number) =>
    rpc<QueueRow | null>('seating_notice_queue', {
      p_id: id,
      p_owner: ownerId,
      p_unit_ids: unitIds,
      p_price_usd: priceUsd,
    }),
  markNotices: (id: string, ownerId: string, unitIds: string[]) =>
    rpc<number | null>('seating_notice_mark', { p_id: id, p_owner: ownerId, p_unit_ids: unitIds }),
  claimNotices: async (id: string | null, limit: number) =>
    (await rpc<ClaimedNotice[] | null>('seating_notice_claim', { p_id: id, p_limit: limit })) ?? [],
  noticeResult: (noticeId: string, waId: string | null, error: string | null) =>
    rpc<null>('seating_notice_result', { p_notice_id: noticeId, p_wa_id: waId, p_error: error }),
  noticeRequeue: (noticeId: string, error: string, waitSeconds: number) =>
    rpc<boolean>('seating_notice_requeue', {
      p_notice_id: noticeId,
      p_error: error,
      p_wait_seconds: waitSeconds,
    }),
  noticeStatus: (waId: string, status: string, error: string | null) =>
    rpc<boolean>('seating_notice_status', { p_wa_id: waId, p_status: status, p_error: error }),
  noticesPending: (id: string) => rpc<number>('seating_notice_pending', { p_id: id }),

  // ── housekeeping ──
  maintenance: (days: number) =>
    rpc<{ checkins: number; undone: number }>('event_day_maintenance', { p_days: days }),
};

export type EventDayDb = typeof eventDayDb;

import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import type { Audience, ScheduledSend, SendKind } from '../types';
import type { FailedSend } from './email';
import type { AlertSend } from './whatsapp';

/**
 * Typed access to the clock's database functions (supabase/migrations/*_scheduled_sends.sql). Always the
 * service role; the host's functions check the owner themselves.
 */

export type SetResult =
  { ok: true; send: ScheduledSend } | { ok: false; code: 'time_zone' | 'past' | 'too_far' | 'running' };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

export const scheduleDb = {
  list: (id: string, ownerId: string) =>
    rpc<{ timeZone: string | null; sends: ScheduledSend[] } | null>('scheduled_send_list', {
      p_id: id,
      p_owner: ownerId,
    }),
  set: (
    id: string,
    ownerId: string,
    s: { kind: SendKind; date: string; time: string; timeZone: string; audience: Audience },
  ) =>
    rpc<SetResult | null>('scheduled_send_set', {
      p_id: id,
      p_owner: ownerId,
      p_kind: s.kind,
      p_date: s.date,
      p_time: s.time,
      p_tz: s.timeZone,
      p_audience: s.audience,
    }),
  cancel: (id: string, ownerId: string, kind: SendKind) =>
    rpc<boolean | null>('scheduled_send_cancel', { p_id: id, p_owner: ownerId, p_kind: kind }),
  claim: (limit: number, staleSeconds: number) =>
    rpc<ScheduledSend[]>('scheduled_send_claim', { p_limit: limit, p_stale_seconds: staleSeconds }),
  /** failed sends whose host wasn't told yet (scheduled_send_failures) */
  failures: (limit: number) => rpc<FailedSend[]>('scheduled_send_failures', { p_limit: limit }),
  failureMailed: (id: string) => rpc<boolean>('scheduled_send_failure_mailed', { p_send: id }),
  /** failed sends whose host wasn't sent the WhatsApp alert yet (scheduled_send_failure_alerts) */
  failureAlerts: (limit: number) => rpc<AlertSend[]>('scheduled_send_failure_alerts', { p_limit: limit }),
  failureAlerted: (id: string, outcome: 'sent' | 'failed' | 'skipped') =>
    rpc<boolean>('scheduled_send_failure_alerted', { p_send: id, p_outcome: outcome }),
  finish: (
    id: string,
    status: 'done' | 'failed',
    result: Record<string, unknown> | null,
    error: string | null,
  ) =>
    rpc<boolean>('scheduled_send_finish', {
      p_send: id,
      p_status: status,
      p_result: result,
      p_error: error,
    }),
};

export type ScheduleDb = typeof scheduleDb;

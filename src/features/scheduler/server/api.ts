import 'server-only';
import { z } from 'zod';
import { packageFor, whyOff, type Feature, type FeatureInput } from '@/features/flags/features';
import { DATE_RE, TIME_RE, isTimeZone, localExists } from '../time';
import { SEND_KINDS, type ScheduleView, type SendKind } from '../types';
import type { ScheduleDb } from './db';

/**
 * The host's scheduled sends as plain functions over injected dependencies (the route wires Supabase in;
 * tests in tests/unit/scheduler.test.ts): what is scheduled for an invitation, scheduling a send for a
 * date and a time in a time zone (checked here — a zone that exists, a time that shows on the clock
 * there that day — and again by the database, which works out the moment), and taking it back. Each
 * kind needs its feature (the gallery link: live_gallery; the album's thank-you: album) and the
 * system's WhatsApp template for it.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** The feature each kind of send needs. */
export const FEATURE_OF: Record<SendKind, Feature> = { gallery_link: 'live_gallery', album_thanks: 'album' };

export interface ScheduleDeps {
  db: Pick<ScheduleDb, 'list' | 'set' | 'cancel'>;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  /** the system's number can send this kind (WhatsApp set up, its template approved) */
  ready(kind: SendKind): boolean;
}

async function gate(userId: string, id: string, kind: SendKind | null, deps: ScheduleDeps) {
  if (!isUuid(id)) return notFound;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return notFound;
  if (!kind) return null;
  const feature = FEATURE_OF[kind];
  const why = whyOff(feature, input);
  if (why) return fail(403, 'feature_off', { feature, reason: why, package: packageFor(feature) });
  return null;
}

/** GET /api/invitations/:id/schedule — the invitation's time zone and its sends (newest first). */
export async function getSchedule(userId: string, id: string, deps: ScheduleDeps): Promise<ApiResult> {
  const refused = await gate(userId, id, null, deps);
  if (refused) return refused;
  const list = await deps.db.list(id, userId);
  if (!list) return notFound;
  const view: ScheduleView = {
    timeZone: list.timeZone && isTimeZone(list.timeZone) ? list.timeZone : 'Asia/Jerusalem',
    sends: list.sends,
  };
  return ok({
    ...view,
    ready: Object.fromEntries(SEND_KINDS.map((k) => [k, deps.ready(k)])),
  });
}

export const ScheduleSchema = z.strictObject({
  kind: z.enum(SEND_KINDS),
  date: z.string().regex(DATE_RE),
  time: z.string().regex(TIME_RE),
  timeZone: z.string().min(1).max(64),
  audience: z.enum(['unsent', 'all']).default('unsent'),
});

/**
 * POST /api/invitations/:id/schedule — { kind, date, time, timeZone, audience }: schedules the send (or
 * moves the one waiting). 400 time_zone / no_such_time (the clocks jump that day), 422 past /
 * too_far, 409 running, 503 not_configured.
 */
export async function setSchedule(
  userId: string,
  id: string,
  raw: unknown,
  deps: ScheduleDeps,
): Promise<ApiResult> {
  const parsed = ScheduleSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const refused = await gate(userId, id, q.kind, deps);
  if (refused) return refused;
  if (!isTimeZone(q.timeZone)) return fail(400, 'time_zone');
  if (!localExists(q.date, q.time, q.timeZone)) return fail(400, 'no_such_time');
  if (!deps.ready(q.kind)) return fail(503, 'not_configured');
  const r = await deps.db.set(id, userId, q);
  if (!r) return notFound;
  if (!r.ok) {
    const status = r.code === 'time_zone' ? 400 : r.code === 'running' ? 409 : 422;
    return fail(status, r.code);
  }
  return ok({ send: r.send });
}

const CancelSchema = z.strictObject({ kind: z.enum(SEND_KINDS) });

/** DELETE /api/invitations/:id/schedule — { kind }: takes back the send waiting (404 when none). */
export async function cancelSchedule(
  userId: string,
  id: string,
  raw: unknown,
  deps: ScheduleDeps,
): Promise<ApiResult> {
  const parsed = CancelSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const refused = await gate(userId, id, null, deps);
  if (refused) return refused;
  const done = await deps.db.cancel(id, userId, parsed.data.kind);
  if (done === null) return notFound;
  return done ? ok({}) : fail(404, 'none');
}

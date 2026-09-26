import 'server-only';
import { z } from 'zod';
import type { Feature } from '@/features/flags/features';
import type { RealtimeInfo } from '@/lib/live/types';
import { CODE_RE } from '../codes';
import { EVENT_DAY } from '../config';
import type { EventDayDb } from './db';
import { rateKey, sha256Hex, STATION_TOKEN_RE } from './tokens';

/**
 * The entrance stations' API (/api/checkin/*) as plain functions over injected dependencies — the
 * route files only parse the request. A station is a phone or a tablet at the door, opened with the
 * station link (no account): it finds a family by the QR on the guest's table guide or by a search,
 * checks them in (all of them, or part of them), and undoes a mistake. Every call checks the link and
 * that the event has `checkin`; the database checks the link again and limits each address. Tested in
 * tests/unit/event-day-api.test.ts.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const rate = fail(429, 'rate');

export interface StationDeps {
  db: Pick<
    EventDayDb,
    'stationLink' | 'stationOpen' | 'stationFind' | 'stationSearch' | 'stationArrive' | 'stationUndo'
  >;
  /** what the event may use (feature flags) */
  features(invitationId: string): Promise<Set<Feature>>;
  broadcast(channel: string, kind: string): Promise<unknown>;
  realtime(channel: string): RealtimeInfo | null;
}

const Token = z.string().regex(STATION_TOKEN_RE);

interface Resolved {
  invitationId: string;
  channel: string;
  /** the link's hash (the database checks it again on every call) */
  hash: string;
}

/** The event behind a station link, when it may check guests in. */
async function resolve(token: string, deps: StationDeps): Promise<Resolved | null> {
  const hash = sha256Hex(token);
  const link = await deps.db.stationLink(hash);
  if (!link) return null;
  const features = await deps.features(link.invitationId);
  return features.has('checkin') ? { ...link, hash } : null;
}

const keyOf = (ip: string | null) => rateKey('station', ip ?? 'unknown');
const isRate = (v: unknown): v is { ok: false; code: 'rate' } =>
  !!v && typeof v === 'object' && (v as { code?: unknown }).code === 'rate';

/** POST /api/checkin/station { t } — what the station shows when it opens (and on each refresh). */
export async function stationState(raw: unknown, ip: string | null, deps: StationDeps): Promise<ApiResult> {
  const parsed = z.strictObject({ t: Token }).safeParse(raw);
  if (!parsed.success) return notFound;
  const r = await resolve(parsed.data.t, deps);
  if (!r) return notFound;
  const open = await deps.db.stationOpen(r.hash, keyOf(ip));
  if (!open) return notFound;
  if (isRate(open)) return rate;
  return ok({
    invitation: open.invitation,
    totals: open.totals,
    recent: open.recent,
    realtime: deps.realtime(open.channel),
  });
}

/** POST /api/checkin/find { t, code } — the family of a guest's entrance code (their QR). */
export async function findByCode(raw: unknown, ip: string | null, deps: StationDeps): Promise<ApiResult> {
  const parsed = z.strictObject({ t: Token, code: z.string().max(64) }).safeParse(raw);
  if (!parsed.success) return notFound;
  const r = await resolve(parsed.data.t, deps);
  if (!r) return notFound;
  if (!CODE_RE.test(parsed.data.code)) return fail(404, 'unknown_code');
  const found = await deps.db.stationFind(r.hash, parsed.data.code, keyOf(ip));
  if (!found) return notFound;
  if (isRate(found)) return rate;
  if (!found.ok) return fail(404, 'unknown_code');
  return ok({ party: found.party });
}

/** POST /api/checkin/search { t, q } — families by name or phone (two characters at least). */
export async function search(raw: unknown, ip: string | null, deps: StationDeps): Promise<ApiResult> {
  const parsed = z.strictObject({ t: Token, q: z.string().max(80) }).safeParse(raw);
  if (!parsed.success) return notFound;
  const r = await resolve(parsed.data.t, deps);
  if (!r) return notFound;
  const q = parsed.data.q.trim();
  if (q.length < 2) return ok({ parties: [] });
  const found = await deps.db.stationSearch(r.hash, q, keyOf(ip));
  if (!found) return notFound;
  if (isRate(found)) return rate;
  return ok({ parties: found.parties });
}

const ArriveSchema = z.strictObject({
  t: Token,
  /** the station's own id for this arrival: a retried request never counts twice */
  id: z.uuid(),
  unitId: z.uuid(),
  count: z.number().int().min(1).max(EVENT_DAY.maxCount),
  station: z.string().trim().max(EVENT_DAY.stationNameLength).optional(),
});

/** POST /api/checkin/arrive { t, id, unitId, count, station } — checks a family in (all or part). */
export async function arrive(raw: unknown, ip: string | null, deps: StationDeps): Promise<ApiResult> {
  const parsed = ArriveSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, deps);
  if (!r) return notFound;
  const done = await deps.db.stationArrive(r.hash, q.id, q.unitId, q.count, q.station || '', keyOf(ip));
  if (!done) return notFound;
  if (isRate(done)) return rate;
  if (!done.ok) return done.code === 'invalid' ? fail(400, 'invalid') : fail(404, 'unknown_party');
  await deps.broadcast(r.channel, 'checkin');
  return ok({ checkinId: done.checkinId, party: done.party, totals: done.totals });
}

/** POST /api/checkin/undo { t, id } — undoes a check-in (at this event). */
export async function undo(raw: unknown, ip: string | null, deps: StationDeps): Promise<ApiResult> {
  const parsed = z.strictObject({ t: Token, id: z.uuid() }).safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const r = await resolve(parsed.data.t, deps);
  if (!r) return notFound;
  const done = await deps.db.stationUndo(r.hash, parsed.data.id, keyOf(ip));
  if (!done) return notFound;
  if (isRate(done)) return rate;
  if (!done.ok) return fail(404, 'unknown_checkin');
  await deps.broadcast(r.channel, 'checkin');
  return ok({ party: done.party, totals: done.totals });
}

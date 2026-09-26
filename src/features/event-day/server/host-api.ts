import 'server-only';
import { z } from 'zod';
import type { PlanId } from '@/features/billing/plans';
import {
  packageFor,
  planForPackage,
  whyOff,
  type Feature,
  type FeatureInput,
  type Package,
} from '@/features/flags/features';
import { hostsLine } from '@/features/invitations/lib/text';
import type { ProcessResult } from '@/features/whatsapp/sender';
import type { RealtimeInfo } from '@/lib/live/types';
import { EVENT_DAY } from '../config';
import { eventStartMs, released } from '../live';
import {
  readHall,
  type DayInvitation,
  type Hall,
  type NoticeRow,
  type Party,
  type SeatingChange,
  type Told,
  type Totals,
} from '../model';
import type { EventDayDb, ReseatRow, Skipped } from './db';
import { newStationLink, randomId, stationToken } from './tokens';

/**
 * The host's side of the event day as plain functions over injected dependencies (the route files wire
 * Supabase in; tests in tests/unit/event-day-api.test.ts): the live hall (arrivals per table, the
 * timeline, the changes, what families were told), the entrance stations' link, checking a family in
 * from the host's own phone, re-seating live — a family moved, a table merged — with undo, and telling
 * guests their table. Every call checks the owner (the database functions do too) and the feature:
 * `checkin` for the live hall and re-seating, `seating_guide` for telling guests their table,
 * `seating` for the history.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface NotifyDeps {
  /** the system's number can send table numbers (WhatsApp set up, the template approved) */
  ready(): boolean;
  /** what one message is worth (credits are one per message) */
  priceUsd: number;
  /** sends the next batch of the invitation's queued notices */
  send(invitationId: string, limit: number): Promise<ProcessResult>;
  /** the host's credits; the platform's admins never run out (their credits are topped up) */
  account(userId: string): Promise<{ credits: number; admin: boolean }>;
  addCredits(userId: string, count: number, ref: string): Promise<void>;
}

export interface DayHostDeps {
  db: Pick<
    EventDayDb,
    | 'ownerGet'
    | 'ownerSetup'
    | 'ownerRotate'
    | 'live'
    | 'ownerArrive'
    | 'ownerUndo'
    | 'move'
    | 'merge'
    | 'undoChange'
    | 'changes'
    | 'notices'
    | 'queueNotices'
    | 'markNotices'
    | 'noticesPending'
  >;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  broadcast(channel: string, kind: string): Promise<unknown>;
  realtime(channel: string): RealtimeInfo | null;
  qr(url: string): Promise<{ svg: string; png: string }>;
  notify: NotifyDeps;
  now(): number;
}

export interface FeatureState {
  on: boolean;
  why: ReturnType<typeof whyOff>;
  package: Package;
  plan: PlanId;
}

const DAY_FEATURES = ['checkin', 'seating_guide', 'seating'] as const satisfies readonly Feature[];
export type DayFeatures = Record<(typeof DAY_FEATURES)[number], FeatureState>;

export function featureStates(input: FeatureInput): DayFeatures {
  const out = {} as DayFeatures;
  for (const f of DAY_FEATURES) {
    const why = whyOff(f, input);
    const pkg = packageFor(f);
    out[f] = { on: why === null, why, package: pkg, plan: planForPackage(pkg) };
  }
  return out;
}

/** The event is the user's and has the feature (else the answer to send). */
async function gate(
  userId: string,
  id: string,
  feature: Feature | Feature[],
  deps: Pick<DayHostDeps, 'featureInput'>,
): Promise<{ refused: ApiResult } | { input: FeatureInput & { ownerId: string } }> {
  if (!isUuid(id)) return { refused: notFound };
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return { refused: notFound };
  for (const f of Array.isArray(feature) ? feature : [feature]) {
    const why = whyOff(f, input);
    if (why)
      return { refused: fail(403, 'feature_off', { feature: f, reason: why, package: packageFor(f) }) };
  }
  return { input };
}

// ─── the live hall ──────────────────────────────────────────────────────────────────────────────

export interface DayView {
  id: string;
  invitation: DayInvitation;
  /** the event's start (ms), and whether the grace time after it has passed */
  startMs: number | null;
  released: boolean;
  features: DayFeatures;
  /** the entrance stations' link (null: the server's key changed since — offer a new one) */
  station: { url: string | null; qr: { svg: string; png: string } | null };
  realtime: RealtimeInfo | null;
  version: number;
  hall: Hall;
  parties: Party[];
  totals: Totals;
  changes: SeatingChange[];
  told: Record<string, Told>;
  /** the system's number can send table numbers */
  notifyReady: boolean;
  now: number;
}

/** The whole live screen (null: not the host's event; a refusal when `checkin` is off). */
export async function dayView(
  userId: string,
  id: string,
  base: string,
  deps: DayHostDeps,
): Promise<DayView | ApiResult> {
  const g = await gate(userId, id, 'checkin', deps);
  if ('refused' in g) return g.refused;
  // the event day is set up the first time the host opens it: the station link exists (only its hash
  // is stored) until the host shares it
  let owned = await deps.db.ownerGet(id, userId);
  if (owned && !owned.day) {
    const link = newStationLink(id);
    owned = await deps.db.ownerSetup(id, userId, link.hash, link.nonce, randomId());
  }
  const live = await deps.db.live(id, userId);
  if (!owned?.day || !live) return notFound;
  const token = stationToken(id, owned.day.stationTokenNonce, owned.day.stationTokenHash);
  const url = token ? `${base}/e/${owned.invitation.slug}/station?t=${token}` : null;
  const startMs = eventStartMs(live.invitation.date, live.invitation.startTime, live.invitation.timezone);
  const now = deps.now();
  return {
    id,
    invitation: live.invitation,
    startMs,
    released: released(startMs, now),
    features: featureStates(g.input),
    station: { url, qr: url ? await deps.qr(url) : null },
    realtime: deps.realtime(owned.day.channel),
    version: live.layout.version,
    hall: readHall(live.layout, live.tables),
    parties: live.parties,
    totals: live.totals,
    changes: live.changes,
    told: live.told,
    notifyReady: deps.notify.ready(),
    now,
  };
}

const isView = (v: DayView | ApiResult): v is DayView => 'hall' in v;

/** GET /api/invitations/:id/event-day */
export async function getDay(
  userId: string,
  id: string,
  base: string,
  deps: DayHostDeps,
): Promise<ApiResult> {
  const view = await dayView(userId, id, base, deps);
  return isView(view) ? ok({ view }) : view;
}

/** POST /api/invitations/:id/event-day/station { rotate: true } — a new station link; the old one stops working. */
export async function rotateStation(
  userId: string,
  id: string,
  raw: unknown,
  base: string,
  deps: DayHostDeps,
): Promise<ApiResult> {
  if (!z.strictObject({ rotate: z.literal(true) }).safeParse(raw).success) return fail(400, 'invalid');
  const g = await gate(userId, id, 'checkin', deps);
  if ('refused' in g) return g.refused;
  const before = await deps.db.ownerGet(id, userId);
  if (!before) return notFound;
  const link = newStationLink(id);
  const channel = randomId();
  const rotated = before.day
    ? await deps.db.ownerRotate(id, userId, link.hash, link.nonce, channel)
    : await deps.db.ownerSetup(id, userId, link.hash, link.nonce, channel);
  if (!rotated) return notFound;
  // the stations still open on the old link: "settings changed" (they find their link gone)
  if (before.day) await deps.broadcast(before.day.channel, 'settings');
  return getDay(userId, id, base, deps);
}

const HostArriveSchema = z.strictObject({
  id: z.uuid(),
  unitId: z.uuid(),
  count: z.number().int().min(1).max(EVENT_DAY.maxCount),
});

/** POST /api/invitations/:id/event-day/checkin { id, unitId, count } — the host checks a family in. */
export async function hostArrive(
  userId: string,
  id: string,
  raw: unknown,
  deps: DayHostDeps,
): Promise<ApiResult> {
  const parsed = HostArriveSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const g = await gate(userId, id, 'checkin', deps);
  if ('refused' in g) return g.refused;
  const done = await deps.db.ownerArrive(id, userId, parsed.data.id, parsed.data.unitId, parsed.data.count);
  if (!done) return notFound;
  if (!done.ok) return done.code === 'invalid' ? fail(400, 'invalid') : fail(404, 'unknown_party');
  await hint(userId, id, 'checkin', deps);
  return ok({ checkinId: done.checkinId, party: done.party, totals: done.totals });
}

/** POST /api/invitations/:id/event-day/undo { id } — the host undoes a check-in. */
export async function hostUndo(
  userId: string,
  id: string,
  raw: unknown,
  deps: DayHostDeps,
): Promise<ApiResult> {
  const parsed = z.strictObject({ id: z.uuid() }).safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const g = await gate(userId, id, 'checkin', deps);
  if ('refused' in g) return g.refused;
  const done = await deps.db.ownerUndo(id, userId, parsed.data.id);
  if (!done) return notFound;
  if (!done.ok) return fail(404, 'unknown_checkin');
  await hint(userId, id, 'checkin', deps);
  return ok({ party: done.party, totals: done.totals });
}

/** The event's open pages (stations, the host's other windows): "something changed". */
async function hint(userId: string, id: string, kind: string, deps: Pick<DayHostDeps, 'db' | 'broadcast'>) {
  const owned = await deps.db.ownerGet(id, userId);
  if (owned?.day) await deps.broadcast(owned.day.channel, kind);
}

// ─── re-seating live, and the audit trail ───────────────────────────────────────────────────────

const Reason = z.string().trim().max(EVENT_DAY.reasonLength).optional();
const ReseatSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('move'),
    unitId: z.uuid(),
    tableId: z.uuid(),
    reason: Reason,
    force: z.boolean().optional(),
    notify: z.boolean().optional(),
  }),
  z.strictObject({
    action: z.literal('merge'),
    from: z.uuid(),
    into: z.uuid(),
    reason: Reason,
    force: z.boolean().optional(),
    notify: z.boolean().optional(),
  }),
]);

/** Whether the grace time after the event's start has passed (families not arrived: seats free). */
async function releasedNow(
  userId: string,
  id: string,
  deps: Pick<DayHostDeps, 'db' | 'now'>,
): Promise<boolean> {
  const owned = await deps.db.ownerGet(id, userId);
  if (!owned) return false;
  const i = owned.invitation;
  return released(eventStartMs(i.date, i.startTime, i.timezone), deps.now());
}

function reseatAnswer(row: ReseatRow): ApiResult | null {
  if (row.ok) return null;
  if (row.code === 'full')
    return fail(409, 'full', { table: row.table, capacity: row.capacity, load: row.load, need: row.need });
  if (row.code === 'not_found') return fail(404, 'not_found');
  return fail(409, row.code);
}

/** The families a change moved to another table (they're the ones to tell). */
export const movedUnits = (change: SeatingChange): string[] =>
  change.units.filter((u) => u.to && u.from?.number !== u.to.number).map((u) => u.id);

/**
 * POST /api/invitations/:id/seating/live — during the event: { action: 'move', unitId, tableId } or
 * { action: 'merge', from, into } (every family at `from` moves to `into`), with an optional reason;
 * refused when the table can't take them live (409 full, with the numbers) unless `force` (the host
 * adds chairs). `notify`: the moved families get their new table — from the system's number when it
 * can send table numbers, else the answer lists them for the host's own WhatsApp.
 */
export async function reseat(
  userId: string,
  id: string,
  raw: unknown,
  deps: DayHostDeps,
): Promise<ApiResult> {
  const parsed = ReseatSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const g = await gate(userId, id, ['seating', 'checkin'], deps);
  if ('refused' in g) return g.refused;
  const q = parsed.data;
  const isReleased = await releasedNow(userId, id, deps);
  const row =
    q.action === 'move'
      ? await deps.db.move(id, userId, q.unitId, q.tableId, q.reason || null, isReleased, q.force ?? false)
      : await deps.db.merge(id, userId, q.from, q.into, q.reason || null, isReleased, q.force ?? false);
  if (!row) return notFound;
  const refused = reseatAnswer(row);
  if (refused || !row.ok) return refused ?? notFound;
  await hint(userId, id, 'seating', deps);
  const notified = q.notify ? await notifyUnits(userId, id, movedUnits(row.change), deps, g.input) : null;
  return ok({ change: row.change, notified });
}

const UndoSchema = z.strictObject({
  changeId: z.uuid(),
  force: z.boolean().optional(),
  notify: z.boolean().optional(),
});

/** POST /api/invitations/:id/seating/changes/undo { changeId } — families back where a change found them. */
export async function undoChange(
  userId: string,
  id: string,
  raw: unknown,
  deps: DayHostDeps,
): Promise<ApiResult> {
  const parsed = UndoSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const g = await gate(userId, id, 'seating', deps);
  if ('refused' in g) return g.refused;
  const isReleased = await releasedNow(userId, id, deps);
  const row = await deps.db.undoChange(
    id,
    userId,
    parsed.data.changeId,
    isReleased,
    parsed.data.force ?? false,
  );
  if (!row) return notFound;
  const refused = reseatAnswer(row);
  if (refused || !row.ok) return refused ?? notFound;
  await hint(userId, id, 'seating', deps);
  const notified = parsed.data.notify
    ? await notifyUnits(userId, id, movedUnits(row.change), deps, g.input)
    : null;
  return ok({ change: row.change, notified });
}

/** GET /api/invitations/:id/seating/changes — the audit trail, newest first. */
export async function listChanges(userId: string, id: string, deps: DayHostDeps): Promise<ApiResult> {
  const g = await gate(userId, id, 'seating', deps);
  if ('refused' in g) return g.refused;
  const changes = await deps.db.changes(id, userId, 100);
  return changes ? ok({ changes }) : notFound;
}

// ─── telling guests their table ─────────────────────────────────────────────────────────────────

export type NotifyOutcome =
  | { via: 'whatsapp'; queued: number; skipped?: Skipped; sent: number; failed: number; pending: number }
  | { via: 'whatsapp'; error: 'credits'; needed: number; balance: number; skipped?: Skipped }
  | { via: 'whatsapp'; error: 'nobody' | 'not_published'; skipped?: Skipped }
  | { via: 'manual'; unitIds: string[] };

/**
 * Tells these families their table now: from the system's number when it can send table numbers (and
 * the event has `seating_guide`), paying a credit each; otherwise the host gets them back to send from
 * their own WhatsApp.
 */
async function notifyUnits(
  userId: string,
  id: string,
  unitIds: string[],
  deps: DayHostDeps,
  input: FeatureInput,
): Promise<NotifyOutcome | null> {
  if (!unitIds.length) return null;
  if (!deps.notify.ready() || whyOff('seating_guide', input)) return { via: 'manual', unitIds };
  return queueAndSend(userId, id, unitIds, deps);
}

async function queueAndSend(
  userId: string,
  id: string,
  unitIds: string[],
  deps: DayHostDeps,
): Promise<NotifyOutcome> {
  const account = await deps.notify.account(userId);
  if (account.admin && account.credits < unitIds.length)
    await deps.notify.addCredits(userId, unitIds.length - account.credits, `tables:${id}`);
  const queued = await deps.db.queueNotices(id, userId, unitIds, deps.notify.priceUsd);
  if (!queued) return { via: 'whatsapp', error: 'not_published' };
  const skipped = queued.skipped ? { skipped: queued.skipped } : {};
  if (!queued.ok)
    return queued.code === 'credits'
      ? { via: 'whatsapp', error: 'credits', needed: queued.needed, balance: queued.balance, ...skipped }
      : { via: 'whatsapp', error: queued.code, ...skipped };
  const first = await deps.notify.send(id, 50);
  return {
    via: 'whatsapp',
    queued: queued.queued,
    ...skipped,
    sent: first.sent,
    failed: first.failed,
    pending: await deps.db.noticesPending(id),
  };
}

export interface NoticesView {
  rows: NoticeRow[];
  /** the system's number can send table numbers */
  ready: boolean;
  priceUsd: number;
}

/**
 * GET /api/invitations/:id/seating/notices — every family with a seat to tell, and what it was told;
 * whether the system's number can send; and what a message from the host's own WhatsApp says (the
 * invitation's language, the hosts, the guides' address).
 */
export async function noticesState(
  userId: string,
  id: string,
  base: string,
  deps: DayHostDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, 'seating_guide', deps);
  if ('refused' in g) return g.refused;
  const [state, owned, account] = await Promise.all([
    deps.db.notices(id, userId),
    deps.db.ownerGet(id, userId),
    deps.notify.account(userId),
  ]);
  if (!state || !owned) return notFound;
  const inv = owned.invitation;
  const locale = inv.defaultLocale === 'en' ? 'en' : 'he';
  return ok({
    rows: state.rows,
    ready: deps.notify.ready(),
    credits: account.credits,
    unlimited: account.admin,
    slug: inv.slug,
    own: { locale, hosts: inv.hosts ? hostsLine(inv.hosts, locale) : '' },
    base,
  });
}

const NoticesSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('send'), unitIds: z.array(z.uuid()).min(1).max(5000) }),
  z.strictObject({ action: z.literal('mark'), unitIds: z.array(z.uuid()).min(1).max(5000) }),
  z.strictObject({ action: z.literal('continue') }),
]);

/**
 * POST /api/invitations/:id/seating/notices — { action: 'send', unitIds } from the system's number (a
 * credit each; 503 until the template is approved), { action: 'mark', unitIds } told by the host
 * themselves, { action: 'continue' } the next batch of what is queued.
 */
export async function sendNotices(
  userId: string,
  id: string,
  raw: unknown,
  deps: DayHostDeps,
): Promise<ApiResult> {
  const parsed = NoticesSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const g = await gate(userId, id, 'seating_guide', deps);
  if ('refused' in g) return g.refused;
  const q = parsed.data;
  if (q.action === 'mark') {
    const n = await deps.db.markNotices(id, userId, q.unitIds);
    if (n === null) return notFound;
    await hint(userId, id, 'notices', deps);
    return ok({ marked: n });
  }
  if (!deps.notify.ready()) return fail(503, 'not_configured');
  if (q.action === 'continue') {
    const next = await deps.notify.send(id, 50);
    return ok({ ...next, pending: await deps.db.noticesPending(id) });
  }
  const outcome = await queueAndSend(userId, id, q.unitIds, deps);
  if ('error' in outcome) {
    const { error, via: _via, ...rest } = outcome;
    return error === 'credits'
      ? fail(402, 'credits', rest)
      : fail(error === 'not_published' ? 409 : 422, error, rest);
  }
  await hint(userId, id, 'notices', deps);
  const { via: _via, ...rest } = outcome;
  return ok(rest);
}

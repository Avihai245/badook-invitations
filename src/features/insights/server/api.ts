import 'server-only';
import { z } from 'zod';
import type { PlanId } from '@/features/billing/plans';
import {
  packageFor,
  planForPackage,
  whyOff,
  type FeatureInput,
  type Package,
} from '@/features/flags/features';
import type { GalleryCounts } from '@/features/live-gallery/server/db';
import { INSIGHTS } from '../config';
import {
  BOT_UA,
  BeaconSchema,
  breakdownOf,
  dayIn,
  funnelOf,
  medianSeconds,
  seriesOf,
  totalsOf,
  type BeaconState,
  type Breakdown,
  type FunnelStep,
  type SeriesPoint,
  type Totals,
} from '../model';
import type { InsightsDb, RawReport } from './db';

/**
 * The insights' API as plain functions over injected dependencies (the route files only read the
 * request; tests in tests/unit/insights-api.test.ts): the invitation page's beacon — checked, never
 * kept as sent (no address, no browser: a salted hash of the address for the rate limit only), counted
 * once per page load — and the host's report. Nothing is recorded under Global Privacy Control or Do
 * Not Track, for crawlers, or while the event doesn't have the `analytics` feature.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ─── the beacon ─────────────────────────────────────────────────────────────────────────────────

export interface BeaconDeps {
  db: Pick<InsightsDb, 'invitation' | 'hit'>;
  /** the event may use `analytics` now (features/flags) */
  analytics(invitationId: string): Promise<boolean>;
  /** the rate limit's key: a salted hash of the address */
  rateKey(ip: string | null): string;
  now(): number;
}

/** What the request says about itself (read by the route; nothing of it is kept). */
export interface BeaconRequest {
  ip: string | null;
  userAgent: string;
  /** Sec-GPC: 1 */
  gpc: boolean;
  /** DNT: 1 */
  dnt: boolean;
}

/** 204: taken (or quietly left out: privacy signals, crawlers, pages the insights don't count). */
const TAKEN: ApiResult = { status: 204, body: {} };

/** POST /api/insights — one page load's state. */
export async function beacon(raw: unknown, req: BeaconRequest, deps: BeaconDeps): Promise<ApiResult> {
  // the guest asked not to be tracked, or it isn't a person: nothing is recorded, and it looks the same
  if (req.gpc || req.dnt || !req.userAgent || BOT_UA.test(req.userAgent)) return TAKEN;
  const parsed = BeaconSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const { slug, visit, ...state } = parsed.data as BeaconState;
  // not an invitation the insights count (the site's sample invitations, one taken down): nothing is
  // recorded, and the page can't tell
  const invitation = await deps.db.invitation(slug);
  if (!invitation) return TAKEN;
  if (!(await deps.analytics(invitation.id))) return fail(403, 'feature_off', { feature: 'analytics' });
  const day = dayIn(deps.now(), invitation.timezone ?? 'Asia/Jerusalem');
  const result = await deps.db.hit(invitation.id, visit, day, state, deps.rateKey(req.ip));
  if (!result) return TAKEN;
  if (!result.ok) return result.code === 'rate' ? fail(429, 'rate') : fail(409, result.code ?? 'conflict');
  return TAKEN;
}

/** A small memory with a lifetime (per server), so most beacons cost one query. */
export function memo<K, V>(ttlMs: number, load: (key: K) => Promise<V>, max = 2_000) {
  const cache = new Map<K, { value: V; at: number }>();
  return async (key: K, now = Date.now()): Promise<V> => {
    const hit = cache.get(key);
    if (hit && now - hit.at < ttlMs) return hit.value;
    const value = await load(key);
    if (cache.size >= max) cache.delete(cache.keys().next().value as K);
    cache.set(key, { value, at: now });
    return value;
  };
}

// ─── the host's report ──────────────────────────────────────────────────────────────────────────

export interface ReportDeps {
  db: Pick<InsightsDb, 'report'>;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
}

export interface FeatureState {
  on: boolean;
  why: ReturnType<typeof whyOff>;
  package: Package;
  plan: PlanId;
}

export interface InsightsView {
  id: string;
  /** days: 7, 30, or 0 (since the invitation was published) */
  range: number;
  from: string;
  to: string;
  timezone: string;
  status: RawReport['status'];
  eventDate: string | null;
  publishedAt: string | null;
  feature: FeatureState;
  totals: Totals;
  funnel: FunnelStep[];
  medianSeconds: number | null;
  byLang: Breakdown[];
  bySource: Breakdown[];
  byDevice: Breakdown[];
  series: SeriesPoint[];
  personal: RawReport['personal'];
  responses: RawReport['responses'];
  gallery: GalleryCounts | null;
}

export const ReportQuery = z.strictObject({
  range: z.coerce
    .number()
    .int()
    .refine((v) => (INSIGHTS.ranges as readonly number[]).includes(v))
    .default(30),
});

export function featureState(input: FeatureInput): FeatureState {
  const why = whyOff('analytics', input);
  const pkg = packageFor('analytics');
  return { on: why === null, why, package: pkg, plan: planForPackage(pkg) };
}

/** The report as the screen shows it (null: not the host's invitation). */
export async function insightsView(
  userId: string,
  id: string,
  query: unknown,
  deps: ReportDeps,
): Promise<InsightsView | ApiResult | null> {
  if (!isUuid(id)) return null;
  const parsed = ReportQuery.safeParse(query ?? {});
  if (!parsed.success) return fail(400, 'invalid');
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return null;
  const feature = featureState(input);
  if (!feature.on)
    return fail(403, 'feature_off', { feature: 'analytics', reason: feature.why, package: feature.package });
  const raw = await deps.db.report(id, userId, parsed.data.range);
  if (!raw) return null;
  const totals = totalsOf(raw.days);
  return {
    id,
    range: parsed.data.range,
    from: raw.from,
    to: raw.to,
    timezone: raw.timezone,
    status: raw.status,
    eventDate: raw.eventDate,
    publishedAt: raw.publishedAt,
    feature,
    totals,
    funnel: funnelOf(totals),
    medianSeconds: medianSeconds(totals.timeHist),
    byLang: breakdownOf(totals.byLang),
    bySource: breakdownOf(totals.bySource, ['personal', 'shared', 'qr', 'other']),
    byDevice: breakdownOf(totals.byDevice, ['phone', 'tablet', 'desktop']),
    series: seriesOf(raw.days, raw.personal.firstOpens, raw.from, raw.to),
    personal: raw.personal,
    responses: raw.responses,
    gallery: raw.gallery,
  };
}

export const isResult = (v: InsightsView | ApiResult): v is ApiResult => 'body' in v;

/** GET /api/invitations/:id/insights?range= */
export async function getInsights(
  userId: string,
  id: string,
  query: unknown,
  deps: ReportDeps,
): Promise<ApiResult> {
  const view = await insightsView(userId, id, query, deps);
  if (!view) return fail(404, 'not_found');
  if (isResult(view)) return view;
  return { status: 200, body: { ok: true, view } };
}

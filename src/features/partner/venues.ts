import { z } from 'zod';
import type { ApiResult } from './api';
import { PLAN_EXT, sniffPlan, type PlanFileType } from './plan-file';

/**
 * The partner's venues (Badook Events → this app): a venue owner who opens users here for their
 * customers sends the venue's floor plan once, so a customer opening "seating" for their event starts
 * from it (supabase/migrations/*_seating.sql seating_state) and never has to deal with it.
 *
 *   PUT /api/partner/v1/venues/{venueId} { name, address?, widthMeters?, floorPlan?: { url } | { base64 } }
 *   GET /api/partner/v1/venues/{venueId}
 *
 * Plain functions over injected dependencies; tested in tests/unit/partner-venues.test.ts; the contract
 * for the partner is docs/partner-api.md.
 */

/** The biggest floor plan file accepted (the storage bucket's limit). */
export const MAX_PLAN_BYTES = 15 * 1024 * 1024;

export interface VenueRecord {
  venueId: string;
  name: string;
  address: string | null;
  widthMeters: number | null;
  floorPlan: {
    path: string;
    contentType: PlanFileType;
    width: number | null;
    height: number | null;
    bytes: number;
    updatedAt: string;
  } | null;
  users: number;
  createdAt: string;
  updatedAt: string;
}

export type VenuePutAnswer =
  | { ok: true; created: boolean; venue: VenueRecord; replacedPlan: string | null }
  | { ok: false; code: 'name_required' };

export type PlanSource = { url: string } | { base64: string; contentType?: string };

export interface VenueDeps {
  /** false once the partner is over its hourly limit */
  rateHit(): Promise<boolean>;
  get(venueId: string): Promise<VenueRecord | null>;
  put(
    venueId: string,
    fields: readonly ('name' | 'address' | 'widthMeters' | 'floorPlan')[],
    values: { name: string | null; address: string | null; widthMeters: number | null },
    plan: {
      path: string;
      contentType: PlanFileType;
      width: number | null;
      height: number | null;
      bytes: number;
    } | null,
  ): Promise<VenuePutAnswer>;
  /** the plan's URL, fetched safely (fetch-plan.ts) */
  fetchPlan(url: string): Promise<Uint8Array>;
  /** stores a plan file in the venue-plans bucket */
  store(path: string, bytes: Uint8Array, contentType: PlanFileType): Promise<void>;
  remove(path: string): Promise<void>;
  /** the public URL of a stored plan */
  planUrl(path: string): string;
  /** a folder name for the venue's files: stable per venue, not its id */
  folder(venueId: string): string;
  newId(): string;
}

const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

/** The partner's id for a venue, as it appears in the path. */
export const VenueIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:~-]{0,199}$/);

const PlanSchema = z.union([
  z.strictObject({ url: z.url({ protocol: /^https$/ }).max(2000) }),
  z.strictObject({
    base64: z
      .string()
      .min(8)
      .max(Math.ceil((MAX_PLAN_BYTES * 4) / 3) + 16),
    contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']).optional(),
  }),
]);

export const VenuePutSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(300).nullable().optional(),
  /** how many meters the plan's full width shows (its scale) */
  widthMeters: z.number().finite().gt(0).max(5000).nullable().optional(),
  floorPlan: PlanSchema.nullable().optional(),
});

/** What the partner sees of a venue: its plan as a public URL, not our storage path. */
export function venueView(v: VenueRecord, deps: Pick<VenueDeps, 'planUrl'>) {
  return {
    venueId: v.venueId,
    name: v.name,
    address: v.address,
    widthMeters: v.widthMeters,
    floorPlan: v.floorPlan
      ? {
          url: deps.planUrl(v.floorPlan.path),
          contentType: v.floorPlan.contentType,
          width: v.floorPlan.width,
          height: v.floorPlan.height,
          bytes: v.floorPlan.bytes,
          updatedAt: v.floorPlan.updatedAt,
        }
      : null,
    users: v.users,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

const invalid = (error: z.ZodError) =>
  fail(400, 'invalid', { fields: [...new Set(error.issues.map((i) => i.path.join('.') || '(body)'))] });

function decodeBase64(text: string): Uint8Array | null {
  // a data: URL is fine too
  const body = text.replace(/^data:[^,]*;base64,/i, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(body)) return null;
  return new Uint8Array(Buffer.from(body, body.includes('-') || body.includes('_') ? 'base64url' : 'base64'));
}

/**
 * PUT /api/partner/v1/venues/{venueId} — creates the venue (name required) or updates it: only the
 * fields sent change (null clears address, widthMeters or the plan). A floor plan comes by URL (the
 * server fetches it: https, public addresses only, 15 MB at most) or as base64; what the bytes really
 * are decides (PNG, JPEG, WebP or PDF), never the declared type.
 */
export async function putVenue(venueIdRaw: string, raw: unknown, deps: VenueDeps): Promise<ApiResult> {
  if (!(await deps.rateHit())) return fail(429, 'rate_limited');
  const venueId = VenueIdSchema.safeParse(venueIdRaw);
  if (!venueId.success) return fail(400, 'invalid', { fields: ['venueId'] });
  const parsed = VenuePutSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const body = parsed.data;
  const fields = (['name', 'address', 'widthMeters', 'floorPlan'] as const).filter(
    (k) => body[k] !== undefined,
  );
  if (!fields.length) return fail(400, 'invalid', { fields: ['(body)'] });
  // a new venue needs its name — found out before fetching a plan for nothing
  if (body.name === undefined && body.floorPlan && !(await deps.get(venueId.data)))
    return fail(400, 'invalid', { fields: ['name'] });

  let plan: Parameters<VenueDeps['put']>[3] = null;
  if (body.floorPlan) {
    let bytes: Uint8Array | null;
    if ('url' in body.floorPlan) {
      try {
        bytes = await deps.fetchPlan(body.floorPlan.url);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'too_large') return fail(413, 'too_large', { max: MAX_PLAN_BYTES });
        if (code === 'bad_url' || code === 'blocked_address')
          return fail(400, 'invalid', { fields: ['floorPlan.url'] });
        return fail(422, 'fetch_failed', { status: (err as { status?: number }).status ?? null });
      }
    } else {
      bytes = decodeBase64(body.floorPlan.base64);
      if (!bytes?.length) return fail(400, 'invalid', { fields: ['floorPlan.base64'] });
    }
    if (bytes.length > MAX_PLAN_BYTES) return fail(413, 'too_large', { max: MAX_PLAN_BYTES });
    const sniffed = sniffPlan(bytes);
    if (!sniffed) return fail(415, 'unsupported_type');
    const path = `venues/${deps.folder(venueId.data)}/${deps.newId()}.${PLAN_EXT[sniffed.type]}`;
    await deps.store(path, bytes, sniffed.type);
    plan = {
      path,
      contentType: sniffed.type,
      width: sniffed.width,
      height: sniffed.height,
      bytes: bytes.length,
    };
  }

  const answer = await deps.put(
    venueId.data,
    fields,
    { name: body.name ?? null, address: body.address ?? null, widthMeters: body.widthMeters ?? null },
    plan,
  );
  if (!answer.ok) {
    if (plan) await deps.remove(plan.path).catch(() => {});
    return fail(400, 'invalid', { fields: ['name'] });
  }
  // the plan it replaced, when no event's seating uses it any more
  if (answer.replacedPlan)
    await deps.remove(answer.replacedPlan).catch((err) => console.error('[partner api] old plan', err));
  return {
    status: answer.created ? 201 : 200,
    body: { ok: true, created: answer.created, venue: venueView(answer.venue, deps) },
  };
}

/** GET /api/partner/v1/venues/{venueId} — the venue, its plan and how many of the partner's users it has. */
export async function getVenue(venueIdRaw: string, deps: VenueDeps): Promise<ApiResult> {
  if (!(await deps.rateHit())) return fail(429, 'rate_limited');
  const venueId = VenueIdSchema.safeParse(venueIdRaw);
  if (!venueId.success) return fail(400, 'invalid', { fields: ['venueId'] });
  const venue = await deps.get(venueId.data);
  return venue ? { status: 200, body: { ok: true, venue: venueView(venue, deps) } } : fail(404, 'not_found');
}

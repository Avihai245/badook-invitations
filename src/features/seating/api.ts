import { z } from 'zod';
import { packageFor, whyOff, type Feature, type FeatureInput } from '../flags/features';
import { LIMITS, readState, SaveSchema, toDbPlan, type SeatingState } from './model';

/**
 * The seating screen's API (GET / POST /api/invitations/:id/seating, POST …/seating/upload) as plain
 * functions over injected dependencies — the route files wire Supabase in. Tested in
 * tests/unit/seating-api.test.ts. Every call checks that the event is the signed-in host's and that it
 * has the `seating` feature (docs/features.md).
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>, status = 200): ApiResult => ({
  status,
  body: { ok: true, ...body },
});
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

export type SaveAnswer =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; code: 'conflict'; version: number }
  | { ok: false; code: 'over_capacity'; table: number }
  | { ok: false; code: 'invalid'; reason?: string };

export interface SeatingDeps {
  /** the event's feature inputs and owner (null: no such event) */
  access(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  state(invitationId: string, ownerId: string): Promise<unknown | null>;
  save(invitationId: string, ownerId: string, version: number, plan: unknown): Promise<SaveAnswer | null>;
  /** a signed upload URL for this path in the venue-plans bucket */
  signedUpload(path: string): Promise<{ path: string; url: string; token: string }>;
  newId(): string;
}

const isUuid = (v: string) => z.uuid().safeParse(v).success;
const notFound = fail(404, 'not_found');

/** The event is the user's and may use seating (else the answer to send). */
async function gate(
  userId: string,
  id: string,
  deps: SeatingDeps,
  feature: Feature = 'seating',
): Promise<ApiResult | null> {
  if (!isUuid(id)) return notFound;
  const input = await deps.access(id);
  if (!input || input.ownerId !== userId) return notFound;
  const why = whyOff(feature, input);
  if (why) return fail(403, 'feature_off', { feature, reason: why, package: packageFor(feature) });
  return null;
}

/** GET — the plan, the units and the owner's venue. */
export async function loadSeating(userId: string, id: string, deps: SeatingDeps): Promise<ApiResult> {
  const refused = await gate(userId, id, deps);
  if (refused) return refused;
  const raw = await deps.state(id, userId);
  if (!raw) return notFound;
  return ok({ state: readState(raw) satisfies SeatingState });
}

/**
 * POST { version, plan } — saves the plan on top of the version it was loaded at. 409 conflict (with
 * the stored version: the editor merges and saves again), 422 over_capacity (with the table's number),
 * 400 invalid.
 */
export async function saveSeating(
  userId: string,
  id: string,
  raw: unknown,
  deps: SeatingDeps,
): Promise<ApiResult> {
  const refused = await gate(userId, id, deps);
  if (refused) return refused;
  const parsed = SaveSchema.safeParse(raw);
  if (!parsed.success)
    return fail(400, 'invalid', {
      fields: [...new Set(parsed.error.issues.map((i) => i.path.slice(0, 2).join('.')))].slice(0, 10),
    });
  const { version, plan } = parsed.data;
  const tableIds = new Set(plan.tables.map((t) => t.id));
  if (Object.values(plan.assignments).some((a) => !tableIds.has(a.tableId)))
    return fail(400, 'invalid', { fields: ['plan.assignments'] });
  if (new Set(plan.tables.map((t) => t.number)).size !== plan.tables.length)
    return fail(400, 'invalid', { fields: ['plan.tables'] });
  if (Object.keys(plan.assignments).length > LIMITS.units || Object.keys(plan.units).length > LIMITS.units)
    return fail(400, 'invalid', { fields: ['plan.assignments'] });
  const answer = await deps.save(id, userId, version, toDbPlan(plan));
  if (!answer) return notFound;
  if (answer.ok) return ok({ version: answer.version, updatedAt: answer.updatedAt });
  if (answer.code === 'conflict') return fail(409, 'conflict', { version: answer.version });
  if (answer.code === 'over_capacity') return fail(422, 'over_capacity', { table: answer.table });
  return fail(400, 'invalid', answer.reason ? { reason: answer.reason } : {});
}

/** The plan images the browser uploads (a PDF is turned into one of these first). */
export const PLAN_UPLOAD_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const UploadSchema = z.strictObject({ contentType: z.string(), size: z.number().int().positive() });

/**
 * POST …/seating/upload { contentType, size } — a signed upload URL for the event's floor plan
 * (venue-plans/<owner>/<invitation>/<uuid>.<ext>); the browser uploads the file straight to storage.
 */
export async function createPlanUpload(
  userId: string,
  id: string,
  raw: unknown,
  deps: SeatingDeps,
): Promise<ApiResult> {
  const refused = await gate(userId, id, deps);
  if (refused) return refused;
  const parsed = UploadSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const ext = PLAN_UPLOAD_TYPES[parsed.data.contentType];
  if (!ext) return fail(415, 'unsupported_type');
  if (parsed.data.size > LIMITS.planBytes) return fail(413, 'too_large', { max: LIMITS.planBytes });
  const signed = await deps.signedUpload(`${userId}/${id}/${deps.newId()}.${ext}`);
  return ok({ path: signed.path, url: signed.url, token: signed.token });
}

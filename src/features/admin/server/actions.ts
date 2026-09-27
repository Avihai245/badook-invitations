import { z } from 'zod';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { FEATURES } from '@/features/flags/features';
import { CREDIT_CAPS, REASON_MAX, REASON_MIN } from '../lists';
import { STAFF_ROLES, can, manageableRoles, type StaffRole } from '../permissions';
import type { AuditTarget, StaffMember } from './db';
import type { AdminNudgeKind } from './live';

export { CREDIT_CAPS } from '../lists';

/**
 * What the console's staff do (the /api/admin/* routes, behind adminRoute: staff, the permission, a
 * rate limit): credits, a plan as a gift, a discount, sign-in suspended or restored, a feature granted
 * to an invitation, the staff themselves, the live channel renamed. Each checks its input, lets the
 * database check the role and the rules again (its refusals come back as 409 with their reason), and
 * tells the open console pages after the answer. Plain functions over injected dependencies:
 * tests/unit/admin-actions.test.ts.
 */

export interface ActionStaff {
  userId: string;
  email: string;
  role: StaffRole;
}

export interface ActionDeps {
  credits(actor: string, userId: string, delta: number, reason: string): Promise<{ balance: number }>;
  gift(
    actor: string,
    userId: string,
    plan: 'pro' | 'business' | null,
    lastDay: string | null,
    reason: string,
  ): Promise<unknown>;
  discount(
    actor: string,
    userId: string,
    percent: number | null,
    lastDay: string | null,
    note: string | null,
    reason: string,
  ): Promise<unknown>;
  suspendCheck(
    actor: string,
    userId: string,
    suspend: boolean,
    reason: string,
  ): Promise<{ email: string; suspended: boolean }>;
  /** Supabase Auth: the user's sign-in refused (a ban) or allowed again */
  ban(userId: string, suspend: boolean): Promise<void>;
  audit(
    actor: string,
    action: string,
    targetType: AuditTarget,
    targetId: string,
    details: Record<string, unknown>,
  ): Promise<number>;
  feature(
    actor: string,
    invitationId: string,
    feature: string,
    grant: boolean,
    reason: string,
  ): Promise<unknown>;
  staffSet(
    actor: string,
    email: string,
    role: StaffRole,
    note: string | null,
    reason: string,
  ): Promise<StaffMember>;
  staffRemove(actor: string, email: string, reason: string): Promise<boolean>;
  /** a new name for the console's live channel (owners) */
  renameChannel(): Promise<void>;
  /** tells the console's open pages, after the answer */
  nudge(kind: AdminNudgeKind): void;
}

const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const invalid = (error: z.ZodError) =>
  fail(400, 'invalid', { fields: [...new Set(error.issues.map((i) => String(i.path[0] ?? '')))] });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = fail(404, 'not_found');

/** Why the team did it: 3–200 characters (the database checks it again). */
const Reason = z.string().trim().min(REASON_MIN).max(REASON_MAX);
/** A day in Israel, YYYY-MM-DD. */
const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)));

const CreditsSchema = z.strictObject({
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0 && Math.abs(n) <= 100_000),
  reason: Reason,
});

/** POST /api/admin/users/:id/credits { delta, reason } — adds (or removes) credits. */
export async function addCredits(
  staff: ActionStaff,
  userId: string,
  raw: unknown,
  deps: ActionDeps,
): Promise<ApiResult> {
  if (!UUID.test(userId)) return notFound;
  const parsed = CreditsSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (Math.abs(parsed.data.delta) > CREDIT_CAPS[staff.role])
    return fail(409, 'over_cap', { cap: CREDIT_CAPS[staff.role] });
  const { balance } = await deps.credits(staff.userId, userId, parsed.data.delta, parsed.data.reason);
  deps.nudge('credits');
  return ok({ ok: true, balance });
}

const GiftSchema = z.union([
  z.strictObject({ plan: z.enum(['pro', 'business']), lastDay: Day, reason: Reason }),
  z.strictObject({ plan: z.null(), reason: Reason }),
]);

/** POST /api/admin/users/:id/gift { plan, lastDay, reason } | { plan: null, reason } — a plan as a gift. */
export async function giftPlan(
  staff: ActionStaff,
  userId: string,
  raw: unknown,
  deps: ActionDeps,
): Promise<ApiResult> {
  if (!UUID.test(userId)) return notFound;
  const parsed = GiftSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const plan = await deps.gift(staff.userId, userId, d.plan, d.plan ? d.lastDay : null, d.reason);
  deps.nudge('user');
  return ok({ ok: true, plan });
}

const DiscountSchema = z.union([
  z.strictObject({
    percent: z.number().int().min(1).max(90),
    lastDay: Day.nullable(),
    note: z.string().trim().max(200).nullable(),
    reason: Reason,
  }),
  z.strictObject({ percent: z.null(), reason: Reason }),
]);

/** POST /api/admin/users/:id/discount { percent, lastDay, note, reason } | { percent: null, reason }. */
export async function setDiscount(
  staff: ActionStaff,
  userId: string,
  raw: unknown,
  deps: ActionDeps,
): Promise<ApiResult> {
  if (!UUID.test(userId)) return notFound;
  const parsed = DiscountSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const discount =
    d.percent === null
      ? await deps.discount(staff.userId, userId, null, null, null, d.reason)
      : await deps.discount(staff.userId, userId, d.percent, d.lastDay, d.note || null, d.reason);
  deps.nudge('user');
  return ok({ ok: true, discount });
}

const SuspendSchema = z.strictObject({ suspend: z.boolean(), reason: Reason });

/**
 * POST /api/admin/users/:id/suspend { suspend, reason } — the user's sign-in refused (a Supabase Auth
 * ban, as long as it can be) or allowed again. The database checks first (never oneself, never a staff
 * member of one's rank or above); then Auth; then the record — and if the record can't be written, the
 * ban is taken back, so nothing happens that isn't recorded.
 */
export async function suspendUser(
  staff: ActionStaff,
  userId: string,
  raw: unknown,
  deps: ActionDeps,
): Promise<ApiResult> {
  if (!UUID.test(userId)) return notFound;
  const parsed = SuspendSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { suspend, reason } = parsed.data;
  if (userId === staff.userId) return fail(409, 'self');
  await deps.suspendCheck(staff.userId, userId, suspend, reason);
  await deps.ban(userId, suspend);
  try {
    await deps.audit(staff.userId, suspend ? 'users.suspend' : 'users.restore', 'user', userId, { reason });
  } catch (err) {
    await deps.ban(userId, !suspend).catch((undo) => console.error('[admin] suspend: undo failed', undo));
    throw err;
  }
  deps.nudge('user');
  return ok({ ok: true, suspended: suspend });
}

const FeatureSchema = z.strictObject({ feature: z.enum(FEATURES), grant: z.boolean(), reason: Reason });

/** POST /api/admin/invitations/:id/features { feature, grant, reason } — beyond the owner's plan. */
export async function grantFeature(
  staff: ActionStaff,
  invitationId: string,
  raw: unknown,
  deps: ActionDeps,
): Promise<ApiResult> {
  if (!UUID.test(invitationId)) return notFound;
  const parsed = FeatureSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { feature, grant, reason } = parsed.data;
  const overrides = await deps.feature(staff.userId, invitationId, feature, grant, reason);
  deps.nudge('invitation');
  return ok({ ok: true, overrides });
}

const Email = z.string().trim().toLowerCase().max(254).pipe(z.email());

const StaffSetSchema = z.strictObject({
  email: Email,
  role: z.enum(STAFF_ROLES),
  note: z.string().trim().max(200).nullable().optional(),
  reason: Reason,
});

/**
 * POST /api/admin/staff { email, role, note, reason } — adds a member or changes their role (who may
 * open the console and do what: a reason, like every change of access).
 */
export async function setStaff(staff: ActionStaff, raw: unknown, deps: ActionDeps): Promise<ApiResult> {
  const parsed = StaffSetSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { email, role, note, reason } = parsed.data;
  // (the database decides; this only answers early)
  if (!manageableRoles(staff.role).includes(role)) return fail(403, 'forbidden');
  if (email === staff.email) return fail(409, 'self');
  const member = await deps.staffSet(staff.userId, email, role, note || null, reason);
  deps.nudge('staff');
  return ok({ ok: true, member });
}

const StaffRemoveSchema = z.strictObject({ email: Email, reason: Reason });

/** DELETE /api/admin/staff { email, reason } — the member leaves the console. */
export async function removeStaff(staff: ActionStaff, raw: unknown, deps: ActionDeps): Promise<ApiResult> {
  const parsed = StaffRemoveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.email === staff.email) return fail(409, 'self');
  const removed = await deps.staffRemove(staff.userId, parsed.data.email, parsed.data.reason);
  if (!removed) return notFound;
  deps.nudge('staff');
  return ok({ ok: true });
}

/** POST /api/admin/system/channel {} — a new name for the live channel (owners: staff.owners). */
export async function renameChannel(staff: ActionStaff, deps: ActionDeps): Promise<ApiResult> {
  if (!can(staff.role, 'staff.owners')) return fail(403, 'forbidden');
  await deps.renameChannel();
  deps.nudge('system');
  return ok({ ok: true });
}

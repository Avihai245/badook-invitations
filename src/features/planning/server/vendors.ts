import { toE164 } from '@/features/invitations/lib/phone';
import { readIntegrations } from '../model/integrations';
import type { PlanVendor } from '../model/plan';
import { VendorOp, type ClosePlanInput, type VendorPatchInput } from '../model/schemas-vendors';
import { fail, gate, isRefusal, notFound, ok, rawState, type ApiResult, type PlanningDeps } from './types';

/**
 * The vendors API (POST /api/invitations/:id/planning/vendors) as a plain function over injected
 * dependencies, like the tasks'. Tested in tests/unit/planning-vendors.test.ts. A vendor is the host's
 * own, kept in this event's plan: nothing is imported from, or shared with, anywhere else.
 */

const invalid = (error: { issues: { path: PropertyKey[] }[] }) =>
  fail(400, 'invalid', {
    fields: [...new Set(error.issues.map((i) => i.path.slice(0, 3).join('.')))].slice(0, 10),
  });

/** A refusal the database gave (or null: not the host's), as the answer to send. */
function refusal(answer: unknown): ApiResult | null {
  if (answer === null || answer === undefined) return notFound;
  const a = answer as { ok?: boolean; code?: string };
  if (a.ok === false) return fail(a.code === 'too_many' ? 422 : 400, a.code ?? 'invalid');
  return null;
}

/** The file paths a vendor may hold: in this event's own folder, one level deep, nothing climbing out. */
const ownFile = (userId: string, id: string, path: string) => {
  const prefix = `${userId}/${id}/`;
  return path.startsWith(prefix) && !path.includes('..') && !path.slice(prefix.length).includes('/');
};

/**
 * Attachments are the paid tool's (`planning_export`) — but what a vendor already holds stays reachable
 * after a downgrade: only files that are not on it yet need the feature. Null when it is fine.
 */
async function attachmentsRefusal(
  userId: string,
  id: string,
  vendor: VendorPatchInput,
  deps: PlanningDeps,
): Promise<ApiResult | null> {
  const list = vendor.attachments ?? [];
  if (list.length === 0) return null;
  if (list.some((a) => !ownFile(userId, id, a.path)))
    return fail(400, 'invalid', { fields: ['vendor.attachments'] });
  let held = new Set<string>();
  if (vendor.id) {
    const raw = await rawState(deps, id, userId);
    const current: PlanVendor | undefined = raw?.vendors.find((v) => v.id === vendor.id);
    held = new Set((current?.attachments ?? []).map((a) => a.path));
  }
  if (list.every((a) => held.has(a.path))) return null;
  const paid = await gate(userId, id, deps, 'planning_export');
  return isRefusal(paid) ? paid : null;
}

/** What the database takes of a plan to close with: the price is the item's amount. */
function closePlan(plan: ClosePlanInput | undefined): Record<string, unknown> {
  if (!plan) return {};
  const out: Record<string, unknown> = {};
  if (plan.item) {
    out.item = plan.item;
    if (plan.item.amount !== null && plan.item.amount !== undefined) out.amount = plan.item.amount;
  }
  if (plan.payments?.length) out.payments = plan.payments;
  if (plan.tasks?.length) out.tasks = plan.tasks;
  return out;
}

/**
 * POST …/planning/vendors { op: 'save' | 'delete' | 'close' | 'undo_close', … }:
 * - save { vendor }: add or change one (a new id is theirs to choose: undoing a delete puts the same vendor
 *   back); the phone is normalized when it parses, else kept as typed → { vendor }
 * - delete { ids } → { deleted }
 * - close { id, plan? }: booked, and — when the plan's vendor integration is on — the budget item, payment
 *   schedule and tasks in `plan`, all or nothing → { vendor, previous, created }
 * - undo_close { id, previous, created }: takes that close back → {}
 */
export async function vendorOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const parsed = VendorOp.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  switch (input.op) {
    case 'save': {
      const vendor = { ...input.vendor };
      if (typeof vendor.phone === 'string') vendor.phone = toE164(vendor.phone);
      const refused = await attachmentsRefusal(userId, id, vendor, deps);
      if (refused) return refused;
      const saved = await deps.rpc<PlanVendor | { ok: false; code: string } | null>('planning_vendor_save', {
        p_id: id,
        p_owner: userId,
        p_vendor: vendor,
      });
      return refusal(saved) ?? ok({ vendor: saved });
    }
    case 'delete': {
      const deleted = await deps.rpc<number | null>('planning_vendor_delete', {
        p_id: id,
        p_owner: userId,
        p_ids: input.ids,
      });
      return refusal(deleted) ?? ok({ deleted });
    }
    case 'close': {
      // the budget follows the vendors only when the host left that connection on
      const raw = await rawState(deps, id, userId);
      if (!raw) return notFound;
      const plan = readIntegrations(raw.settings?.integrations).vendors ? closePlan(input.plan) : {};
      const closed = await deps.rpc<Record<string, unknown> | { ok: false; code: string } | null>(
        'planning_vendor_close',
        { p_id: id, p_owner: userId, p_vendor: input.id, p_plan: plan },
      );
      return refusal(closed) ?? ok(closed as Record<string, unknown>);
    }
    case 'undo_close': {
      const undone = await deps.rpc<boolean>('planning_vendor_undo_close', {
        p_id: id,
        p_owner: userId,
        p_vendor: input.id,
        p_previous: input.previous,
        p_created: input.created,
      });
      return undone ? ok({}) : notFound;
    }
  }
}

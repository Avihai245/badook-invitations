import type { FeatureInput } from '@/features/flags/features';
import type { Feature } from '@/features/flags/features';
import { packageFor, whyOff } from '@/features/flags/features';
import { z } from 'zod';
import type { PrivateTemplateItems } from '../model/draft';
import type { RawPlanState } from '../model/plan';

/** What the planning API needs from the outside (the database, the clock, the owner's plan), injected. */

export type ApiResult = { status: number; body: Record<string, unknown> };
export const ok = (body: Record<string, unknown>, status = 200): ApiResult => ({
  status,
  body: { ok: true, ...body },
});
export const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
export const notFound = fail(404, 'not_found');
export const isUuid = (v: string) => z.uuid().safeParse(v).success;

/** The invitation as the system tasks see it (from the owner's list: features/invitations/server/host-db). */
export interface PlanSummary {
  eventType: string;
  status: 'draft' | 'published' | 'archived';
  unpublishedChanges: boolean;
  guests: number;
  sent: number;
  responses: number;
}

export interface PlanningDeps {
  /** the event's feature inputs and owner (null: no such event) */
  access(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  /** a planning database function, called with the service role (each checks the owner itself) */
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>;
  summary(invitationId: string, ownerId: string): Promise<PlanSummary | null>;
  now(): number;
  newId(): string;
  /** one of the owner's private templates (the Business plan), null when it isn't theirs */
  privateTemplate?(id: string, ownerId: string): Promise<PrivateTemplateItems | null>;
  /** a signed upload URL / signed read URLs in the plan-files bucket */
  signedUpload?(path: string): Promise<{ path: string; url: string; token: string }>;
  signedReads?(paths: string[]): Promise<Record<string, string>>;
}

/**
 * The event is the user's and may use `feature` (else the answer to send). `planning` is the section
 * itself; the others are the paid tools inside it.
 */
export async function gate(
  userId: string,
  id: string,
  deps: PlanningDeps,
  feature: Feature = 'planning',
): Promise<{ input: FeatureInput & { ownerId: string } } | ApiResult> {
  if (!isUuid(id)) return notFound;
  const input = await deps.access(id);
  if (!input || input.ownerId !== userId) return notFound;
  // the section itself must be on for any of its tools
  const base = whyOff('planning', input);
  if (base === 'unavailable') return notFound;
  if (base)
    return fail(403, 'feature_off', { feature: 'planning', reason: base, package: packageFor('planning') });
  if (feature !== 'planning') {
    const why = whyOff(feature, input);
    if (why) return fail(403, 'feature_off', { feature, reason: why, package: packageFor(feature) });
  }
  return { input };
}

export const isRefusal = (g: Awaited<ReturnType<typeof gate>>): g is ApiResult => 'status' in g;

/** The state of an event's plan (null: not the owner's). */
export async function rawState(
  deps: PlanningDeps,
  id: string,
  ownerId: string,
): Promise<RawPlanState | null> {
  return deps.rpc<RawPlanState | null>('planning_state', { p_id: id, p_owner: ownerId });
}

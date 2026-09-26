import { z } from 'zod';
import {
  FEATURES,
  effectiveFeatures,
  packageFor,
  whyOff,
  type Feature,
  type FeatureInput,
  type FeatureOverrides,
  type Package,
} from './features';

/**
 * The host's view of an event's features (GET /api/invitations/:id/features) and switching one off
 * for the event, or back on (PATCH). Plain functions over injected dependencies: tests/unit/flags.test.ts.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };

export interface FlagDeps {
  /** the event's inputs and its owner (null: no such event) */
  input(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  /** the host switches a feature off for the event, or back to what the plan gives */
  setOff(
    invitationId: string,
    ownerId: string,
    feature: Feature,
    off: boolean,
  ): Promise<FeatureOverrides | null>;
}

const notFound: ApiResult = { status: 404, body: { ok: false, code: 'not_found' } };
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Every feature with its state for the event: on, or why not, and the package that has it. */
export function describe(input: FeatureInput): {
  features: Feature[];
  items: { feature: Feature; on: boolean; why: ReturnType<typeof whyOff>; package: Package }[];
} {
  const on = effectiveFeatures(input);
  return {
    features: FEATURES.filter((f) => on.has(f)),
    items: FEATURES.map((f) => ({
      feature: f,
      on: on.has(f),
      why: whyOff(f, input),
      package: packageFor(f),
    })),
  };
}

export async function getEventFeatures(
  userId: string,
  invitationId: string,
  deps: FlagDeps,
): Promise<ApiResult> {
  if (!isUuid(invitationId)) return notFound;
  const input = await deps.input(invitationId);
  if (!input || input.ownerId !== userId) return notFound;
  return { status: 200, body: { ok: true, ...describe(input) } };
}

const SetSchema = z.strictObject({ feature: z.enum(FEATURES), off: z.boolean() });

export async function setEventFeature(
  userId: string,
  invitationId: string,
  raw: unknown,
  deps: FlagDeps,
): Promise<ApiResult> {
  if (!isUuid(invitationId)) return notFound;
  const parsed = SetSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { ok: false, code: 'invalid' } };
  const input = await deps.input(invitationId);
  if (!input || input.ownerId !== userId) return notFound;
  const overrides = await deps.setOff(invitationId, userId, parsed.data.feature, parsed.data.off);
  if (!overrides) return notFound;
  return { status: 200, body: { ok: true, ...describe({ ...input, overrides }) } };
}

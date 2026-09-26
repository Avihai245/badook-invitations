import 'server-only';
import { isAdminEmail } from '@/features/billing/server/account';
import { effectivePlan, isPlanId, type AccountPlanState } from '@/features/billing/plans';
import { serverEnv, type ServerEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import type { FlagDeps } from './api';
import { FEATURES, effectiveFeatures, readOverrides, type Feature, type FeatureInput } from './features';

/**
 * What this deployment offers: every feature but those switched off here (INVITES_FEATURES_OFF), the
 * ones that need an AI model when none is set up, and the face albums until they are approved
 * (INVITES_FACE_ALBUMS — biometric data, docs/features.md).
 */
export function deploymentFeatures(env: ServerEnv = serverEnv()): Set<Feature> {
  const off = new Set(env.INVITES_FEATURES_OFF);
  const ai = !!env.ANTHROPIC_API_KEY && !!env.INVITES_AI_MODEL;
  return new Set(
    FEATURES.filter((f) => {
      if (off.has(f)) return false;
      if (f === 'face_albums') return env.INVITES_FACE_ALBUMS;
      if (f === 'gallery_ai' || f === 'translate_ai' || f === 'art_direction') return ai;
      return true;
    }),
  );
}

type Row = {
  overrides: unknown;
  ownerId: string;
  ownerEmail: string | null;
  plan: string;
  planStatus: AccountPlanState['planStatus'];
  planRenewsAt: string | null;
};

/** An event's inputs: its owner's plan in force, the event's overrides, this deployment (null: no event). */
export async function featureInput(
  invitationId: string,
): Promise<(FeatureInput & { ownerId: string }) | null> {
  const { data, error } = await serviceDb().rpc('invitation_features', { p_id: invitationId });
  if (error) throw new Error(`invitation_features: ${error.message}`);
  if (!data) return null;
  const r = data as Row;
  const admin = isAdminEmail(r.ownerEmail);
  const plan = effectivePlan(
    { plan: isPlanId(r.plan) ? r.plan : 'free', planStatus: r.planStatus, planRenewsAt: r.planRenewsAt },
    Date.now(),
    admin,
  );
  return {
    ownerId: r.ownerId,
    plan,
    admin,
    overrides: readOverrides(r.overrides),
    available: deploymentFeatures(),
  };
}

/** What an event may use now — for the guest's pages and the host's screens alike. */
export async function featuresFor(invitationId: string): Promise<Set<Feature>> {
  const input = await featureInput(invitationId);
  return input ? effectiveFeatures(input) : new Set();
}

export const flagDeps: FlagDeps = {
  input: featureInput,
  async setOff(invitationId, ownerId, feature, off) {
    const { data, error } = await serviceDb().rpc('invitation_feature_off', {
      p_id: invitationId,
      p_owner: ownerId,
      p_feature: feature,
      p_off: off,
    });
    if (error) throw new Error(`invitation_feature_off: ${error.message}`);
    return data ? readOverrides(data) : null;
  },
};

/**
 * The platform grants a feature to one event beyond its plan (an admin, a partner), or takes the
 * grant back. Server only; never on a host's request.
 */
export async function grantFeature(invitationId: string, feature: Feature, grant: boolean) {
  const { data, error } = await serviceDb().rpc('invitation_feature_grant', {
    p_id: invitationId,
    p_feature: feature,
    p_grant: grant,
  });
  if (error) throw new Error(`invitation_feature_grant: ${error.message}`);
  return data ? readOverrides(data) : null;
}

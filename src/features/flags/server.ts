import 'server-only';
import type { User } from '@supabase/supabase-js';
import { cache } from 'react';
import { revalidateInvitationPageById } from '@/features/invitations/server/revalidate';
import { isAdminEmail, loadAccount } from '@/features/billing/server/account';
import { effectivePlan, isPlanId, type AccountPlanState, type PlanId } from '@/features/billing/plans';
import { serverEnv, type ServerEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import type { FlagDeps } from './api';
import {
  FEATURES,
  NO_OVERRIDES,
  effectiveFeatures,
  isOptIn,
  readOverrides,
  type Feature,
  type FeatureInput,
} from './features';

/**
 * What this deployment offers: every feature but those switched off here (INVITES_FEATURES_OFF), the
 * ones that need an AI model when none is set up, and the face albums until they are approved
 * (INVITES_FACE_ALBUMS — biometric data, docs/features.md), and the planning section until its switch
 * (INVITES_PLANNING) is on. The design concepts (`art_direction`)
 * don't need the AI: without it they are composed from the photos (features/art-direction).
 */
export function deploymentFeatures(env: ServerEnv = serverEnv()): Set<Feature> {
  const off = new Set(env.INVITES_FEATURES_OFF);
  const ai = !!env.ANTHROPIC_API_KEY && !!env.INVITES_AI_MODEL;
  return new Set(
    FEATURES.filter((f) => {
      if (off.has(f)) return false;
      if (f === 'face_albums') return env.INVITES_FACE_ALBUMS;
      if (f === 'gallery_ai' || f === 'translate_ai') return ai;
      // planning is rolled out with its own switch (INVITES_PLANNING), after its migrations are applied
      if (f.startsWith('planning')) return env.INVITES_PLANNING && (f !== 'planning_ai' || ai);
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

/**
 * What a host's account may use before there is an event (the wizard's languages, the gallery's
 * "design it for me"): their plan in force and this deployment, without an event's own choices.
 */
export async function accountFeatures(
  user: Pick<User, 'id' | 'email'>,
): Promise<{ features: Set<Feature>; admin: boolean; plan: PlanId }> {
  const account = await loadAccount(user);
  const features = effectiveFeatures({
    plan: account.effective,
    admin: account.admin,
    overrides: NO_OVERRIDES,
    available: deploymentFeatures(),
  });
  return { features, admin: account.admin, plan: account.effective };
}

/**
 * What an event may use now — for the guest's pages and the host's screens alike. Asked once per
 * request (React cache): a guest's page asks it for its presentation, its "listen" and its extras.
 * Outside a render (a route handler) each call reads anew.
 */
export const featuresFor = cache(async (invitationId: string): Promise<Set<Feature>> => {
  const input = await featureInput(invitationId);
  return input ? effectiveFeatures(input) : new Set();
});

/** A feature changed: the event's cached guest page shows the change now, not when its cache ends. */
function refreshGuestPage(invitationId: string) {
  return revalidateInvitationPageById(invitationId).catch((err) =>
    console.error('[flags] the guest page could not be refreshed', err),
  );
}

export const flagDeps: FlagDeps = {
  input: featureInput,
  async setOff(invitationId, ownerId, feature, off) {
    // an OPT_IN feature is turned on (and off) explicitly: its own list, and the off list besides
    const { data, error } = isOptIn(feature)
      ? await serviceDb().rpc('invitation_feature_on', {
          p_id: invitationId,
          p_owner: ownerId,
          p_feature: feature,
          p_on: !off,
        })
      : await serviceDb().rpc('invitation_feature_off', {
          p_id: invitationId,
          p_owner: ownerId,
          p_feature: feature,
          p_off: off,
        });
    if (error) throw new Error(`invitation_feature_${isOptIn(feature) ? 'on' : 'off'}: ${error.message}`);
    await refreshGuestPage(invitationId);
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
  await refreshGuestPage(invitationId);
  return data ? readOverrides(data) : null;
}

import 'server-only';
import { PLAN_LIMITS } from '@/features/billing/plans';
import { effectiveFeatures } from '@/features/flags/features';
import { accountFeatures, featureInput } from '@/features/flags/server';
import { serverEnv } from '@/lib/env';
import { rateKey } from '@/lib/links/tokens';
import { serviceDb } from '@/lib/supabase/server';
import { askArtDirector } from './ai';
import type { ArtDeps } from './api';

/** The real dependencies of the design studio's API (tests pass their own). */
export function artDeps(): ArtDeps {
  const env = serverEnv();
  const ai =
    env.ANTHROPIC_API_KEY && env.INVITES_AI_MODEL
      ? {
          apiKey: env.ANTHROPIC_API_KEY,
          model: env.INVITES_AI_MODEL,
          apiBase: env.INVITES_AI_API_BASE,
          brand: env.INVITES_BRAND_NAME,
        }
      : null;
  return {
    async access(user, invitationId) {
      if (invitationId) {
        const input = await featureInput(invitationId);
        if (!input || input.ownerId !== user.id) return { status: 'not_found' };
        const on = effectiveFeatures(input);
        if (!on.has('art_direction')) return { status: 'off' };
        return {
          status: 'ok',
          access: { admin: input.admin, premium: input.admin || PLAN_LIMITS[input.plan].premiumTemplates },
          cinematic: on.has('cinematic'),
        };
      }
      const account = await accountFeatures({ id: user.id, email: user.email ?? undefined });
      if (!account.features.has('art_direction')) return { status: 'off' };
      return {
        status: 'ok',
        access: {
          admin: account.admin,
          premium: account.admin || PLAN_LIMITS[account.plan].premiumTemplates,
        },
        cinematic: account.features.has('cinematic'),
      };
    },
    async rateHit(key, limit, windowSeconds) {
      const { data, error } = await serviceDb().rpc('gallery_rate_hit', {
        p_key_hash: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) throw new Error(`gallery_rate_hit: ${error.message}`);
      return data === true;
    },
    rateKey: (scope, value) => rateKey('art-direction', scope, value),
    ask: ai ? (input, jpegs) => askArtDirector(input, jpegs, ai) : null,
    limits: { perAccount: env.INVITES_ART_DIRECTION_DAILY_LIMIT, site: env.INVITES_AI_DAILY_LIMIT },
  };
}

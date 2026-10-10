import 'server-only';
import { isAdminEmail } from '@/features/billing/server/account';
import { serverEnv } from '@/lib/env';
import { rateKey } from '@/lib/links/tokens';
import { serviceDb } from '@/lib/supabase/server';
import { getTemplate } from '../../templates/registry';
import { ASSISTANT } from '../model';
import { askAssistant, askAssistantOpenAi } from './ai';
import type { AssistantDeps } from './api';

/** The real dependencies of the AI questionnaire's API (tests pass their own). */
export function assistantDeps(user: { email: string | null }): AssistantDeps {
  const env = serverEnv();
  // Anthropic when it's set up (like the site's other AI features), else OpenAI (its key alone is enough:
  // the model has a default — lib/env)
  const ask: AssistantDeps['ask'] =
    env.ANTHROPIC_API_KEY && env.INVITES_AI_MODEL
      ? (input) =>
          askAssistant(input, {
            apiKey: env.ANTHROPIC_API_KEY,
            model: env.INVITES_AI_MODEL,
            apiBase: env.INVITES_AI_API_BASE,
            brand: env.INVITES_BRAND_NAME,
          })
      : env.OPENAI_API_KEY
        ? (input) =>
            askAssistantOpenAi(input, {
              apiKey: env.OPENAI_API_KEY,
              model: env.INVITES_AI_MODEL_OPENAI,
              apiBase: env.INVITES_AI_API_BASE_OPENAI,
              brand: env.INVITES_BRAND_NAME,
            })
        : null;
  return {
    template: getTemplate,
    admin: isAdminEmail(user.email),
    async rateHit(key, limit, windowSeconds) {
      const { data, error } = await serviceDb().rpc('gallery_rate_hit', {
        p_key_hash: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) throw new Error(`gallery_rate_hit: ${error.message}`);
      return data === true;
    },
    rateKey: (scope, value) => rateKey('assistant', scope, value),
    ask,
    limits: { perHour: ASSISTANT.perHour, perDay: ASSISTANT.perDay, site: env.INVITES_AI_DAILY_LIMIT },
  };
}

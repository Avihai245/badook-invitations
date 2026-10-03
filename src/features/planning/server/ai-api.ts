import { z } from 'zod';
import { Uuid } from '../model/schemas';
import { todayIn } from '../model/schedule';
import { DEFAULT_ZONE } from './view';
import { fail, gate, isRefusal, notFound, ok, rawState, type ApiResult, type PlanningDeps } from './types';

const AiOp = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('plan'),
    description: z.string().trim().min(8).max(600),
    locale: z.enum(['he', 'en']).default('he'),
  }),
  z.strictObject({ kind: z.literal('idea'), ideaId: Uuid, locale: z.enum(['he', 'en']).default('he') }),
]);

const DAY = 86_400;

/**
 * POST …/planning/ai — the plan's AI tools (feature planning_ai, a Pro tool):
 * `{ kind:'plan', description }` → `{ draft }`, a plan drafted from the host's own words for them to
 * approve; `{ kind:'idea', ideaId }` → `{ summary, steps }`, what a note on the ideas board suggests.
 * 503 `ai_unavailable` without a model, 429 `rate_limited` past the account's or the site's daily cap,
 * 422 `refused`, 502 `ai_failed`. Nothing is saved here.
 */
export async function aiOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps, 'planning_ai');
  if (isRefusal(g)) return g;
  const parsed = AiOp.safeParse(body);
  if (!parsed.success) return fail(400, 'invalid');
  const input = parsed.data;
  if (!deps.ai) return fail(503, 'ai_unavailable');
  if (deps.rateHit && deps.rateKey && deps.aiLimits) {
    const account = await deps.rateHit(deps.rateKey('account', userId), deps.aiLimits.perAccount, DAY);
    const site = await deps.rateHit(deps.rateKey('site', 'all'), deps.aiLimits.site, DAY);
    if (!account || !site) return fail(429, 'rate_limited');
  }
  const raw = await rawState(deps, id, userId);
  if (!raw) return notFound;

  if (input.kind === 'plan') {
    const today = todayIn(raw.invitation.timezone ?? DEFAULT_ZONE, new Date(deps.now()));
    const res = await deps.ai.draftPlan({
      description: input.description,
      locale: input.locale,
      today,
      eventDate: raw.invitation.date,
    });
    if (res.status === 'ok') return ok({ draft: res.draft });
    return res.status === 'refused' ? fail(422, 'refused') : fail(502, 'ai_failed');
  }

  const idea = raw.ideas.find((i) => i.id === input.ideaId);
  if (!idea) return notFound;
  const text = [idea.title, idea.body, idea.url, ...idea.items.map((l) => l.text)].filter(Boolean).join('\n');
  if (!text.trim()) return fail(400, 'invalid');
  const res = await deps.ai.summarizeIdea({ text, locale: input.locale });
  if (res.status === 'ok') return ok({ summary: res.summary, steps: res.steps });
  return res.status === 'refused' ? fail(422, 'refused') : fail(502, 'ai_failed');
}

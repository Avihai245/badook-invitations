import { z } from 'zod';
import { EventTypeSchema, LocaleSchema } from '@/features/invitations/contracts/schemas';
import { composeConcepts } from '../compose';
import { ART_DIRECTION } from '../config';
import { PhotoInfoSchema, conceptsFromAnswer, type ConceptInput } from '../model';
import type { Access } from '../catalog';
import type { AskResult } from './ai';

/**
 * POST /api/art-direction — three design concepts for an invitation (feature `art_direction`) as a
 * plain function over injected dependencies (tests/unit/art-direction.test.ts). The screen always
 * answers: without the AI (not set up), past the host's daily limit or the site's, or when the AI
 * fails or answers nonsense, the composer makes them from the photos' readings. The photos go to the
 * AI only, never to a log; nothing is stored.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

/** base64 of at most ART_DIRECTION.aiMaxBytes */
const B64 = z
  .string()
  .max(Math.ceil((ART_DIRECTION.aiMaxBytes * 4) / 3) + 4)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);

export const ConceptsRequestSchema = z.strictObject({
  /** the editor's invitation; absent: a new invitation (the gallery's wizard) */
  invitationId: z.uuid().nullable().optional(),
  eventType: EventTypeSchema,
  locales: z.array(LocaleSchema).min(1).max(8),
  uiLocale: z.enum(['he', 'en']),
  mood: z.string().trim().max(ART_DIRECTION.moodMax).optional().default(''),
  photos: z
    .array(z.strictObject({ jpeg: B64, info: PhotoInfoSchema }))
    .min(ART_DIRECTION.minPhotos)
    .max(ART_DIRECTION.maxPhotos),
  /** the editor: the design the invitation has now */
  current: z
    .strictObject({ templateId: z.string().min(1), fontPairId: z.string().min(1) })
    .nullable()
    .optional(),
  /** "three more": the designs shown already */
  avoid: z
    .array(z.strictObject({ templateId: z.string().min(1).max(80), fontPairId: z.string().min(1).max(80) }))
    .max(12)
    .optional(),
});

/** What the host may do here: the feature, who they are (the designs open to them), `cinematic`. */
export type ArtAccess =
  { status: 'ok'; access: Access; cinematic: boolean } | { status: 'off' } | { status: 'not_found' };

export interface ArtDeps {
  /** the feature for this host (and invitation, when there is one) */
  access(user: { id: string; email?: string | null }, invitationId: string | null): Promise<ArtAccess>;
  /** a hit on a limit (true: within it) — keyed by a hash, in the database */
  rateHit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** the salted key of a limit */
  rateKey(scope: string, value: string): string;
  /** null: no AI set up */
  ask: ((input: ConceptInput, jpegs: readonly string[]) => Promise<AskResult>) | null;
  limits: { perAccount: number; site: number };
}

export type ConceptsReason = 'no_ai' | 'limit' | 'error' | 'invalid';

export async function createConcepts(
  user: { id: string; email?: string | null },
  raw: unknown,
  deps: ArtDeps,
): Promise<ApiResult> {
  const userId = user.id;
  const parsed = ConceptsRequestSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const req = parsed.data;
  if (new Set(req.locales).size !== req.locales.length) return fail(400, 'invalid');
  const allowed = await deps.access(user, req.invitationId ?? null);
  if (allowed.status === 'not_found') return fail(404, 'not_found');
  if (allowed.status === 'off') return fail(403, 'feature_off', { feature: 'art_direction' });
  // a request carries photos: an hourly ceiling per account, whatever answers it
  if (!(await deps.rateHit(deps.rateKey('requests', userId), 60, 3600))) return fail(429, 'rate');

  const input: ConceptInput = {
    eventType: req.eventType,
    locales: req.locales,
    uiLocale: req.uiLocale,
    mood: req.mood,
    photos: req.photos.map((p) => p.info),
    access: allowed.access,
    cinematic: allowed.cinematic,
    current: req.current ?? null,
    avoid: req.avoid ?? [],
  };
  const compose = (reason: ConceptsReason): ApiResult => {
    const concepts = composeConcepts(input);
    if (!concepts.length) return fail(422, 'no_templates');
    return { status: 200, body: { ok: true, source: 'composer', reason, concepts } };
  };
  if (!deps.ask) return compose('no_ai');
  // the host's day, then the site's (a cost ceiling); past either the composer answers
  if (!(await deps.rateHit(deps.rateKey('account', userId), deps.limits.perAccount, 86_400)))
    return compose('limit');
  if (!(await deps.rateHit(deps.rateKey('site', 'all'), deps.limits.site, 86_400))) return compose('limit');

  const asked = await deps.ask(
    input,
    req.photos.map((p) => p.jpeg),
  );
  if (asked.status !== 'ok') {
    // never the photos: only what went wrong
    console.error('[art direction] the AI failed:', asked.error);
    return compose('error');
  }
  let filled = 0;
  const concepts = conceptsFromAnswer(asked.answer, input, (count, avoid) => {
    filled = count;
    return composeConcepts(input, count, [...(input.avoid ?? []), ...avoid]);
  });
  if (!concepts.length) return compose('invalid');
  return {
    status: 200,
    body: {
      ok: true,
      source: filled >= 3 ? 'composer' : 'ai',
      reason: filled >= 3 ? 'invalid' : filled > 0 ? 'invalid' : null,
      concepts,
    },
  };
}

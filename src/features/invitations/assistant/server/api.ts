import type { TemplateEntry } from '../../templates/registry';
import {
  FIELDS,
  TurnRequestSchema,
  isRequired,
  nextField,
  sanitizeDraft,
  type AssistantField,
  type Draft,
  type TurnResult,
} from '../model';
import type { AskInput, AskResult } from './ai';

/**
 * POST /api/invitations/assistant — one turn of the AI questionnaire, as a plain function over injected
 * dependencies (tests/unit/assistant.test.ts). It always answers: without the AI (not set up), past the
 * host's limit or the site's, or when the AI fails, it says so (`source: 'script'`) and the device asks
 * the next question itself. Nothing is stored.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const fail = (status: number, code: string): ApiResult => ({ status, body: { ok: false, code } });

export interface AssistantDeps {
  template(id: string): TemplateEntry | undefined;
  /** platform admins may use the unlisted designs */
  admin: boolean;
  /** a hit on a limit (true: within it) — keyed by a hash, in the database */
  rateHit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  rateKey(scope: string, value: string): string;
  /** null: no AI set up */
  ask: ((input: AskInput) => Promise<AskResult>) | null;
  limits: { perHour: number; perDay: number; site: number };
}

/** The AI's answers over the ones known: what it leaves null stays as it was. */
function merge(known: Draft, found: Draft): Draft {
  const out: Draft = { ...known };
  for (const [k, v] of Object.entries(found) as [keyof Draft, Draft[keyof Draft]][]) {
    if (v !== null && v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export async function assistantTurn(
  user: { id: string },
  raw: unknown,
  deps: AssistantDeps,
): Promise<ApiResult> {
  const parsed = TurnRequestSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const req = parsed.data;
  const entry = deps.template(req.templateId);
  if (!entry || (!entry.manifest.listed && !deps.admin)) return fail(400, 'invalid');
  const { manifest } = entry;
  if (!manifest.supportsLocales.includes(req.locale)) return fail(400, 'invalid');
  const draft = sanitizeDraft(req.draft, manifest);
  const skipped = [...new Set(req.skipped)].filter((f) => !isRequired(f));

  const script = (reason: TurnResult['reason']): ApiResult => ({
    status: 200,
    body: {
      ok: true,
      draft,
      skipped,
      next: nextField(manifest.id, draft, skipped),
      reply: null,
      source: 'script',
      reason,
    } satisfies TurnResult & { ok: true },
  });
  if (!deps.ask) return script('no_ai');
  // the host's hour and day, then the site's (a cost ceiling); past any of them the device asks
  if (!(await deps.rateHit(deps.rateKey('hour', user.id), deps.limits.perHour, 3600))) return script('limit');
  if (!(await deps.rateHit(deps.rateKey('day', user.id), deps.limits.perDay, 86_400))) return script('limit');
  if (!(await deps.rateHit(deps.rateKey('site', 'all'), deps.limits.site, 86_400))) return script('limit');

  const asked = await deps.ask({
    manifest,
    locale: req.locale,
    uiLocale: req.uiLocale,
    today: req.today,
    draft,
    skipped,
    messages: req.messages,
  });
  if (asked.status !== 'ok') {
    // never the conversation: only what went wrong
    console.error('[assistant] the AI failed:', asked.error);
    return script('error');
  }
  const found = sanitizeDraft(asked.answer.draft, manifest);
  const merged = merge(draft, found);
  // the event changed: what belongs to the old one goes
  const clean = sanitizeDraft(merged, manifest);
  const nowSkipped = [
    ...new Set([
      ...skipped,
      ...asked.answer.skip.filter(
        (f): f is AssistantField =>
          (FIELDS as readonly string[]).includes(f) && !isRequired(f as AssistantField),
      ),
    ]),
  ];
  const next = nextField(manifest.id, clean, nowSkipped);
  // the AI's question must be the one that's next; else the device asks it (its reply would mislead)
  const agrees = (asked.answer.ask === 'done' ? null : asked.answer.ask) === next;
  return {
    status: 200,
    body: {
      ok: true,
      draft: clean,
      skipped: nowSkipped,
      next,
      reply: agrees ? asked.answer.reply.replace(/\s*—\s*/g, ', ').slice(0, 600) : null,
      source: 'ai',
      reason: null,
    } satisfies TurnResult & { ok: true },
  };
}

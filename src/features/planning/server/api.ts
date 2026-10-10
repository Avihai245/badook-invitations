import { VAT_RATE } from '@/features/billing/plans';
import { endOfDayUtc } from '@/features/invitations/lib/dates';
import {
  buildPlanDraft,
  buildPlanDraftFromPrivate,
  type PlanDraft,
  type PrivateTemplateItems,
} from '../model/draft';
import { integrationsForMode } from '../model/integrations';
import type { PlanTask, RawPlanState } from '../model/plan';
import {
  InitSchema,
  PlanOp,
  SettingsSchema,
  TaskOp,
  type InitInput,
  type SettingsInput,
} from '../model/schemas';
import { computeSchedule, todayIn } from '../model/schedule';
import { TEMPLATES, isTemplateKey, templateKeyFor } from '../templates';
import { composeView, DEFAULT_ZONE } from './view';
import {
  fail,
  gate,
  isRefusal,
  isUuid,
  notFound,
  ok,
  rawState,
  type ApiResult,
  type PlanningDeps,
} from './types';

export type { ApiResult, PlanningDeps } from './types';

/**
 * The planning API (GET / POST /api/invitations/:id/planning and its tools) as plain functions over
 * injected dependencies — the route files wire Supabase in. Tested in tests/unit/planning-api.test.ts.
 * Every call checks that the event is the signed-in host's and that it has the `planning` feature.
 */

/** The plan as the screens load it: null when it isn't the host's or has no summary. */
export async function loadPlanView(
  userId: string,
  id: string,
  deps: PlanningDeps,
  input: Parameters<typeof composeView>[2],
) {
  const raw = await rawState(deps, id, userId);
  if (!raw) return null;
  // a save-the-date has nothing to plan: the plan lives on the full invitation made from it
  if (raw.invitation.eventType === 'save_the_date') return null;
  const summary = await deps.summary(id, userId);
  if (!summary) return null;
  return { raw, view: composeView(raw, summary, input, deps.now()) };
}

/** GET — the whole plan. */
export async function loadPlan(userId: string, id: string, deps: PlanningDeps): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const loaded = await loadPlanView(userId, id, deps, g.input);
  if (!loaded) return notFound;
  return ok({ view: loaded.view });
}

const invalid = (error: { issues: { path: PropertyKey[] }[] }) =>
  fail(400, 'invalid', {
    fields: [...new Set(error.issues.map((i) => i.path.slice(0, 3).join('.')))].slice(0, 10),
  });

/** The draft a new plan starts from, by the template the host chose (else the answer to send). */
async function draftFor(
  userId: string,
  input: InitInput,
  raw: RawPlanState,
  features: { ai: boolean; templates: boolean; seating: boolean; checkin: boolean },
  deps: PlanningDeps,
): Promise<{ draft: PlanDraft; templateKey: string } | ApiResult> {
  const eventDate = raw.invitation.date;
  if (!eventDate) return fail(409, 'no_date');
  const tz = raw.invitation.timezone ?? DEFAULT_ZONE;
  const today = todayIn(tz, new Date(deps.now()));
  // the guest numbers the budget will follow (planning_headcount), so a per-head price × heads is the share
  const tables = input.manualTables ?? raw.facts.tables;
  // (with the guests' integration off the plan follows the host's own numbers, whatever the basis)
  const basis = integrationsForMode(input.integrationsMode).guests ? input.guestBasis : 'manual';
  const manual =
    basis === 'confirmed'
      ? { adults: raw.headcount.confirmedAdults, children: raw.headcount.confirmedChildren, tables }
      : basis === 'manual'
        ? { adults: input.manualAdults ?? raw.headcount.invited, children: input.manualChildren ?? 0, tables }
        : {
            adults: raw.headcount.expectedAdults ?? raw.headcount.invited,
            children: raw.headcount.expectedChildren ?? 0,
            tables,
          };
  const ctx = {
    eventDate,
    today,
    deadline: raw.invitation.rsvpDeadline,
    variant: input.variant,
    features: { seating: features.seating, checkin: features.checkin },
    totalBudget: input.totalBudget,
    headcount: manual,
  };
  if (input.template === 'draft') {
    if (!input.draft) return fail(400, 'invalid', { fields: ['draft'] });
    if (!features.ai) return fail(403, 'feature_off', { feature: 'planning_ai' });
    return {
      draft: buildPlanDraftFromPrivate(input.draft satisfies PrivateTemplateItems, ctx),
      templateKey: 'ai',
    };
  }
  if (input.template.startsWith('private:')) {
    if (!features.templates) return fail(403, 'feature_off', { feature: 'planning_templates' });
    const items = await deps.privateTemplate?.(input.template.slice('private:'.length), userId);
    if (!items) return notFound;
    return { draft: buildPlanDraftFromPrivate(items, ctx), templateKey: input.template };
  }
  if (!isTemplateKey(input.template)) return fail(400, 'invalid', { fields: ['template'] });
  // a system template is for the kind of event it was written for ('blank' fits any)
  if (input.template !== 'blank' && templateKeyFor(raw.invitation.eventType) !== input.template)
    return fail(400, 'invalid', { fields: ['template'] });
  return { draft: buildPlanDraft(TEMPLATES[input.template], ctx), templateKey: input.template };
}

/**
 * POST { op: 'init', template, … } — makes the event's plan once: the template's tasks on the calendar
 * (compressed into the time that is left), its budget categories sized to the total, the settings the
 * host chose. 409 `exists` when it already has one.
 */
export async function initPlan(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const parsed = InitSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const loaded = await loadPlanView(userId, id, deps, g.input);
  if (!loaded) return notFound;
  const { raw, view } = loaded;
  if (raw.settings) return fail(409, 'exists');
  const made = await draftFor(userId, input, raw, view.features, deps);
  if ('status' in made) return made;
  const { draft, templateKey } = made;
  const integrations = integrationsForMode(input.integrationsMode);
  const answer = await deps.rpc<{ ok: boolean; code?: string } | null>('planning_init', {
    p_id: id,
    p_owner: userId,
    p_settings: {
      templateKey,
      variant: input.variant,
      totalBudget: input.totalBudget,
      vatMode: 'included',
      vatPct: Math.round(VAT_RATE * 10000) / 100,
      guestBasis: input.guestBasis,
      // the numbers a plan that doesn't follow the guests starts from: the list's, or what the host typed
      manualAdults: input.manualAdults ?? raw.headcount.invited,
      manualChildren: input.manualChildren ?? 0,
      manualTables: input.manualTables ?? raw.facts.tables,
      integrations,
      reminders: { email: input.remindersEmail },
      requiredVendors: draft.requiredVendors,
      onboardingDone: true,
      anchorDate: raw.invitation.date,
    },
    p_tasks: draft.tasks,
    p_categories: draft.categories,
  });
  if (!answer) return notFound;
  if (!answer.ok) return fail(answer.code === 'exists' ? 409 : 422, answer.code ?? 'invalid');
  const fresh = await loadPlanView(userId, id, deps, g.input);
  return fresh ? ok({ view: fresh.view }, 201) : notFound;
}

/** A settings patch as the database takes it: a mode sets every switch, then the switches given win. */
function settingsPatch(patch: SettingsInput): Record<string, unknown> {
  const { integrations, ...rest } = patch;
  const out: Record<string, unknown> = { ...rest };
  if (integrations) {
    const { mode, ...toggles } = integrations;
    out.integrations = { ...(mode ? integrationsForMode(mode) : {}), ...toggles };
  }
  return out;
}

/** POST { op: 'settings', patch } — changes the plan's settings; answers the plan as it is now. */
export async function savePlanSettings(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const saved = await deps.rpc('planning_settings_save', {
    p_id: id,
    p_owner: userId,
    p_patch: settingsPatch(parsed.data),
  });
  if (!saved) return notFound;
  const loaded = await loadPlanView(userId, id, deps, g.input);
  return loaded ? ok({ view: loaded.view }) : notFound;
}

/**
 * POST { op: 'dates' } — the event's date changed: moves the tasks the host never dated themselves
 * to the same place around the new date (compressed into the time that is left, like a new plan).
 * `keep`: leave every date as it is and stop asking about this one.
 */
export async function applyDates(
  userId: string,
  id: string,
  deps: PlanningDeps,
  keep = false,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const loaded = await loadPlanView(userId, id, deps, g.input);
  if (!loaded) return notFound;
  const { raw, view } = loaded;
  if (!raw.settings || !raw.invitation.date) return fail(409, 'no_plan');
  // "keep them as they are": nothing moves, and the question is not asked again for this date
  const movable = keep
    ? []
    : raw.tasks.filter(
        (t) =>
          !t.dueIsManual &&
          t.offsetDays !== null &&
          t.systemKey !== 'rsvp_deadline' &&
          t.systemKey !== 'final_headcount',
      );
  const schedule = computeSchedule(
    movable.map((t) => ({ id: t.id, offset: t.offsetDays! })),
    { eventDate: raw.invitation.date, today: view.today },
  );
  await deps.rpc('planning_dates_apply', {
    p_id: id,
    p_owner: userId,
    p_dates: schedule.map((s) => ({ id: s.id, due: s.due })),
    p_anchor: raw.invitation.date,
  });
  const fresh = await loadPlanView(userId, id, deps, g.input);
  return fresh ? ok({ view: fresh.view }) : notFound;
}

/** POST { op: 'ack_headcount' } — "I've seen it": the guest numbers moved since are measured from now. */
export async function ackHeadcount(userId: string, id: string, deps: PlanningDeps): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const done = await deps.rpc<boolean>('planning_headcount_ack', { p_id: id, p_owner: userId });
  return done ? ok({}) : notFound;
}

/** The root route's POST. */
export async function planOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = PlanOp.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const { op, ...rest } = parsed.data;
  switch (op) {
    case 'init':
      return initPlan(userId, id, rest, deps);
    case 'settings':
      return savePlanSettings(userId, id, (rest as { patch: unknown }).patch, deps);
    case 'dates':
      return applyDates(userId, id, deps, (rest as { keep?: boolean }).keep === true);
    case 'ack_headcount':
      return ackHeadcount(userId, id, deps);
  }
}

// ─── tasks ─────────────────────────────────────────────────────────────────────────────────────

/** A refusal the database gave (or null: not the host's), as the answer to send. */
function refusal(answer: unknown): ApiResult | null {
  if (answer === null || answer === undefined) return notFound;
  const a = answer as { ok?: boolean; code?: string };
  if (a.ok === false) return fail(a.code === 'too_many' ? 422 : 400, a.code ?? 'invalid');
  return null;
}

/**
 * POST …/planning/tasks { op: 'save' | 'delete' | 'reorder' | 'bulk', … } — the host's tasks: add or
 * change one (a new id is theirs to choose: undoing a delete puts the same task back), delete some,
 * reorder after a drag, hide or finish several at once.
 */
export async function taskOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const parsed = TaskOp.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  switch (input.op) {
    case 'save': {
      const task = await deps.rpc<PlanTask | { ok: false; code: string } | null>('planning_task_save', {
        p_id: id,
        p_owner: userId,
        p_task: input.task,
      });
      return refusal(task) ?? ok({ task });
    }
    case 'delete': {
      const deleted = await deps.rpc<number | null>('planning_task_delete', {
        p_id: id,
        p_owner: userId,
        p_ids: input.ids,
      });
      return refusal(deleted) ?? ok({ deleted });
    }
    case 'reorder': {
      const moved = await deps.rpc<number | null>('planning_tasks_reorder', {
        p_id: id,
        p_owner: userId,
        p_ids: input.ids,
      });
      return refusal(moved) ?? ok({ moved });
    }
    case 'bulk': {
      const tasks = await deps.rpc<PlanTask[] | null>('planning_tasks_bulk', {
        p_id: id,
        p_owner: userId,
        p_ids: input.ids,
        p_patch: input.patch,
      });
      return refusal(tasks) ?? ok({ tasks });
    }
  }
}

/** The end of the deadline's day in the event's zone (for "closed" copy): null without a deadline. */
export function deadlineEnd(deadline: string | null, tz: string | null): Date | null {
  return deadline ? endOfDayUtc(deadline, tz ?? DEFAULT_ZONE) : null;
}

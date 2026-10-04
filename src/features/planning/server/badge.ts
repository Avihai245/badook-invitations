import 'server-only';
import { whyOff, type FeatureInput } from '@/features/flags/features';
import { dueWithin } from '../model/week';
import type { RawPlanOverview, TaskView } from '../model/plan';
import { systemTaskDone } from '../model/system-tasks';
import { daysBetween, todayIn } from '../model/schedule';
import { planningDeps } from './deps';
import { factsOf, DEFAULT_ZONE } from './view';
import type { PlanSummary } from './types';

/** The plan's compact overview (one call), with the system tasks judged by what the app knows. */
export async function planningOverview(
  ownerId: string,
  invitationId: string,
  summary: PlanSummary,
  now = Date.now(),
): Promise<{ raw: RawPlanOverview; tasks: TaskView[]; today: string } | null> {
  // the call's window is a day-count around "today": the event's own zone is only known from the answer
  const raw = await planningDeps.rpc<RawPlanOverview | null>('planning_overview', {
    p_id: invitationId,
    p_owner: ownerId,
    p_today: todayIn(DEFAULT_ZONE, new Date(now)),
  });
  if (!raw) return null;
  const today = todayIn(raw.invitation.timezone ?? DEFAULT_ZONE, new Date(now));
  const facts = raw.facts ? factsOf({ invitation: raw.invitation, facts: raw.facts }, summary, today) : null;
  const tasks: TaskView[] = (raw.tasks ?? []).map((t) => ({
    ...t,
    derived: t.systemKey && facts ? systemTaskDone(t.systemKey, facts) : null,
  }));
  return { raw, tasks, today };
}

/** What the event's navigation shows of the plan: whether there is one, its open tasks, this week's. */
export interface PlanningBadge {
  planned: boolean;
  /** tasks not done or skipped */
  open: number;
  /** due this week or overdue (none once the event is over) */
  week: number;
  /** the seating's numbers, as the plan's facts know them */
  seating: { tables: number; unseated: number } | null;
}

/**
 * What the event's navigation shows of the planning: whether the stage is there at all (the event has
 * the feature and is not a save-the-date — null when not) and its numbers. Without a plan yet the stage
 * is there with no numbers.
 */
export async function planningTab(
  ownerId: string,
  item: { id: string; eventType: string },
  summary: PlanSummary,
  input: (FeatureInput & { ownerId: string }) | null,
): Promise<PlanningBadge | null> {
  if (!input || item.eventType === 'save_the_date') return null;
  if (whyOff('planning', input) !== null) return null;
  const empty: PlanningBadge = { planned: false, open: 0, week: 0, seating: null };
  try {
    const o = await planningOverview(ownerId, item.id, summary);
    if (!o) return null;
    const seating = o.raw.facts
      ? { tables: o.raw.facts.tables, unseated: o.raw.facts.confirmedUnseated }
      : null;
    if (!o.raw.settings) return { ...empty, seating };
    const totals = o.raw.taskTotals;
    const open = totals ? Math.max(0, totals.total - totals.done - totals.skipped) : 0;
    // an event that has happened has no week to plan: the plan is a summary
    const date = o.raw.invitation.date;
    const week = date && daysBetween(o.today, date) < 0 ? 0 : dueWithin(o.tasks, o.today, 7).length;
    return { planned: true, open, week, seating };
  } catch (err) {
    // the navigation's numbers are a convenience: never take the event's pages down with them
    console.error('[planning tab]', err);
    return empty;
  }
}

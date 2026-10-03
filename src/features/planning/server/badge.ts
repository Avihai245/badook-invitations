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

/**
 * What the invitation's planning tab shows: whether it is there at all (the event has the feature and
 * is not a save-the-date) and the number on it — the tasks due this week or overdue (none once the event
 * is over). Without a plan yet the tab is there with no number.
 */
export async function planningTab(
  ownerId: string,
  item: { id: string; eventType: string },
  summary: PlanSummary,
  input: (FeatureInput & { ownerId: string }) | null,
): Promise<{ week: number } | null> {
  if (!input || item.eventType === 'save_the_date') return null;
  if (whyOff('planning', input) !== null) return null;
  try {
    const o = await planningOverview(ownerId, item.id, summary);
    if (!o) return null;
    if (!o.raw.settings) return { week: 0 };
    // an event that has happened has no week to plan: the plan is a summary
    const date = o.raw.invitation.date;
    if (date && daysBetween(o.today, date) < 0) return { week: 0 };
    return { week: dueWithin(o.tasks, o.today, 7).length };
  } catch (err) {
    // the tab is a convenience: never take the invitation's pages down with it
    console.error('[planning tab]', err);
    return { week: 0 };
  }
}

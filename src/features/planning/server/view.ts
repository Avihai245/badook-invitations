import { whyOff, type FeatureInput } from '@/features/flags/features';
import { todayIn } from '../model/schedule';
import { systemTaskDone, type SystemFacts } from '../model/system-tasks';
import type { PlanSummary } from './types';
import type { PlanView, RawPlanState, TaskView } from '../model/plan';

/** The event's own zone, for "today" when the document has none. */
export const DEFAULT_ZONE = 'Asia/Jerusalem';

/** What the invitation system knows about the event, as the system tasks are judged by it. */
export function factsOf(
  raw: Pick<RawPlanState, 'invitation' | 'facts'>,
  summary: PlanSummary,
  today: string,
): SystemFacts {
  return {
    status: summary.status,
    unpublishedChanges: summary.unpublishedChanges,
    guests: summary.guests,
    sent: summary.sent,
    responses: summary.responses,
    deadline: raw.invitation.rsvpDeadline,
    today,
    tables: raw.facts.tables,
    confirmedUnseated: raw.facts.confirmedUnseated,
    stationReady: raw.facts.stationReady,
  };
}

/**
 * What the planning screens load: the database's state with each system task judged by what the app
 * knows, today in the event's zone, and what the host's package offers.
 */
export function composeView(
  raw: RawPlanState,
  summary: PlanSummary,
  input: FeatureInput,
  now: number,
): PlanView {
  const today = todayIn(raw.invitation.timezone ?? DEFAULT_ZONE, new Date(now));
  const facts = factsOf(raw, summary, today);
  const tasks: TaskView[] = raw.tasks.map((t) => ({
    ...t,
    derived: t.systemKey ? systemTaskDone(t.systemKey, facts) : null,
  }));
  const anchor = raw.settings?.anchorDate ?? null;
  return {
    ...raw,
    today,
    tasks,
    summary: {
      guests: summary.guests,
      sent: summary.sent,
      responses: summary.responses,
      unpublishedChanges: summary.unpublishedChanges,
    },
    dateChanged: !!anchor && !!raw.invitation.date && anchor !== raw.invitation.date,
    features: {
      ai: whyOff('planning_ai', input) === null,
      export: whyOff('planning_export', input) === null,
      templates: whyOff('planning_templates', input) === null,
      seating: whyOff('seating', input) === null,
      checkin: whyOff('checkin', input) === null,
    },
  };
}

import 'server-only';
import { whyOff, type FeatureInput } from '@/features/flags/features';
import type { InvitationSummary } from '@/features/invitations/server/host-db';
import { readIntegrations } from '../model/integrations';
import { daysBetween } from '../model/schedule';
import { nextTask, dueWithin } from '../model/week';
import type { PlanTask } from '../model/plan';
import { planningOverview } from './badge';

/** What the invitation's overview shows about the plan (a card under "what to do now"). */
export type PlanningCardData =
  | { state: 'invite' }
  | {
      state: 'plan';
      templateKey: string | null;
      confirmed: { adults: number; children: number };
      next: PlanTask | null;
      /** the tasks due this week or overdue */
      week: number;
      budget: { total: number; committed: number; paid: number } | null;
    };

/**
 * The planning card for the invitation's overview, or null: the event has no planning (a save-the-date,
 * off for this deployment or the event, an event that is over), or the host turned the plan's overview
 * link off. A plan not yet set up gets a gentle invitation to set it up.
 */
export async function planningCard(
  ownerId: string,
  item: InvitationSummary,
  input: (FeatureInput & { ownerId: string }) | null,
): Promise<PlanningCardData | null> {
  if (!input || item.eventType === 'save_the_date' || whyOff('planning', input) !== null) return null;
  try {
    const o = await planningOverview(ownerId, item.id, {
      eventType: item.eventType,
      status: item.status,
      unpublishedChanges: item.unpublishedChanges,
      guests: item.guests,
      sent: item.sent,
      responses: item.responses,
    });
    if (!o) return null;
    const date = o.raw.invitation.date;
    if (date && daysBetween(o.today, date) < 0) return null;
    if (!o.raw.settings) return { state: 'invite' };
    if (!readIntegrations(o.raw.settings.integrations).overview) return null;
    const total = o.raw.totals?.totalBudget ?? null;
    return {
      state: 'plan',
      templateKey: o.raw.settings.templateKey,
      confirmed: {
        adults: o.raw.headcount?.confirmedAdults ?? 0,
        children: o.raw.headcount?.confirmedChildren ?? 0,
      },
      next: nextTask(o.tasks) ?? null,
      week: dueWithin(o.tasks, o.today, 7).length,
      budget:
        total === null || !o.raw.totals
          ? null
          : { total, committed: o.raw.totals.committed, paid: o.raw.totals.paid },
    };
  } catch (err) {
    // a convenience on the overview: never take the page down with it
    console.error('[planning card]', err);
    return null;
  }
}

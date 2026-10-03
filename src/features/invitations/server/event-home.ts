import 'server-only';
import { whyOff } from '@/features/flags/features';
import { deploymentFeatures, featureInput } from '@/features/flags/server';
import { planningOverview } from '@/features/planning/server/badge';
import { DEFAULT_ZONE } from '@/features/planning/server/view';
import { daysBetween, todayIn } from '@/features/planning/model/schedule';
import { dueWithin, nextTask } from '@/features/planning/model/week';
import type { PlanTask } from '@/features/planning/model/plan';
import type { HomeFacts } from '../app/home/next-action';
import type { WorkspaceCaps } from '../app/workspace/stages';
import { rsvpSummary, type RsvpSummary } from '../lib/rsvp-summary';
import { guestsDb } from './guests';
import { hostDb, type InvitationSummary } from './host-db';

export interface EventHomeData {
  item: InvitationSummary;
  /** the published invitation's address */
  url: string;
  /** the event's start, as an instant (ms), for the countdown */
  startsAt: number;
  daysLeft: number;
  facts: HomeFacts;
  rsvp: RsvpSummary;
  caps: WorkspaceCaps;
  /** the plan, when the event has planning (planned: false — not set up yet) */
  planning: {
    planned: boolean;
    templateKey: string | null;
    budget: { total: number; committed: number; paid: number; planned: number } | null;
    tasks: { total: number; done: number; week: number; next: PlanTask | null };
    confirmed: { adults: number; children: number };
  } | null;
}

/** The instant a wall-clock time (YYYY-MM-DD HH:mm) is in a time zone. */
export function zonedInstant(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = (time || '00:00').split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asZone = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!);
  return guess - (asZone - guess);
}

/**
 * Everything the event's home needs in one go: the invitation, its guests and replies (one count:
 * lib/rsvp-summary), the plan's numbers, what the event offers, and the facts the next step is chosen by.
 */
export async function loadEventHome(
  ownerId: string,
  item: InvitationSummary,
  publicBase: string,
  now = Date.now(),
): Promise<EventHomeData | null> {
  const [inv, guests, replies, input] = await Promise.all([
    hostDb.get(item.id, ownerId),
    guestsDb.list(item.id, ownerId),
    hostDb.responses(item.id, ownerId),
    featureInput(item.id).catch(() => null),
  ]);
  if (!inv || !replies) return null;
  const doc = inv.draft;
  const zone = doc.timezone || DEFAULT_ZONE;
  const today = todayIn(zone, new Date(now));
  const daysLeft = daysBetween(today, item.date);
  const rsvp = rsvpSummary(guests ?? [], replies.responses);

  const offer = (why: ReturnType<typeof whyOff> | 'unavailable') =>
    why === null ? ('on' as const) : why === 'plan' ? ('plan' as const) : null;
  const features = deploymentFeatures();
  const planningOn = !!input && item.eventType !== 'save_the_date' && whyOff('planning', input) === null;
  const caps: WorkspaceCaps = {
    planning: planningOn,
    seating: offer(input ? whyOff('seating', input) : 'unavailable'),
    eventDay: offer(input ? whyOff('checkin', input) : 'unavailable'),
    gallery: features.has('live_gallery'),
    insights: features.has('analytics'),
  };

  let planning: EventHomeData['planning'] = null;
  let seating: HomeFacts['seating'] = null;
  if (planningOn) {
    const o = await planningOverview(ownerId, item.id, {
      eventType: item.eventType,
      status: item.status,
      unpublishedChanges: item.unpublishedChanges,
      guests: item.guests,
      sent: item.sent,
      responses: item.responses,
    }).catch((err) => (console.error('[event home] planning', err), null));
    if (o) {
      const totals = o.raw.totals;
      const tt = o.raw.taskTotals;
      planning = {
        planned: !!o.raw.settings,
        templateKey: o.raw.settings?.templateKey ?? null,
        budget:
          totals && totals.totalBudget !== null
            ? {
                total: totals.totalBudget,
                committed: totals.committed,
                paid: totals.paid,
                planned: totals.planned,
              }
            : null,
        tasks: {
          total: tt ? tt.total - tt.skipped : 0,
          done: tt?.done ?? 0,
          week: o.raw.settings && daysLeft >= 0 ? dueWithin(o.tasks, o.today, 7).length : 0,
          next: o.raw.settings ? nextTask(o.tasks) : null,
        },
        confirmed: {
          adults: o.raw.headcount?.confirmedAdults ?? 0,
          children: o.raw.headcount?.confirmedChildren ?? 0,
        },
      };
      if (o.raw.facts) seating = { tables: o.raw.facts.tables, unseated: o.raw.facts.confirmedUnseated };
    }
  }
  if (caps.seating !== 'on') seating = null;

  const facts: HomeFacts = {
    daysLeft,
    status: item.status,
    unpublishedChanges: item.unpublishedChanges,
    guests: item.guests,
    sent: item.sent,
    notAnswered: rsvp.notAnswered,
    unmatched: rsvp.unmatched,
    planning: planning
      ? {
          planned: planning.planned,
          totalBudget: planning.budget?.total ?? null,
          week: planning.tasks.week,
          open: Math.max(0, planning.tasks.total - planning.tasks.done),
        }
      : null,
    seating,
    eventDay: caps.eventDay === 'on',
    gallery: caps.gallery,
  };
  return {
    item,
    url: `${publicBase.replace(/\/+$/, '')}/i/${item.slug}`,
    startsAt: zonedInstant(item.date, doc.event.startTime, zone),
    daysLeft,
    facts,
    rsvp,
    caps,
    planning,
  };
}

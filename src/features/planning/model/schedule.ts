import { addDaysISO } from '@/features/invitations/lib/dates';

/**
 * Putting a template's tasks on the calendar. A plan made a year ahead keeps every task at its
 * nominal place (event date + offset). When there is less time than the template assumes the tasks
 * that would already be overdue are compressed, in order, into the first stretch of the time that is
 * left — so the first week is full and nothing is in the past — and the ones that lost their meaning
 * (a task's `minDays`) are offered for hiding. Pure: the database only stores what this decides.
 */

export const DAY_MS = 86_400_000;

/** Whole days from one calendar date to another (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export interface ScheduleInput {
  /** a stable id the result is keyed by */
  id: string;
  /** days from the event's date (negative = before) */
  offset: number;
  minDays?: number;
}
export interface ScheduleResult {
  id: string;
  due: string;
  /** moved from its nominal place because it would have been in the past */
  compressed: boolean;
  /** not meaningful with the time that is left: offered for hiding */
  suggestHide: boolean;
}

/** The share of the time that is left in which the compressed tasks are spread. */
export const COMPRESS_SPAN = 0.4;

export function computeSchedule(
  tasks: readonly ScheduleInput[],
  opts: { eventDate: string; today: string },
): ScheduleResult[] {
  const daysLeft = daysBetween(opts.today, opts.eventDate);
  // how far back the plan reaches: the earliest offset (negative)
  const horizon = Math.max(0, ...tasks.map((t) => (t.offset < 0 ? -t.offset : 0)));
  return tasks.map((t) => {
    const nominal = addDaysISO(opts.eventDate, t.offset);
    const lead = t.offset < 0 ? -t.offset : 0;
    const overdue = daysLeft >= 0 && lead > daysLeft && horizon > daysLeft;
    let due = nominal;
    if (overdue) {
      // lead in (daysLeft, horizon] → 0 .. span days from today, the earliest task first
      const span = Math.max(1, Math.floor(daysLeft * COMPRESS_SPAN));
      const share = (horizon - lead) / (horizon - daysLeft);
      due = addDaysISO(opts.today, Math.round(share * span));
    } else if (daysLeft < 0) {
      // the event is over: nothing is scheduled into the past
      due = nominal;
    }
    return {
      id: t.id,
      due,
      compressed: overdue,
      suggestHide: daysLeft >= 0 && t.minDays !== undefined && t.minDays > daysLeft,
    };
  });
}

/** Days from today to a date (negative: it is past). */
export const daysUntil = (today: string, date: string) => daysBetween(today, date);

/** The calendar day in a time zone — "today" for a plan whose event lives in that zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}

import { daysBetween } from '../model/schedule';

/** The bits of useUi() the planning screens format with. */
export interface UiHelpers {
  t: { planning: { common: Record<string, unknown> } };
  plural: (
    entry: { one: string; other: string },
    n: number,
    vars?: Record<string, string | number>,
  ) => string;
  number: (n: number) => string;
  date: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/**
 * "Today", "tomorrow", "3 days overdue", "in 5 days", or a short date when it is further away; and how
 * urgent it is, for its color.
 */
export function dueText(ui: UiHelpers, today: string, due: string | null): { text: string; tone: DueTone } {
  const c = ui.t.planning.common as unknown as {
    noDate: string;
    today: string;
    tomorrow: string;
    yesterday: string;
    inDays: { one: string; other: string };
    overdueBy: { one: string; other: string };
  };
  if (!due) return { text: c.noDate, tone: 'none' };
  const d = daysBetween(today, due);
  if (d === 0) return { text: c.today, tone: 'today' };
  if (d === 1) return { text: c.tomorrow, tone: 'soon' };
  if (d < 0) return { text: ui.plural(c.overdueBy, -d, { n: ui.number(-d) }), tone: 'overdue' };
  if (d <= 14) return { text: ui.plural(c.inDays, d, { n: ui.number(d) }), tone: 'soon' };
  return {
    text: ui.date(due, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    tone: 'later',
  };
}

export const toneClass: Record<DueTone, string> = {
  overdue: 'text-danger',
  today: 'text-warning',
  soon: 'text-ink',
  later: 'text-muted',
  none: 'text-muted',
};

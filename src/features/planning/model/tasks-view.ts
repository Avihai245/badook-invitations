import { CATEGORY_KEYS } from './categories';
import { daysBetween } from './schedule';
import { isDone, isOpen } from './week';
import type { TaskView } from './plan';

/**
 * How the tasks screen lays the plan out: the timeline's groups, by category, the flat list, and the
 * filter chips. Pure, so the arithmetic of "this week" and "overdue" is unit-tested.
 */

export const CHIPS = ['now', 'mine', 'cost', 'hidden'] as const;
export type Chip = (typeof CHIPS)[number];

export type TimelineKey = 'overdue' | 'week' | 'month' | 'later' | 'noDate' | 'done';
export const TIMELINE_ORDER: readonly TimelineKey[] = ['overdue', 'week', 'month', 'later', 'noDate', 'done'];

/** Tasks the host hid, and ones the plan only offers to hide (those wait in their own panel). */
export const isHidden = (t: Pick<TaskView, 'status'>) => t.status === 'skipped';
export const isSuggested = (t: Pick<TaskView, 'suggestHide' | 'status' | 'derived'>) =>
  t.suggestHide && t.status !== 'skipped' && t.status !== 'done' && t.derived !== true;

/** The tasks the chips leave on screen: hidden ones only with the "hidden" chip, never mixed in. */
export function filterTasks(tasks: readonly TaskView[], chips: ReadonlySet<Chip>, today: string): TaskView[] {
  let out = tasks.filter((t) => (chips.has('hidden') ? isHidden(t) : !isHidden(t) && !isSuggested(t)));
  if (chips.has('now'))
    out = out.filter((t) => isOpen(t) && t.dueDate !== null && daysBetween(today, t.dueDate) <= 14);
  if (chips.has('mine')) out = out.filter((t) => t.assignee === 'me');
  if (chips.has('cost')) out = out.filter((t) => t.budgetItemId !== null);
  return out;
}

const bySort = (a: TaskView, b: TaskView) => a.sort - b.sort;

/** Which timeline group an open task falls in (days from today: <0 overdue, ≤7 this week, ≤30 this month). */
export function timelineKey(t: TaskView, today: string): TimelineKey {
  if (isDone(t)) return 'done';
  if (t.dueDate === null) return 'noDate';
  const d = daysBetween(today, t.dueDate);
  return d < 0 ? 'overdue' : d <= 7 ? 'week' : d <= 30 ? 'month' : 'later';
}

export function groupTimeline(
  tasks: readonly TaskView[],
  today: string,
): { key: TimelineKey; tasks: TaskView[] }[] {
  const groups = new Map<TimelineKey, TaskView[]>(TIMELINE_ORDER.map((k) => [k, []]));
  for (const t of tasks) groups.get(timelineKey(t, today))!.push(t);
  return TIMELINE_ORDER.map((key) => ({
    key,
    // the done ones: the latest first; the rest in the host's order
    tasks:
      key === 'done'
        ? groups
            .get(key)!
            .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || bySort(a, b))
        : groups.get(key)!.sort(bySort),
  })).filter((g) => g.tasks.length > 0);
}

/** By budget/vendor category, in the order the categories are listed; tasks without one under "general". */
export function groupByCategory(
  tasks: readonly TaskView[],
): { key: (typeof CATEGORY_KEYS)[number] | null; tasks: TaskView[] }[] {
  const out: { key: (typeof CATEGORY_KEYS)[number] | null; tasks: TaskView[] }[] = [];
  const general = tasks.filter((t) => t.category === null).sort(bySort);
  if (general.length) out.push({ key: null, tasks: general });
  for (const key of CATEGORY_KEYS) {
    const list = tasks.filter((t) => t.category === key).sort(bySort);
    if (list.length) out.push({ key, tasks: list });
  }
  return out;
}

/** The flat list: open tasks in the host's order, then the done ones. */
export function flatList(tasks: readonly TaskView[]): TaskView[] {
  const open = tasks.filter((t) => !isDone(t)).sort(bySort);
  const done = tasks.filter(isDone).sort(bySort);
  return [...open, ...done];
}

/**
 * The whole list's order after a drag inside a group: the group's tasks take the places they held
 * in the current order, rearranged; every other task stays where it was.
 */
export function reorderWithin(
  all: readonly TaskView[],
  group: readonly string[],
  moved: readonly string[],
): string[] {
  const order = [...all].sort(bySort).map((t) => t.id);
  const inGroup = new Set(group);
  const slots = order.flatMap((id, i) => (inGroup.has(id) ? [i] : []));
  const next = [...order];
  slots.forEach((slot, i) => {
    next[slot] = moved[i]!;
  });
  return next;
}

/** The ids' new order after moving one up or down by `by` places among `ids` (clamped). */
export function moveId(ids: readonly string[], id: string, by: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const to = Math.max(0, Math.min(ids.length - 1, from + by));
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

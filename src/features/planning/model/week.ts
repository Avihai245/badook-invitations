import { daysBetween } from './schedule';
import type { TaskView } from './plan';

/**
 * Which tasks are the host's to do. A task is open when it is to do or in progress, not hidden or
 * offered for hiding, and — for a system task — not already done by what the app can see.
 */
export const isOpen = (t: Pick<TaskView, 'status' | 'suggestHide' | 'derived'>) =>
  (t.status === 'todo' || t.status === 'doing') && !t.suggestHide && t.derived !== true;

/** A task done, by the host or by the app. */
export const isDone = (t: Pick<TaskView, 'status' | 'derived'>) => t.status === 'done' || t.derived === true;

/** Open tasks that are overdue or due within `days` days (undated ones are nobody's deadline). */
export function dueWithin<T extends Pick<TaskView, 'status' | 'suggestHide' | 'derived' | 'dueDate'>>(
  tasks: readonly T[],
  today: string,
  days = 7,
): T[] {
  return tasks.filter((t) => isOpen(t) && t.dueDate !== null && daysBetween(today, t.dueDate) <= days);
}

/** The open task to do next: the earliest due (undated last), the important one first on a tie. */
export function nextTask<
  T extends Pick<TaskView, 'status' | 'suggestHide' | 'derived' | 'dueDate' | 'priority' | 'sort'>,
>(tasks: readonly T[]): T | null {
  const open = tasks.filter(isOpen);
  open.sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return b.priority - a.priority || a.sort - b.sort;
  });
  return open[0] ?? null;
}

import type { PrivateTemplateItems } from './draft';
import type { RawPlanState, PlanTask } from './plan';
import { daysBetween } from './schedule';

/**
 * A plan as a template the host can start their next events from: their own tasks (named in the language
 * they read now, with where each falls relative to the event), and the budget's categories as shares of
 * what was planned. The system tasks are left out — every new plan gets its own — and so are hidden ones,
 * and anything that has no place on the calendar.
 */
export function planToTemplateItems(
  raw: Pick<RawPlanState, 'tasks' | 'categories' | 'totals' | 'settings' | 'invitation'>,
  titleOf: (task: PlanTask) => string | null,
  notesOf: (task: PlanTask) => string | null,
): PrivateTemplateItems {
  const eventDate = raw.invitation.date;
  const tasks = raw.tasks
    .filter((t) => t.systemKey === null && t.status !== 'skipped')
    .flatMap((t) => {
      const title = titleOf(t)?.trim();
      const offset = t.offsetDays ?? (t.dueDate && eventDate ? daysBetween(eventDate, t.dueDate) : null);
      if (!title || offset === null || offset < -1000 || offset > 1000) return [];
      return [
        {
          title: title.slice(0, 200),
          notes: notesOf(t)?.slice(0, 2000) ?? null,
          offsetDays: offset,
          category: t.category,
          priority: t.priority,
        },
      ];
    })
    .slice(0, 200);

  const planned = new Map(raw.totals.byCategory.map((c) => [c.id, c.planned]));
  const weights = raw.categories.map((c) => ({ c, w: Math.max(0, planned.get(c.id) ?? c.plannedAmount) }));
  const sum = weights.reduce((n, x) => n + x.w, 0);
  // shares that add up to exactly 100 (largest remainder); equal shares when nothing was planned yet
  const base = weights.map(({ c, w }) => ({
    c,
    exact: sum > 0 ? (w * 100) / sum : 100 / Math.max(1, weights.length),
  }));
  const floors = base.map((x) => Math.floor(x.exact));
  let left = 100 - floors.reduce((n, v) => n + v, 0);
  const order = base.map((x, i) => ({ i, rem: x.exact - floors[i]! })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left--;
  }
  const categories = base
    .map(({ c }, i) => ({
      key: c.key,
      name: c.name,
      pct: floors[i]!,
      basis: c.costBasis,
      required: c.required,
    }))
    .filter((c) => c.pct > 0);
  const kept = new Set(categories.map((c) => c.key).filter((k): k is NonNullable<typeof k> => k !== null));
  return {
    tasks,
    categories,
    requiredVendors: (raw.settings?.requiredVendors ?? []).filter((k) => kept.has(k)),
  };
}

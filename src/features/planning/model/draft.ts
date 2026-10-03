import { addDaysISO } from '@/features/invitations/lib/dates';
import { isCategoryKey, type CategoryKey, type CostBasis, type Variant } from './categories';
import { computeSchedule } from './schedule';
import { systemTasksFor } from './system-tasks';
import type { PlanTemplate, SystemKey } from './types';

/**
 * A plan on paper before it is saved: a template's tasks put on the calendar (with the system tasks
 * that fit the event), and its budget categories sized to the total. What `planning_init` stores.
 */

export interface InitTask {
  /** null: named by the template (tplKey) or the dictionary (systemKey) */
  title: string | null;
  notes: string | null;
  offsetDays: number | null;
  dueDate: string | null;
  category: CategoryKey | null;
  priority: 0 | 1;
  systemKey: SystemKey | null;
  tplKey: string | null;
  suggestHide: boolean;
  sort: number;
}

export interface InitCategory {
  key: CategoryKey | null;
  name: string | null;
  plannedAmount: number;
  costBasis: CostBasis;
  unitPrice: number | null;
  childPrice: number | null;
  required: boolean;
  sort: number;
}

export interface PlanDraft {
  tasks: InitTask[];
  categories: InitCategory[];
  requiredVendors: CategoryKey[];
}

export interface DraftContext {
  eventDate: string;
  today: string;
  /** the invitation's RSVP deadline, when it has one */
  deadline: string | null;
  variant: Variant;
  /** the event has the seating / the event day features, and the template is for an event with seats */
  features: { seating: boolean; checkin: boolean };
  totalBudget: number | null;
  /** the guest numbers a per-head price is worked out from */
  headcount: { adults: number; children: number; tables: number };
}

/** A task of a private template: the host's own words, in the language they were written in. */
export interface PrivateTask {
  title: string;
  notes: string | null;
  offsetDays: number;
  category: CategoryKey | null;
  priority: 0 | 1;
}
export interface PrivateTemplateItems {
  tasks: PrivateTask[];
  categories: {
    key: CategoryKey | null;
    name: string | null;
    pct: number;
    basis: CostBasis;
    required: boolean;
  }[];
  requiredVendors: CategoryKey[];
}

interface Entry {
  id: string;
  offset: number;
  minDays?: number;
  fixedDue?: string;
  task: Omit<InitTask, 'dueDate' | 'suggestHide' | 'sort' | 'offsetDays'>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A per-head price that makes the category come to its share today (null: nothing to divide by). */
function unitPriceFor(
  basis: CostBasis,
  planned: number,
  h: { adults: number; children: number; tables: number },
): number | null {
  const divisor =
    basis === 'per_adult'
      ? h.adults
      : basis === 'per_child'
        ? h.children
        : basis === 'per_guest'
          ? h.adults + h.children
          : basis === 'per_table'
            ? h.tables
            : 0;
  return divisor > 0 && planned > 0 ? round2(planned / divisor) : null;
}

function finish(
  entries: Entry[],
  categories: {
    key: CategoryKey | null;
    name: string | null;
    pct: number;
    basis: CostBasis;
    required: boolean;
  }[],
  requiredVendors: CategoryKey[],
  ctx: DraftContext,
): PlanDraft {
  const schedule = computeSchedule(
    entries.map((e) => ({ id: e.id, offset: e.offset, minDays: e.minDays })),
    { eventDate: ctx.eventDate, today: ctx.today },
  );
  const byId = new Map(schedule.map((s) => [s.id, s]));
  const tasks = entries
    .map((e, i) => {
      const s = byId.get(e.id)!;
      return {
        ...e.task,
        offsetDays: e.offset,
        dueDate: e.fixedDue ?? s.due,
        suggestHide: s.suggestHide,
        order: i,
      };
    })
    // in the order they fall due; the template's own order breaks a tie
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : a.order - b.order))
    .map(({ order: _order, ...t }, i): InitTask => ({ ...t, sort: (i + 1) * 10 }));

  const cats = categories.map((c, i): InitCategory => {
    const planned = ctx.totalBudget ? round2((ctx.totalBudget * c.pct) / 100) : 0;
    return {
      key: c.key,
      name: c.name,
      plannedAmount: planned,
      costBasis: c.basis,
      unitPrice: c.basis === 'fixed' ? null : unitPriceFor(c.basis, planned, ctx.headcount),
      childPrice: null,
      required: c.required,
      sort: (i + 1) * 10,
    };
  });
  return { tasks, categories: cats, requiredVendors };
}

function systemEntries(size: 'full' | 'light', seated: boolean, ctx: DraftContext): Entry[] {
  return systemTasksFor({ size, seating: ctx.features.seating, checkin: ctx.features.checkin, seated }).map(
    (s): Entry => ({
      id: `s:${s.key}`,
      offset: s.offset,
      minDays: s.minDays,
      // the two that come from data are dated by the invitation's deadline when it has one
      fixedDue:
        s.key === 'rsvp_deadline' && ctx.deadline
          ? ctx.deadline
          : s.key === 'final_headcount' && ctx.deadline
            ? addDaysISO(ctx.deadline, 1)
            : undefined,
      task: {
        title: null,
        notes: null,
        category: null,
        priority: 0,
        systemKey: s.key,
        tplKey: null,
      },
    }),
  );
}

/** Whether a template is for an event with a seating plan and an entrance (full ones, and a company event). */
export const hasSeats = (tpl: PlanTemplate) => tpl.size === 'full' || tpl.key === 'corporate';

/** A system template's plan. */
export function buildPlanDraft(tpl: PlanTemplate, ctx: DraftContext): PlanDraft {
  const entries: Entry[] = [
    ...systemEntries(tpl.size, hasSeats(tpl), ctx),
    ...tpl.tasks
      .filter((t) => !t.variants || t.variants.includes(ctx.variant))
      .map((t): Entry => ({
        id: `t:${t.key}`,
        offset: t.offset,
        minDays: t.minDays,
        task: {
          title: null,
          notes: null,
          category: t.category ?? null,
          priority: t.priority ?? 0,
          systemKey: null,
          tplKey: t.key,
        },
      })),
  ];
  const required = new Set<CategoryKey>(tpl.requiredVendors);
  return finish(
    entries,
    tpl.categories.map((c) => ({
      key: c.key,
      name: null,
      pct: c.pct,
      basis: c.basis,
      required: required.has(c.key),
    })),
    [...tpl.requiredVendors],
    ctx,
  );
}

/** A private template's plan: the host's own tasks, with the system tasks the new event fits. */
export function buildPlanDraftFromPrivate(items: PrivateTemplateItems, ctx: DraftContext): PlanDraft {
  const entries: Entry[] = [
    ...systemEntries('full', true, ctx),
    ...items.tasks.map((t, i): Entry => ({
      id: `p:${i}`,
      offset: t.offsetDays,
      task: {
        title: t.title,
        notes: t.notes,
        category: t.category,
        priority: t.priority,
        systemKey: null,
        tplKey: null,
      },
    })),
  ];
  return finish(
    entries,
    items.categories.map((c) => ({
      key: c.key,
      name: c.name,
      pct: c.pct,
      basis: c.basis,
      required: c.required,
    })),
    items.requiredVendors.filter(isCategoryKey),
    ctx,
  );
}

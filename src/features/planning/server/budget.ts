import type { CostBasis, ItemStatus, VatMode } from '../model/categories';
import { itemAmount, categoryRows, paymentRows } from '../model/budget-view';
import { readIntegrations } from '../model/integrations';
import type { PlanCategory, RawPlanState } from '../model/plan';
import { BudgetOp } from '../model/schemas-budget';
import { fail, gate, isRefusal, notFound, ok, rawState, type ApiResult, type PlanningDeps } from './types';

/**
 * The budget's API (POST /api/invitations/:id/planning/budget), the Excel file, and the event day's
 * payments, as plain functions over injected dependencies (tests/unit/planning-budget.test.ts). Every
 * call checks that the event is the signed-in host's and has the `planning` feature; money totals are the
 * database's — the screens call the plan again after a write.
 */

const invalid = (error: { issues: { path: PropertyKey[] }[] }) =>
  fail(400, 'invalid', {
    fields: [...new Set(error.issues.map((i) => i.path.slice(0, 3).join('.')))].slice(0, 10),
  });

/** What the database answered for a write: null is "not the host's" (or another event's id), { ok: false, code } a refusal. */
function refusal(answer: unknown): ApiResult | null {
  if (answer === null || answer === undefined) return notFound;
  const a = answer as { ok?: boolean; code?: string };
  if (a.ok !== false) return null;
  const code = a.code ?? 'invalid';
  return fail(code === 'too_many' ? 422 : code === 'duplicate' ? 409 : 400, code);
}

type Rpc = { p_id: string; p_owner: string };

/**
 * POST …/planning/budget { op, … }: `category_save` · `category_delete` · `item_save` (with the item's
 * payment schedule, which it replaces) · `item_delete` · `payment_save` · `payment_delete` ·
 * `payment_paid`. A new id is the client's to choose (undoing a delete puts the same row back). Files on
 * an item are a paid tool (`planning_export`) and must be under <user>/<event>/ in the plan-files bucket.
 */
export async function budgetOperation(
  userId: string,
  id: string,
  body: unknown,
  deps: PlanningDeps,
): Promise<ApiResult> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return g;
  const parsed = BudgetOp.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const who: Rpc = { p_id: id, p_owner: userId };
  switch (input.op) {
    case 'category_save': {
      const category = await deps.rpc<PlanCategory | { ok: false; code: string } | null>(
        'planning_category_save',
        { ...who, p_category: input.category },
      );
      return refusal(category) ?? ok({ category });
    }
    case 'category_delete': {
      const deleted = await deps.rpc<number | null>('planning_category_delete', { ...who, p_ids: input.ids });
      return refusal(deleted) ?? ok({ deleted });
    }
    case 'item_save': {
      const files = input.item.attachments ?? [];
      if (files.length > 0) {
        const prefix = `${userId}/${id}/`;
        // only this event's own files, and nothing that climbs out of its folder
        if (
          !files.every(
            (f) =>
              f.path.startsWith(prefix) &&
              !f.path.includes('..') &&
              !f.path.slice(prefix.length).includes('/'),
          )
        )
          return fail(400, 'invalid', { fields: ['item.attachments'] });
        const allowed = await gate(userId, id, deps, 'planning_export');
        if (isRefusal(allowed)) return allowed;
      }
      const saved = await deps.rpc<
        { item: unknown; payments: unknown[] } | { ok: false; code: string } | null
      >('planning_item_save', { ...who, p_item: input.item, p_payments: input.payments ?? null });
      const refused = refusal(saved);
      if (refused) return refused;
      const { item, payments } = saved as { item: unknown; payments: unknown[] };
      return ok({ item, payments });
    }
    case 'item_delete': {
      const deleted = await deps.rpc<number | null>('planning_item_delete', { ...who, p_ids: input.ids });
      return refusal(deleted) ?? ok({ deleted });
    }
    case 'payment_save': {
      const payment = await deps.rpc<unknown>('planning_payment_save', { ...who, p_payment: input.payment });
      return refusal(payment) ?? ok({ payment });
    }
    case 'payment_delete': {
      const deleted = await deps.rpc<number | null>('planning_payment_delete', { ...who, p_ids: input.ids });
      return refusal(deleted) ?? ok({ deleted });
    }
    case 'payment_paid': {
      const done = await deps.rpc<{ payment: unknown; itemStatus: string } | null>('planning_payment_paid', {
        ...who,
        p_payment: input.id,
        p_paid: input.paid,
      });
      if (!done) return notFound;
      return ok({ payment: done.payment, itemStatus: done.itemStatus });
    }
  }
}

// ─── the payments to make at the event itself ───────────────────────────────────────────────────

export interface EventDayPayment {
  id: string;
  label: string;
  amount: number;
  paidAt: string | null;
  itemTitle: string;
  vendorName: string | null;
}

/**
 * The payments marked "at the event" for the event day's screen — the open ones first. null when there is
 * nothing to show there: the event isn't the host's or has no planning, there is no plan, or the host
 * switched the event-day link off. A database failure throws: the event day's page guards the call and
 * shows nothing rather than break.
 */
export async function todayPayments(
  userId: string,
  id: string,
  deps: PlanningDeps,
): Promise<EventDayPayment[] | null> {
  const g = await gate(userId, id, deps);
  if (isRefusal(g)) return null;
  const raw = await rawState(deps, id, userId);
  if (!raw?.settings) return null;
  if (!readIntegrations(raw.settings.integrations).eventDay) return null;
  const rows = await deps.rpc<EventDayPayment[] | null>('planning_event_day_payments', {
    p_id: id,
    p_owner: userId,
  });
  return rows ?? null;
}

// ─── the Excel file ─────────────────────────────────────────────────────────────────────────────

/** The file's words (the dictionary's `excel`, with the names it uses for categories, stages and bases). */
export interface BudgetSheetWords {
  summarySheet: string;
  categoriesSheet: string;
  itemsSheet: string;
  paymentsSheet: string;
  totalBudget: string;
  planned: string;
  expected: string;
  committed: string;
  paid: string;
  unpaid: string;
  remaining: string;
  perGuest: string;
  vat: string;
  adults: string;
  children: string;
  tables: string;
  category: string;
  basis: string;
  unitPrice: string;
  childPrice: string;
  item: string;
  vendor: string;
  status: string;
  estimate: string;
  quoted: string;
  final: string;
  amount: string;
  notes: string;
  due: string;
  label: string;
  payer: string;
  eventDay: string;
  paidOn: string;
  yes: string;
  noDate: string;
  none: string;
  vatModes: Record<VatMode, string>;
  statuses: Record<ItemStatus, string>;
  bases: Record<CostBasis, string>;
  categories: Record<string, string>;
}

export type SheetCell = string | number | null;
export interface BudgetSheet {
  name: string;
  /** the first row is the header */
  rows: SheetCell[][];
  /** the columns that are money (formatted as such, summed by the host's own formulas) */
  money: number[];
  /** the rows whose second cell is money (the summary lists numbers of both kinds) */
  moneyRows?: number[];
  widths: number[];
}

/**
 * The budget as sheets: the numbers (with the guest numbers they follow), the categories (planned,
 * committed, paid), every item, and the payment schedule. Pure: tests/unit/planning-budget.test.ts.
 */
export function budgetSheets(
  raw: Pick<
    RawPlanState,
    'settings' | 'categories' | 'items' | 'payments' | 'vendors' | 'totals' | 'headcount'
  >,
  w: BudgetSheetWords,
): BudgetSheet[] {
  const vatMode = raw.settings?.vatMode ?? 'included';
  const vatPct = raw.settings?.vatPct ?? 18;
  const name = (c: PlanCategory) => c.name ?? (c.key ? (w.categories[c.key] ?? c.key) : '');
  const vendors = new Map(raw.vendors.map((v) => [v.id, v.name]));
  const rows = categoryRows(raw);
  const t = raw.totals;

  const summary: SheetCell[][] = [
    [w.summarySheet, ''],
    [w.totalBudget, t.totalBudget],
    [w.planned, t.planned],
    [w.expected, t.expected],
    [w.committed, t.committed],
    [w.paid, t.paid],
    [w.unpaid, t.unpaid],
    [w.remaining, t.remaining],
    [w.perGuest, t.perGuest],
    [w.vat, vatMode === 'none' ? w.vatModes.none : `${w.vatModes[vatMode]} (${vatPct}%)`],
    [w.adults, raw.headcount.adults],
    [w.children, raw.headcount.children],
    [w.tables, raw.headcount.tables],
  ];

  const categories: SheetCell[][] = [
    [w.category, w.basis, w.unitPrice, w.childPrice, w.planned, w.expected, w.committed, w.paid],
    ...rows.map(({ category: c, totals }): SheetCell[] => [
      name(c),
      w.bases[c.costBasis],
      c.costBasis === 'fixed' ? null : c.unitPrice,
      c.costBasis === 'per_adult' ? c.childPrice : null,
      totals.planned,
      totals.expected,
      totals.committed,
      totals.paid,
    ]),
  ];

  const items: SheetCell[][] = [
    [w.category, w.item, w.vendor, w.status, w.estimate, w.quoted, w.final, w.amount, w.notes],
    ...rows.flatMap(({ category, items: list }) =>
      list.map((i): SheetCell[] => [
        name(category),
        i.title,
        i.vendorId ? (vendors.get(i.vendorId) ?? null) : null,
        w.statuses[i.status],
        i.estimate,
        i.quoted,
        i.final,
        itemAmount(i, vatMode, vatPct),
        i.notes,
      ]),
    ),
  ];

  const payments: SheetCell[][] = [
    [w.due, w.item, w.category, w.label, w.amount, w.paidOn, w.payer, w.eventDay],
    ...paymentRows(raw).map(({ payment: p, item, category }): SheetCell[] => [
      p.dueDate ?? w.noDate,
      item.title,
      category ? name(category) : null,
      p.label,
      p.amount,
      p.paidAt ? p.paidAt.slice(0, 10) : w.none,
      p.payer,
      p.payOnEventDay ? w.yes : null,
    ]),
  ];

  return [
    { name: w.summarySheet, rows: summary, money: [], moneyRows: [1, 2, 3, 4, 5, 6, 7, 8], widths: [28, 22] },
    {
      name: w.categoriesSheet,
      rows: categories,
      money: [2, 3, 4, 5, 6, 7],
      widths: [26, 18, 14, 14, 14, 14, 14, 14],
    },
    { name: w.itemsSheet, rows: items, money: [4, 5, 6, 7], widths: [24, 30, 22, 14, 14, 14, 14, 16, 40] },
    { name: w.paymentsSheet, rows: payments, money: [4], widths: [14, 30, 24, 20, 14, 14, 16, 14] },
  ];
}

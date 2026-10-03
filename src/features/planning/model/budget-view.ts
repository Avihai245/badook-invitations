import type { ItemStatus, VatMode } from './categories';
import type { CategoryTotals, PlanCategory, PlanItem, PlanPayment, PlanView } from './plan';

/**
 * The budget screen's pure helpers (and the Excel file's): what an item amounts to with VAT (the mirror of
 * planning_item_amount, asserted on the same cases as the database in tests/unit/planning-budget.test.ts),
 * how an item compares with its estimate, the categories with their items and totals, the payments as a
 * schedule, and what the host types in a money field. The plan's totals themselves are the database's.
 */

/** The files a quote or a receipt can be (the plan-files bucket's types), and how many an item may hold. */
export const ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_ATTACHMENTS = 12;

type Amounts = Pick<PlanItem, 'estimate' | 'quoted' | 'final' | 'vatIncluded'>;

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * One item's amount with VAT on the plan's terms: the final price, else the quote, else the estimate;
 * an amount entered without VAT (the plan's mode, or the item's own mark) is shown with it.
 */
export function itemAmount(i: Amounts, vatMode: VatMode, vatPct: number): number {
  const base = i.final ?? i.quoted ?? i.estimate ?? 0;
  const withVat = vatMode !== 'none' && !(i.vatIncluded ?? vatMode === 'included');
  return withVat ? Math.round(base * (100 + vatPct)) / 100 : cents(base);
}

export interface Variance {
  /** what it was estimated at */
  plan: number;
  /** what it is now: the final price, else the quote */
  actual: number;
  /** actual − plan: positive is over the estimate */
  delta: number;
}

/** How an item compares with its estimate; null while there is nothing to compare (no estimate, no quote). */
export function itemVariance(i: Amounts, vatMode: VatMode, vatPct: number): Variance | null {
  if (i.estimate === null || (i.final === null && i.quoted === null)) return null;
  const plan = itemAmount({ ...i, quoted: null, final: null }, vatMode, vatPct);
  const actual = itemAmount({ ...i, estimate: null }, vatMode, vatPct);
  return { plan, actual, delta: cents(actual - plan) };
}

/** The stages of an item, in the order they happen. */
export const STAGES: readonly ItemStatus[] = ['estimate', 'quoted', 'booked', 'paid'];
/** Committed to: the host has booked it (or paid for it). */
export const isCommitted = (s: ItemStatus) => s === 'booked' || s === 'paid';

export interface CategoryRow {
  category: PlanCategory;
  items: PlanItem[];
  totals: CategoryTotals;
}

const NO_TOTALS = (id: string): CategoryTotals => ({ id, planned: 0, expected: 0, committed: 0, paid: 0 });

/** The event's categories in their order, each with its items and the database's totals for it. */
export function categoryRows(view: Pick<PlanView, 'categories' | 'items' | 'totals'>): CategoryRow[] {
  const totals = new Map(view.totals.byCategory.map((c) => [c.id, c]));
  const items = new Map<string, PlanItem[]>();
  for (const i of [...view.items].sort((a, b) => a.sort - b.sort)) {
    const list = items.get(i.categoryId);
    if (list) list.push(i);
    else items.set(i.categoryId, [i]);
  }
  return [...view.categories]
    .sort((a, b) => a.sort - b.sort)
    .map((category) => ({
      category,
      items: items.get(category.id) ?? [],
      totals: totals.get(category.id) ?? NO_TOTALS(category.id),
    }));
}

/** A category committed for more than it was planned to cost (nothing planned: nothing to exceed). */
export const categoryOver = (t: CategoryTotals): number =>
  t.planned > 0 && t.committed > t.planned ? cents(t.committed - t.planned) : 0;

/** The plan's total budget exceeded by what is committed (0 when it isn't, or there is no total). */
export const totalOver = (committed: number, totalBudget: number | null): number =>
  totalBudget !== null && committed > totalBudget ? cents(committed - totalBudget) : 0;

export interface PaymentRow {
  payment: PlanPayment;
  item: PlanItem;
  category: PlanCategory | null;
}

/** Every payment as a schedule: by due date (those without one last), then in the order they were made. */
export function paymentRows(view: Pick<PlanView, 'categories' | 'items' | 'payments'>): PaymentRow[] {
  const items = new Map(view.items.map((i) => [i.id, i]));
  const cats = new Map(view.categories.map((c) => [c.id, c]));
  const rows: PaymentRow[] = [];
  for (const payment of view.payments) {
    const item = items.get(payment.itemId);
    if (item) rows.push({ payment, item, category: cats.get(item.categoryId) ?? null });
  }
  return rows
    .map((r, n) => ({ r, n }))
    .sort((a, b) => {
      const da = a.r.payment.dueDate;
      const db = b.r.payment.dueDate;
      if (da !== db) return da === null ? 1 : db === null ? -1 : da < db ? -1 : 1;
      return a.n - b.n;
    })
    .map(({ r }) => r);
}

/** Still to pay and its date has passed. */
export const isOverdue = (p: Pick<PlanPayment, 'paidAt' | 'dueDate'>, today: string): boolean =>
  p.paidAt === null && p.dueDate !== null && p.dueDate < today;

/** What an item's status becomes when its payments are: every one paid → paid; one reopened → booked. */
export function statusFromPayments(
  status: ItemStatus,
  payments: readonly Pick<PlanPayment, 'paidAt'>[],
): ItemStatus {
  if (payments.length === 0) return status;
  const open = payments.some((p) => p.paidAt === null);
  if (!open) return 'paid';
  return status === 'paid' ? 'booked' : status;
}

/**
 * What the host typed in a money field: '' is nothing (null), "12,500" and "12500.5" are numbers with at most
 * two decimals, anything else is undefined (not a number we can save).
 */
export function parseAmount(text: string): number | null | undefined {
  const s = text.replace(/[\s,₪]/g, '');
  if (s === '') return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return undefined;
  const n = Number(s);
  return n <= 1_000_000_000 ? n : undefined;
}

/** A number as it is typed back into a money field (no separators: it is edited as it stands). */
export const amountText = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : String(n);

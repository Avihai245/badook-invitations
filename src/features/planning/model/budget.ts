import type { CostBasis } from './categories';
import type { PlanCategory } from './plan';

/**
 * Money on the screens. The totals are the database's (supabase/migrations/*_planning_core.sql); the one
 * formula here is its mirror for "what if" — a slider on the guests or the price of a plate, nothing
 * saved — and is tested against the same cases (tests/unit/planning-budget.test.ts).
 */

export interface Counts {
  adults: number;
  children: number;
  tables: number;
}

/** What a category is planned to cost with these numbers (planning_category_planned). */
export function categoryPlanned(
  c: Pick<PlanCategory, 'costBasis' | 'plannedAmount' | 'unitPrice' | 'childPrice'>,
  n: Counts,
): number {
  const basis: CostBasis = c.costBasis;
  if (c.unitPrice === null || basis === 'fixed') return c.plannedAmount;
  const v =
    basis === 'per_adult'
      ? c.unitPrice * n.adults + (c.childPrice ?? 0) * n.children
      : basis === 'per_child'
        ? c.unitPrice * n.children
        : basis === 'per_guest'
          ? c.unitPrice * (n.adults + n.children)
          : c.unitPrice * n.tables;
  return Math.round(v * 100) / 100;
}

/** The categories' planned total with these numbers. */
export function plannedTotal(cats: readonly PlanCategory[], n: Counts): number {
  return Math.round(cats.reduce((sum, c) => sum + categoryPlanned(c, n), 0) * 100) / 100;
}

/** ₪ with a thousands separator and no agorot unless there are some (the screen sets dir="ltr"). */
export function shekels(n: number, locale: 'he' | 'en' = 'he'): string {
  const hasAgorot = Math.round(n * 100) % 100 !== 0;
  const s = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    minimumFractionDigits: hasAgorot ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return `${n < 0 ? '−' : ''}₪${s}`;
}

/** The share of `part` in `whole`, 0..100 (0 when there is no whole). */
export const percentOf = (part: number, whole: number) =>
  whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0;

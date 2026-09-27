import type { UiLocale } from '@/lib/i18n/app';
import { adminDict } from '../i18n';
import { can, type StaffRole } from '../permissions';
import {
  parsePaymentFilters,
  paymentsCsv,
  paymentsFileName,
  type PaymentFilters,
  type PaymentRow,
  type PaymentsCsvLabels,
} from './model';

/**
 * The cash-flow area's API over injected dependencies (tests/unit/admin-finance.test.ts); the route
 * (app/api/admin/finance/export) wires the database in.
 */

export interface ExportDeps {
  /** the matching payments, contact details as the role may see them (finance.export; recorded) */
  rows(actor: string, filters: PaymentFilters): Promise<PaymentRow[]>;
  labels(locale: UiLocale): PaymentsCsvLabels;
  now(): number;
}

/** The spreadsheet's words in the console's language. */
export function paymentsCsvLabels(locale: UiLocale): PaymentsCsvLabels {
  const f = adminDict(locale).finance;
  return {
    headers: f.csv,
    kinds: f.kinds,
    statuses: f.statuses,
    products: f.products,
    deleted: f.deletedAccount,
  };
}

/** A file to hand the browser, or why not. */
export type FileResult =
  { status: 200; filename: string; contentType: string; body: string } | { status: 403; code: 'forbidden' };

/**
 * GET /api/admin/finance/export?kind=&status=&product=&provider=&from=&to=&q= — the payments the
 * filters match (as on the page; at most 10,000, newest first) as a spreadsheet: headers in the
 * console's language, dates in Israel. finance.export only (the database checks it again, and records
 * the export).
 */
export async function exportPayments(
  staff: { userId: string; role: StaffRole },
  params: URLSearchParams,
  locale: UiLocale,
  deps: ExportDeps,
): Promise<FileResult> {
  if (!can(staff.role, 'finance.export')) return { status: 403, code: 'forbidden' };
  const rows = await deps.rows(staff.userId, parsePaymentFilters(params));
  return {
    status: 200,
    filename: paymentsFileName(deps.now()),
    contentType: 'text/csv; charset=utf-8',
    body: paymentsCsv(rows, deps.labels(locale)),
  };
}

import 'server-only';
import { planPrices } from '@/features/billing/server/account';
import { serverEnv } from '@/lib/env';
import type { UiLocale } from '@/lib/i18n/app';
import { adminDict } from '../i18n';
import { adminRpc } from '../server/db';
import type { Staff } from '../server/gate';
import type { ExportDeps } from './api';
import {
  financeView,
  PAYMENTS_PAGE_SIZE,
  type FinanceOverviewRaw,
  type FinanceView,
  type PaymentFilters,
  type PaymentRow,
  type PaymentsCsvLabels,
  type PaymentsPage,
} from './model';

/**
 * The cash-flow area's database functions (supabase/migrations/*_admin_money_messages.sql): each takes
 * the acting staff member and checks their role itself; the plans' list prices come from the
 * configuration (INVITES_PRICE_*), for plans bought before the price paid was kept.
 */

const listPrices = () => {
  const p = planPrices();
  return { pro: p.pro, business: p.business };
};

export interface FinanceSummaryRaw {
  revenueMonth: number;
  revenuePrevMonth: number;
  mrr: number;
  activeSubscriptions: number;
  whatsappUsdMonth: number;
}

export const financeDb = {
  overview: (actor: string) =>
    adminRpc<FinanceOverviewRaw>('admin_finance_overview', { p_actor: actor, p_prices: listPrices() }),
  payments: (actor: string, filters: PaymentFilters, limit: number, offset: number) =>
    adminRpc<PaymentsPage>('admin_finance_payments', {
      p_actor: actor,
      p_filters: filters,
      p_limit: limit,
      p_offset: offset,
    }),
  /** finance.export; recorded in the record of actions */
  export: (actor: string, filters: PaymentFilters) =>
    adminRpc<PaymentRow[]>('admin_finance_export', { p_actor: actor, p_filters: filters }),
  summary: (actor: string) =>
    adminRpc<FinanceSummaryRaw>('admin_finance_summary', { p_actor: actor, p_prices: listPrices() }),
};

export interface FinancePageData {
  view: FinanceView;
  payments: PaymentsPage & { page: number; pageSize: number };
  filters: PaymentFilters;
}

/** The cash-flow page: the numbers, and the page of payments the filters ask for. */
export async function loadFinance(
  staff: Staff,
  filters: PaymentFilters,
  page: number,
): Promise<FinancePageData> {
  const [raw, payments] = await Promise.all([
    financeDb.overview(staff.userId),
    financeDb.payments(staff.userId, filters, PAYMENTS_PAGE_SIZE, (page - 1) * PAYMENTS_PAGE_SIZE),
  ]);
  return {
    view: financeView(raw, serverEnv().INVITES_USD_TO_ILS),
    payments: { ...payments, page, pageSize: PAYMENTS_PAGE_SIZE },
    filters,
  };
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

export const exportDeps: ExportDeps = {
  rows: (actor, filters) => financeDb.export(actor, filters),
  labels: paymentsCsvLabels,
  now: () => Date.now(),
};

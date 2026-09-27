import { z } from 'zod';
import { PRODUCTS, VAT_RATE, type Product } from '@/features/billing/plans';

/**
 * The console's cash flow (/app/admin/finance): what the database adds up (admin_finance_overview,
 * supabase/migrations/*_admin_money_messages.sql — shekels including VAT, WhatsApp in USD) and what is
 * worked out from it here: VAT and income without it, WhatsApp's cost in shekels, net, gross margin,
 * MRR, ARPU, the change from last month; the payments' filters and their spreadsheet. Isomorphic and
 * pure (tests/unit/admin-finance.test.ts).
 */

// ─── what the database returns ─────────────────────────────────────────────────────────────────

export interface IncomeTotals {
  /** first payments of a plan (Pro, Business) */
  newPlans: number;
  /** monthly renewals of a plan */
  renewals: number;
  /** message packs */
  packs: number;
  total: number;
  payments: number;
  /** accounts that paid */
  customers: number;
}

export interface FinanceMonthRaw {
  /** YYYY-MM (Israel) */
  month: string;
  newPlans: number;
  renewals: number;
  packs: number;
  total: number;
  payments: number;
  whatsappUsd: number;
}

export interface PlanSubscriptions {
  count: number;
  /** the monthly price of each, added up */
  mrr: number;
  /** how many renew at the list price (bought before the price paid was kept) */
  listPriced: number;
}

export interface AtRiskRow {
  userId: string;
  name: string | null;
  /** masked for roles without users.pii */
  email: string | null;
  plan: 'pro' | 'business';
  /** past_due: the last monthly charge failed; late: the renewal is more than 3 days late */
  why: 'past_due' | 'late';
  monthly: number;
  renewsAt: string | null;
}

export interface CreditsMonth {
  month: string;
  bought: number;
  /** granted with the plans each month */
  plans: number;
  /** added by the team (support, admin) */
  teamAdded: number;
  /** taken away by the team */
  teamRemoved: number;
  /** spent on WhatsApp messages */
  consumed: number;
  /** given back for messages that failed */
  refunded: number;
}

export interface FinanceOverviewRaw {
  month: string;
  today: string;
  thisMonth: IncomeTotals;
  lastMonth: IncomeTotals & { toDate: number };
  months: FinanceMonthRaw[];
  days: { day: string; total: number }[];
  whatsappUsdMonth: number;
  subscriptions: { pro: PlanSubscriptions; business: PlanSubscriptions };
  creditsSoldMonth: number;
  pastDue: { count: number; monthly: number };
  late: { count: number; monthly: number };
  cancellationsMonth: number;
  forecast: { count: number; amount: number; weeks: { count: number; amount: number }[] };
  atRisk: AtRiskRow[];
  credits: CreditsMonth[];
}

// ─── worked out ────────────────────────────────────────────────────────────────────────────────

/** To the agora. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** An amount that includes VAT (18%), split: what is left without VAT, and the VAT in it. */
export function splitVat(gross: number, rate = VAT_RATE): { net: number; vat: number } {
  const net = round2(gross / (1 + rate));
  return { net, vat: round2(gross - net) };
}

/** USD at the dollar rate (INVITES_USD_TO_ILS), in shekels to the agora. */
export const usdToIls = (usd: number, rate: number): number => round2(usd * rate);

/** The change from `before` to `now` as a fraction (0.12: 12% up); null when there was nothing before. */
export const change = (now: number, before: number): number | null =>
  before > 0 ? (now - before) / before : null;

export interface FinanceMonth extends FinanceMonthRaw {
  vat: number;
  /** income without VAT */
  net: number;
  whatsappIls: number;
  /** income without VAT, less WhatsApp's cost */
  profit: number;
  /** profit ÷ income without VAT (null: no income) */
  margin: number | null;
}

export function monthOf(row: FinanceMonthRaw, usdRate: number): FinanceMonth {
  const { net, vat } = splitVat(row.total);
  const whatsappIls = usdToIls(row.whatsappUsd, usdRate);
  const profit = round2(net - whatsappIls);
  return { ...row, vat, net, whatsappIls, profit, margin: net > 0 ? profit / net : null };
}

/** A month of credits with how the balance of everyone's credits moved in it. */
export interface CreditsMonthView extends CreditsMonth {
  /** in − out: bought + plans + team added + refunded − team removed − consumed */
  net: number;
}

export interface FinanceKpis {
  income: number;
  incomeNet: number;
  incomeVat: number;
  incomeLastMonth: number;
  /** last month up to the same point of the month */
  incomeLastMonthToDate: number;
  /** this month so far against last month so far (null: nothing last month) */
  incomeChange: number | null;
  mrr: number;
  mrrNet: number;
  subscriptions: number;
  /** income this month ÷ the accounts that paid this month (null: nobody paid) */
  arpu: number | null;
  payingCustomers: number;
  creditsSold: number;
  packsIncome: number;
  whatsappUsd: number;
  whatsappIls: number;
  /** income without VAT, less WhatsApp's cost */
  net: number;
  pastDue: number;
  pastDueMonthly: number;
  late: number;
  lateMonthly: number;
  cancellations: number;
}

export interface FinanceView {
  month: string;
  today: string;
  kpis: FinanceKpis;
  subscriptions: FinanceOverviewRaw['subscriptions'];
  months: FinanceMonth[];
  /** the 12 months added up */
  year: FinanceMonth;
  days: { day: string; total: number }[];
  forecast: FinanceOverviewRaw['forecast'];
  atRisk: AtRiskRow[];
  credits: CreditsMonthView[];
  usdRate: number;
}

/** The cash-flow screen's numbers from the database's sums, the dollar rate and VAT. */
export function financeView(raw: FinanceOverviewRaw, usdRate: number): FinanceView {
  const { net: incomeNet, vat: incomeVat } = splitVat(raw.thisMonth.total);
  const whatsappIls = usdToIls(raw.whatsappUsdMonth, usdRate);
  const { pro, business } = raw.subscriptions;
  const mrr = round2(pro.mrr + business.mrr);
  const months = raw.months.map((m) => monthOf(m, usdRate));
  const sum = (k: 'newPlans' | 'renewals' | 'packs' | 'total' | 'payments' | 'whatsappUsd') =>
    raw.months.reduce((a, m) => a + m[k], 0);
  const year = monthOf(
    {
      month: 'year',
      newPlans: round2(sum('newPlans')),
      renewals: round2(sum('renewals')),
      packs: round2(sum('packs')),
      total: round2(sum('total')),
      payments: sum('payments'),
      whatsappUsd: sum('whatsappUsd'),
    },
    usdRate,
  );
  return {
    month: raw.month,
    today: raw.today,
    kpis: {
      income: raw.thisMonth.total,
      incomeNet,
      incomeVat,
      incomeLastMonth: raw.lastMonth.total,
      incomeLastMonthToDate: raw.lastMonth.toDate,
      incomeChange: change(raw.thisMonth.total, raw.lastMonth.toDate),
      mrr,
      mrrNet: splitVat(mrr).net,
      subscriptions: pro.count + business.count,
      arpu: raw.thisMonth.customers > 0 ? round2(raw.thisMonth.total / raw.thisMonth.customers) : null,
      payingCustomers: raw.thisMonth.customers,
      creditsSold: raw.creditsSoldMonth,
      packsIncome: raw.thisMonth.packs,
      whatsappUsd: raw.whatsappUsdMonth,
      whatsappIls,
      net: round2(incomeNet - whatsappIls),
      pastDue: raw.pastDue.count,
      pastDueMonthly: raw.pastDue.monthly,
      late: raw.late.count,
      lateMonthly: raw.late.monthly,
      cancellations: raw.cancellationsMonth,
    },
    subscriptions: raw.subscriptions,
    months,
    year,
    days: raw.days,
    forecast: raw.forecast,
    atRisk: raw.atRisk,
    credits: raw.credits.map((c) => ({
      ...c,
      net: c.bought + c.plans + c.teamAdded + c.refunded - c.teamRemoved - c.consumed,
    })),
    usdRate,
  };
}

// ─── the payments ──────────────────────────────────────────────────────────────────────────────

export type PaymentKind = 'purchase' | 'renewal';
export type PaymentStatus = 'paid' | 'failed' | 'canceled' | 'pending';

export interface PaymentRow {
  /** the purchase's id, or the renewal's event id */
  id: string;
  kind: PaymentKind;
  at: string;
  userId: string | null;
  name: string | null;
  /** masked for roles without users.pii; null: the account is gone */
  email: string | null;
  product: Product | null;
  amount: number | null;
  status: PaymentStatus;
  provider: string;
  /** the provider's reference (a purchase's payment page, a renewal's event id) */
  ref: string | null;
}

export interface PaymentsPage {
  total: number;
  /** the paid ones among all that match, added up */
  paidSum: number;
  rows: PaymentRow[];
  providers: string[];
}

export const PAYMENTS_PAGE_SIZE = 50;

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const loose = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional()).catch(undefined);

/**
 * The payments' filters, from the page's address or the export's: what doesn't make sense is left out
 * (never an error). No status: everything but the purchases still open (a payment page left behind
 * stays open).
 */
export const PaymentFiltersSchema = z.object({
  kind: loose(z.enum(['purchase', 'renewal'])),
  status: loose(z.enum(['paid', 'failed', 'canceled', 'pending'])),
  product: loose(z.enum(PRODUCTS)),
  provider: loose(z.string().regex(/^[a-z0-9_-]{1,40}$/)),
  from: loose(z.iso.date()),
  to: loose(z.iso.date()),
  q: loose(z.string().trim().min(1).max(100)),
});
export type PaymentFilters = z.infer<typeof PaymentFiltersSchema>;

export function parsePaymentFilters(params: URLSearchParams): PaymentFilters {
  const raw = Object.fromEntries(
    ['kind', 'status', 'product', 'provider', 'from', 'to', 'q'].map((k) => [k, params.get(k) ?? undefined]),
  );
  const f = PaymentFiltersSchema.parse(raw);
  // a range the wrong way round: swapped
  if (f.from && f.to && f.from > f.to) return { ...f, from: f.to, to: f.from };
  return f;
}

/** The page asked for (1 by default). */
export const pageOf = (params: URLSearchParams): number => {
  const n = Number(params.get('page'));
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
};

/** The filters as an address's query (only the ones set). */
export function filtersQuery(f: PaymentFilters, extra: Record<string, string | number | undefined> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra }))
    if (v !== undefined && v !== '') q.set(k, String(v));
  return q.toString();
}

// ─── the spreadsheet ───────────────────────────────────────────────────────────────────────────

/**
 * A spreadsheet cell: quoted when needed, and never a formula — text starting with = + - @ (or a
 * tab/CR) gets a leading apostrophe (CSV injection, OWASP). Numbers stay numbers.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface PaymentsCsvLabels {
  headers: {
    date: string;
    kind: string;
    customer: string;
    email: string;
    product: string;
    amount: string;
    status: string;
    provider: string;
    ref: string;
  };
  kinds: Record<PaymentKind, string>;
  statuses: Record<PaymentStatus, string>;
  products: Record<Product, string>;
  deleted: string;
}

/** "2026-09-27 14:05" in Israel. */
export function israelDateTime(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/**
 * The payments for Excel: UTF-8 with a byte-order mark (Hebrew opens right), CRLF rows, the headers
 * and words in the console's language, dates in Israel, amounts in shekels with VAT.
 */
export function paymentsCsv(rows: readonly PaymentRow[], labels: PaymentsCsvLabels): string {
  const h = labels.headers;
  const header = [h.date, h.kind, h.customer, h.email, h.product, h.amount, h.status, h.provider, h.ref];
  const body = rows.map((r) => [
    israelDateTime(r.at),
    labels.kinds[r.kind],
    r.userId ? (r.name ?? '') : labels.deleted,
    r.email ?? '',
    r.product ? labels.products[r.product] : '',
    r.amount === null ? null : round2(r.amount),
    labels.statuses[r.status],
    r.provider,
    r.ref ?? '',
  ]);
  return '\uFEFF' + [header, ...body].map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** badook-payments-2026-09-27.csv (an ASCII name: browsers keep it). */
export const paymentsFileName = (now: number) =>
  `badook-payments-${israelDateTime(new Date(now).toISOString()).slice(0, 10)}.csv`;

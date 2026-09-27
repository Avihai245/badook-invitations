import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPayments, paymentsCsvLabels, type ExportDeps } from '@/features/admin/finance/api';
import {
  change,
  csvCell,
  filtersQuery,
  financeView,
  israelDateTime,
  monthOf,
  pageOf,
  parsePaymentFilters,
  paymentsCsv,
  paymentsFileName,
  splitVat,
  usdToIls,
  type FinanceOverviewRaw,
  type PaymentRow,
} from '@/features/admin/finance/model';

// The console's cash flow (features/admin/finance): VAT, WhatsApp in shekels, net, margin, MRR, ARPU
// and the change from last month worked out from the database's sums (the seeded month of
// tests/db/admin-money.test.ts); the payments' filters; the spreadsheet and its export; the overview's
// summary.

vi.mock('server-only', () => ({}));
const summary = vi.fn();
vi.mock('@/features/admin/finance/server', () => ({ financeDb: { summary: (a: string) => summary(a) } }));
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ INVITES_USD_TO_ILS: 3.7 }) }));

const { financeSummary } = await import('@/features/admin/server/summaries/finance');

const zeroMonth = (month: string) => ({
  month,
  newPlans: 0,
  renewals: 0,
  packs: 0,
  total: 0,
  payments: 0,
  whatsappUsd: 0,
});

/** admin_finance_overview's answer for the seeded month (15 Sep 2026). */
const RAW: FinanceOverviewRaw = {
  month: '2026-09',
  today: '2026-09-15',
  thisMonth: { newPlans: 88.2, renewals: 149, packs: 61.6, total: 298.8, payments: 5, customers: 4 },
  lastMonth: {
    newPlans: 149,
    renewals: 0,
    packs: 30.8,
    total: 179.8,
    toDate: 149,
    payments: 3,
    customers: 2,
  },
  months: [
    ...[
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ].map(zeroMonth),
    { ...zeroMonth('2026-07'), newPlans: 49, total: 49, payments: 1 },
    {
      month: '2026-08',
      newPlans: 149,
      renewals: 0,
      packs: 30.8,
      total: 179.8,
      payments: 3,
      whatsappUsd: 0.0353,
    },
    {
      month: '2026-09',
      newPlans: 88.2,
      renewals: 149,
      packs: 61.6,
      total: 298.8,
      payments: 5,
      whatsappUsd: 0.2471,
    },
  ],
  days: [{ day: '2026-09-15', total: 0 }],
  whatsappUsdMonth: 0.2471,
  subscriptions: {
    pro: { count: 3, mrr: 137.2, listPriced: 1 },
    business: { count: 1, mrr: 149, listPriced: 0 },
  },
  creditsSoldMonth: 400,
  pastDue: { count: 1, monthly: 49 },
  late: { count: 1, monthly: 49 },
  cancellationsMonth: 1,
  forecast: { count: 3, amount: 237.2, weeks: [] },
  atRisk: [],
  credits: [
    { month: '2026-09', bought: 400, plans: 400, teamAdded: 25, teamRemoved: 10, consumed: 7, refunded: 1 },
  ],
};

describe('the money worked out', () => {
  it('VAT out of an amount that includes it (18%), to the agora', () => {
    expect(splitVat(118)).toEqual({ net: 100, vat: 18 });
    expect(splitVat(298.8)).toEqual({ net: 253.22, vat: 45.58 });
    expect(splitVat(49)).toEqual({ net: 41.53, vat: 7.47 });
    expect(splitVat(39.2)).toEqual({ net: 33.22, vat: 5.98 });
    expect(splitVat(0)).toEqual({ net: 0, vat: 0 });
    // net + VAT is always the amount
    for (const n of [0.01, 15.4, 46.2, 149, 1234.56, 99999.99]) {
      const { net, vat } = splitVat(n);
      expect(Math.round((net + vat) * 100)).toBe(Math.round(n * 100));
    }
  });

  it('WhatsApp in shekels, the change from last month', () => {
    expect(usdToIls(0.2471, 3.7)).toBe(0.91);
    expect(usdToIls(35.3, 3.7)).toBe(130.61);
    expect(change(298.8, 149)).toBeCloseTo(1.00537, 5);
    expect(change(50, 100)).toBe(-0.5);
    expect(change(10, 0)).toBeNull();
  });

  it('a month: VAT, without VAT, WhatsApp, gross profit and margin', () => {
    expect(monthOf(RAW.months.at(-1)!, 3.7)).toEqual({
      ...RAW.months.at(-1),
      vat: 45.58,
      net: 253.22,
      whatsappIls: 0.91,
      profit: 252.31,
      margin: 252.31 / 253.22,
    });
    // no income: no margin
    expect(monthOf(zeroMonth('2026-01'), 3.7).margin).toBeNull();
  });

  it('the screen’s numbers from the seeded month', () => {
    const v = financeView(RAW, 3.7);
    expect(v.kpis).toEqual({
      income: 298.8,
      incomeNet: 253.22,
      incomeVat: 45.58,
      incomeLastMonth: 179.8,
      incomeLastMonthToDate: 149,
      incomeChange: (298.8 - 149) / 149,
      mrr: 286.2,
      mrrNet: 242.54,
      subscriptions: 4,
      arpu: 74.7,
      payingCustomers: 4,
      creditsSold: 400,
      packsIncome: 61.6,
      whatsappUsd: 0.2471,
      whatsappIls: 0.91,
      net: 252.31,
      pastDue: 1,
      pastDueMonthly: 49,
      late: 1,
      lateMonthly: 49,
      cancellations: 1,
    });
    // the 12 months added up
    expect(v.year).toMatchObject({
      month: 'year',
      newPlans: 286.2,
      renewals: 149,
      packs: 92.4,
      total: 527.6,
      payments: 9,
      vat: 80.48,
      net: 447.12,
      whatsappIls: 1.04,
      profit: 446.08,
    });
    expect(v.credits[0]!.net).toBe(400 + 400 + 25 + 1 - 10 - 7);
    // nobody paid: no ARPU
    expect(financeView({ ...RAW, thisMonth: { ...RAW.thisMonth, customers: 0 } }, 3.7).kpis.arpu).toBeNull();
  });
});

describe('the payments’ filters', () => {
  it('keep what makes sense, drop the rest, and swap a range the wrong way round', () => {
    expect(
      parsePaymentFilters(
        new URLSearchParams(
          'kind=renewal&status=bogus&product=credits_100&provider=PayPlus&from=2026-09-15&to=2026-09-01&q=%20dana%20',
        ),
      ),
    ).toEqual({
      kind: 'renewal',
      status: undefined,
      product: 'credits_100',
      provider: undefined,
      from: '2026-09-01',
      to: '2026-09-15',
      q: 'dana',
    });
    expect(
      parsePaymentFilters(new URLSearchParams('status=pending&provider=payplus&from=2026-13-40&q=')),
    ).toEqual({
      kind: undefined,
      status: 'pending',
      product: undefined,
      provider: 'payplus',
      from: undefined,
      to: undefined,
      q: undefined,
    });
    expect(pageOf(new URLSearchParams('page=3'))).toBe(3);
    for (const bad of ['page=0', 'page=-1', 'page=1.5', 'page=x', ''])
      expect(pageOf(new URLSearchParams(bad))).toBe(1);
    expect(filtersQuery({ status: 'paid', q: 'דנה' }, { page: 2 })).toBe(
      'status=paid&q=%D7%93%D7%A0%D7%94&page=2',
    );
  });
});

describe('the spreadsheet', () => {
  const rows: PaymentRow[] = [
    {
      id: 'k1',
      kind: 'purchase',
      at: '2026-08-31T21:30:00Z',
      userId: 'u1',
      name: 'רחל כהן',
      email: 'r***@example.com',
      product: 'credits_100',
      amount: 15.4,
      status: 'paid',
      provider: 'payplus',
      ref: 'page-d2',
    },
    {
      id: 'payplus:renew-b',
      kind: 'renewal',
      at: '2026-09-10T07:00:00Z',
      userId: 'u2',
      name: '=HYPERLINK("http://evil.example")',
      email: 'b-cust@example.com',
      product: 'business',
      amount: 149,
      status: 'failed',
      provider: 'payplus',
      ref: 'payplus:renew-b',
    },
    {
      id: 'k3',
      kind: 'purchase',
      at: '2026-01-05T08:00:00Z',
      userId: null,
      name: null,
      email: null,
      product: 'pro',
      amount: 39.2,
      status: 'canceled',
      provider: 'test',
      ref: null,
    },
  ];

  it('a cell is never a formula; numbers stay numbers', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+972501234567')).toBe("'+972501234567");
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(39.2)).toBe('39.2');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('Excel opens the Hebrew right: a BOM, Hebrew headers, Israel’s time, CRLF rows', () => {
    const csv = paymentsCsv(rows, paymentsCsvLabels('he'));
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toEqual([
      'תאריך,סוג,לקוח,מייל,מוצר,סכום (₪ כולל מע״מ),סטטוס,ספק,אסמכתה',
      // 21:30 UTC on 31 Aug is 00:30 on 1 Sep in Israel
      '2026-09-01 00:30,רכישה,רחל כהן,r***@example.com,100 הודעות,15.4,שולם,payplus,page-d2',
      `2026-09-10 10:00,חידוש,"'=HYPERLINK(""http://evil.example"")",b-cust@example.com,Business,149,נכשל,payplus,payplus:renew-b`,
      // winter: +02:00
      '2026-01-05 10:00,רכישה,חשבון שנמחק,,Pro,39.2,בוטל,test,',
      '',
    ]);
    expect(paymentsCsv([], paymentsCsvLabels('en')).slice(1).split('\r\n')[0]).toBe(
      'Date,Type,Customer,Email,Product,Amount (₪ incl. VAT),Status,Provider,Reference',
    );
    expect(israelDateTime('2026-10-25T00:30:00Z')).toBe('2026-10-25 02:30');
    expect(paymentsFileName(Date.parse('2026-09-30T22:30:00Z'))).toBe('badook-payments-2026-10-01.csv');
  });

  it('the export: finance.export only; the filters as on the page; the file in the console’s language', async () => {
    const deps: ExportDeps = {
      rows: vi.fn(async () => rows.slice(0, 1)),
      labels: paymentsCsvLabels,
      now: () => Date.parse('2026-09-15T09:00:00Z'),
    };
    for (const role of ['viewer', 'support'] as const)
      expect(await exportPayments({ userId: 'x', role }, new URLSearchParams(), 'he', deps)).toEqual({
        status: 403,
        code: 'forbidden',
      });
    expect(deps.rows).not.toHaveBeenCalled();
    const file = await exportPayments(
      { userId: 'staff-1', role: 'finance' },
      new URLSearchParams('status=paid&from=2026-09-01&to=2026-09-15&kind=nope'),
      'en',
      deps,
    );
    expect(deps.rows).toHaveBeenCalledWith('staff-1', {
      kind: undefined,
      status: 'paid',
      product: undefined,
      provider: undefined,
      from: '2026-09-01',
      to: '2026-09-15',
      q: undefined,
    });
    expect(file).toMatchObject({
      status: 200,
      filename: 'badook-payments-2026-09-15.csv',
      contentType: 'text/csv; charset=utf-8',
    });
    expect((file as { body: string }).body).toContain('2026-09-01 00:30,Purchase,רחל כהן');
  });
});

describe('the overview’s money', () => {
  const staff = (role: 'owner' | 'support') => ({
    userId: 'staff-1',
    email: 's@example.com',
    role,
    permissions: [],
  });
  beforeEach(() => summary.mockReset());

  it('this month and last, MRR, subscriptions and WhatsApp in shekels; null for a role without finance.view', async () => {
    summary.mockResolvedValue({
      revenueMonth: 298.8,
      revenuePrevMonth: 179.8,
      mrr: 286.2,
      activeSubscriptions: 4,
      whatsappUsdMonth: 0.2471,
    });
    expect(await financeSummary(staff('owner'))).toEqual({
      revenueMonth: 298.8,
      revenuePrevMonth: 179.8,
      mrr: 286.2,
      activeSubscriptions: 4,
      whatsappCostMonth: 0.91,
    });
    expect(await financeSummary(staff('support'))).toBeNull();
    expect(summary).toHaveBeenCalledTimes(1);
    // the numbers couldn't be read: none (logged), never the overview
    summary.mockRejectedValueOnce(new Error('database down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await financeSummary(staff('owner'))).toBeNull();
    log.mockRestore();
  });
});

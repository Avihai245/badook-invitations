'use client';

import {
  CalendarClock,
  Coins,
  Download,
  Filter,
  MessageCircle,
  Receipt,
  Repeat,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Field,
  Hint,
  Input,
  Segmented,
  Select,
  type BadgeVariant,
  type DataTableColumn,
} from '@/components/app';
import { PRODUCTS } from '@/features/billing/plans';
import { AdminPageHeader } from '../../ui/AdminShell.client';
import { useAdminUi } from '../../ui/AdminUi.client';
import {
  Definitions,
  KpiGrid,
  Pager,
  PersonCell,
  ScrollRegion,
  Section,
  SWITCH_CONTRAST,
  useReportFormat,
  type Tile,
} from '../../ui/charts/parts.client';
import { StackedColumns } from '../../ui/charts/StackedColumns.client';
import {
  filtersQuery,
  type AtRiskRow,
  type CreditsMonthView,
  type FinanceMonth,
  type PaymentFilters,
  type PaymentRow,
  type PaymentStatus,
} from '../model';
import type { FinancePageData } from '../server';

/** The income chart's one series (the dataviz method's slot 1, validated on this surface). */
const INCOME = '#2a78d6';

const STATUS_BADGE: Record<PaymentStatus, BadgeVariant> = {
  paid: 'live',
  failed: 'danger',
  canceled: 'neutral',
  pending: 'warning',
};

/**
 * The console's cash flow (/app/admin/finance, finance.view): this month's numbers, income per day,
 * the months, what renews and what is at risk, the credits economy and the payments (filtered in the
 * address, exported with finance.export). Refreshes by itself when a payment comes in.
 */
export function FinanceScreen({ data }: { data: FinancePageData }) {
  const { t, fmt } = useAdminUi();
  const F = t.finance;
  return (
    <div className="flex flex-col gap-6" data-testid="admin-finance">
      <AdminPageHeader title={F.title} intro={F.intro} />
      <Kpis data={data} />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DailyIncome data={data} />
        <Forecast data={data} />
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Subscriptions data={data} />
        <AtRisk data={data} />
      </div>
      <Monthly data={data} />
      <Credits data={data} />
      <Payments data={data} />
      <Definitions
        title={F.definitions.title}
        lines={F.definitions.lines.map((l) => fmt(l, { rate: String(data.view.usdRate) }))}
      />
    </div>
  );
}

// ─── this month ────────────────────────────────────────────────────────────────────────────────

function Kpis({ data }: { data: FinancePageData }) {
  const { t, fmt, plural, number } = useAdminUi();
  const f = useReportFormat();
  const F = t.finance.kpi;
  const k = data.view.kpis;
  const subs = data.view.subscriptions;
  const tiles: Tile[] = [
    {
      id: 'income',
      icon: <Wallet />,
      label: F.income,
      value: f.money(k.income),
      sub:
        k.incomeChange === null
          ? fmt(F.incomeSubFlat, { net: f.exact(k.incomeNet), last: f.exact(k.incomeLastMonthToDate) })
          : fmt(F.incomeSub, { net: f.exact(k.incomeNet), change: f.signedPct(k.incomeChange) }),
    },
    {
      id: 'mrr',
      icon: <Repeat />,
      label: F.mrr,
      value: f.money(k.mrr),
      sub: plural(F.mrrSub, k.subscriptions, {
        pro: number(subs.pro.count),
        business: number(subs.business.count),
      }),
    },
    {
      id: 'arpu',
      icon: <UserRound />,
      label: F.arpu,
      value: k.arpu === null ? '—' : f.money(k.arpu),
      sub: k.arpu === null ? F.arpuNone : plural(F.arpuSub, k.payingCustomers),
    },
    {
      id: 'net',
      icon: <TrendingUp />,
      label: F.net,
      value: f.money(k.net),
      sub: fmt(F.netSub, { cost: f.exact(k.whatsappIls) }),
    },
    {
      id: 'whatsapp',
      icon: <MessageCircle />,
      label: F.whatsapp,
      value: f.money(k.whatsappIls),
      sub: fmt(F.whatsappSub, { usd: f.usd(k.whatsappUsd), rate: number(data.view.usdRate) }),
    },
    {
      id: 'credits',
      icon: <Coins />,
      label: F.credits,
      value: f.count(k.creditsSold),
      sub: fmt(F.creditsSub, { amount: f.exact(k.packsIncome) }),
    },
    {
      id: 'past-due',
      icon: <TriangleAlert />,
      label: F.pastDue,
      value: f.count(k.pastDue),
      sub: fmt(F.pastDueSub, { amount: f.exact(k.pastDueMonthly), late: number(k.late) }),
    },
    {
      id: 'cancellations',
      icon: <CalendarClock />,
      label: F.cancellations,
      value: f.count(k.cancellations),
      sub: F.cancellationsSub,
    },
  ];
  return <KpiGrid tiles={tiles} label={t.finance.kpis} />;
}

// ─── income per day ────────────────────────────────────────────────────────────────────────────

function DailyIncome({ data }: { data: FinancePageData }) {
  const { t, fmt, number } = useAdminUi();
  const f = useReportFormat();
  const D = t.finance.daily;
  const [range, setRange] = useState<'30' | '90'>('30');
  const rows = data.view.days.slice(-Number(range));
  const sum = rows.reduce((a, r) => a + r.total, 0);
  return (
    <Section
      id="daily"
      title={D.title}
      intro={fmt(D.total, { total: f.exact(sum), days: number(rows.length) })}
      actions={
        <Segmented
          className={SWITCH_CONTRAST}
          label={D.range}
          value={range}
          onValueChange={setRange}
          options={[
            { value: '30', label: D.days30 },
            { value: '90', label: D.days90 },
          ]}
        />
      }
    >
      <StackedColumns
        testId="income-chart"
        rows={rows}
        series={[{ key: 'total', label: D.amount, color: INCOME }]}
        title={D.title}
        hint={D.hint}
        dayLabel={f.dayShort}
        dayLong={f.dayLong}
        format={f.exact}
        formatAxis={f.compactMoney}
        tableLabel={D.table}
        dayHeader={D.day}
      />
    </Section>
  );
}

// ─── what renews, what is at risk ──────────────────────────────────────────────────────────────

function Forecast({ data }: { data: FinancePageData }) {
  const { t, plural } = useAdminUi();
  const f = useReportFormat();
  const F = t.finance.forecast;
  const fc = data.view.forecast;
  const top = Math.max(1, ...fc.weeks.map((w) => w.amount));
  return (
    <Section id="forecast" title={F.title}>
      <div data-testid="forecast" className="flex flex-col gap-4">
        <div>
          <p className="text-[13px] text-muted">{F.renewals}</p>
          <p className="text-[28px] font-bold">{f.exact(fc.amount)}</p>
          <p className="text-[12.5px] text-muted">{plural(F.renewalsSub, fc.count)}</p>
        </div>
        <ul className="flex flex-col gap-2.5">
          {fc.weeks.map((w, i) => (
            <li key={i} className="flex flex-col gap-1 text-[13px]">
              <span className="flex items-center justify-between gap-3">
                <span className="text-muted">{F.weeks[i]}</span>
                <span className="tabular-nums">
                  {f.exact(w.amount)} <span className="text-muted">· {f.count(w.count)}</span>
                </span>
              </span>
              <span aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-subtle">
                <span
                  className="h-full rounded-full"
                  style={{ width: `${(w.amount / top) * 100}%`, background: INCOME }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function AtRisk({ data }: { data: FinancePageData }) {
  const { t, date } = useAdminUi();
  const f = useReportFormat();
  const F = t.finance.forecast;
  const k = data.view.kpis;
  return (
    <Section
      id="at-risk"
      title={F.atRisk}
      intro={
        <span className="tabular-nums">
          {F.pastDue}: {f.count(k.pastDue)} · {f.exact(k.pastDueMonthly)} — {F.late}: {f.count(k.late)} ·{' '}
          {f.exact(k.lateMonthly)}
        </span>
      }
    >
      {data.view.atRisk.length ? (
        <ul
          className="-my-2 flex max-h-[360px] flex-col divide-y divide-line overflow-y-auto"
          data-testid="at-risk"
        >
          {data.view.atRisk.map((r: AtRiskRow) => (
            <li key={r.userId} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <PersonCell
                userId={r.userId}
                name={r.name}
                email={r.email}
                fallback={t.common.unknown}
                openLabel={t.finance.payments.open}
              />
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <Badge variant={r.why === 'past_due' ? 'danger' : 'warning'}>
                  {r.why === 'past_due' ? F.pastDue : F.late}
                </Badge>
                <span className="text-[12px] text-muted tabular-nums">
                  {t.finance.plans[r.plan]} · {f.exact(r.monthly)}
                  {r.renewsAt ? ` · ${date(r.renewsAt)}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted" data-testid="at-risk">
          {F.atRiskNone}
        </p>
      )}
    </Section>
  );
}

// ─── the months ────────────────────────────────────────────────────────────────────────────────

function Monthly({ data }: { data: FinancePageData }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const M = t.finance.monthly;
  const rows = [...data.view.months].reverse().concat(data.view.year);
  const strong = (row: FinanceMonth, text: string) =>
    row.month === 'year' ? <strong className="font-bold">{text}</strong> : text;
  const money =
    (key: 'newPlans' | 'renewals' | 'packs' | 'total' | 'vat' | 'net' | 'whatsappIls' | 'profit') =>
    (row: FinanceMonth): ReactNode =>
      strong(row, f.exact(row[key]));
  const columns: DataTableColumn<FinanceMonth>[] = [
    {
      key: 'month',
      header: M.month,
      cell: (row) => (row.month === 'year' ? <strong>{M.year}</strong> : f.month(row.month)),
      className: 'whitespace-nowrap',
    },
    { key: 'newPlans', header: M.newPlans, numeric: true, cell: money('newPlans') },
    { key: 'renewals', header: M.renewals, numeric: true, cell: money('renewals') },
    { key: 'packs', header: M.packs, numeric: true, cell: money('packs') },
    { key: 'total', header: M.total, numeric: true, cell: money('total') },
    { key: 'vat', header: M.vat, numeric: true, cell: money('vat') },
    { key: 'net', header: M.net, numeric: true, cell: money('net') },
    { key: 'whatsappIls', header: M.whatsapp, numeric: true, cell: money('whatsappIls') },
    { key: 'profit', header: M.profit, numeric: true, cell: money('profit') },
    { key: 'margin', header: M.margin, numeric: true, cell: (row) => strong(row, f.pct(row.margin, 0)) },
  ];
  return (
    <Section id="monthly" title={M.title} intro={M.intro}>
      <ScrollRegion label={M.title} className="-mx-4 sm:mx-0">
        <DataTable
          caption={M.title}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.month}
          rowData={(row) => ({ 'data-month': row.month })}
        />
      </ScrollRegion>
    </Section>
  );
}

// ─── subscriptions and credits ─────────────────────────────────────────────────────────────────

function Subscriptions({ data }: { data: FinancePageData }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const S = t.finance.subscriptions;
  const subs = data.view.subscriptions;
  const rows = (['pro', 'business'] as const).map((plan) => ({ plan, ...subs[plan] }));
  return (
    <Section id="subscriptions" title={S.title}>
      <ScrollRegion label={S.title}>
        <DataTable
          caption={S.title}
          columns={[
            { key: 'plan', header: S.plan, cell: (r) => t.finance.plans[r.plan] },
            { key: 'count', header: S.count, numeric: true, cell: (r) => f.count(r.count) },
            { key: 'mrr', header: S.mrr, numeric: true, cell: (r) => f.exact(r.mrr) },
            {
              key: 'listPriced',
              header: (
                <Hint text={S.listPricedHelp}>
                  <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
                    {S.listPriced}
                  </span>
                </Hint>
              ),
              numeric: true,
              cell: (r) => f.count(r.listPriced),
            },
          ]}
          rows={rows}
          getRowKey={(r) => r.plan}
          rowData={(r) => ({ 'data-plan': r.plan })}
        />
      </ScrollRegion>
    </Section>
  );
}

function Credits({ data }: { data: FinancePageData }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const C = t.finance.credits;
  const signed = (n: number) => (n > 0 ? `+${f.count(n)}` : f.count(n));
  const columns: DataTableColumn<CreditsMonthView>[] = [
    { key: 'month', header: C.month, cell: (r) => f.month(r.month), className: 'whitespace-nowrap' },
    { key: 'bought', header: C.bought, numeric: true, cell: (r) => f.count(r.bought) },
    { key: 'plans', header: C.plans, numeric: true, cell: (r) => f.count(r.plans) },
    { key: 'teamAdded', header: C.teamAdded, numeric: true, cell: (r) => f.count(r.teamAdded) },
    { key: 'teamRemoved', header: C.teamRemoved, numeric: true, cell: (r) => f.count(r.teamRemoved) },
    { key: 'consumed', header: C.consumed, numeric: true, cell: (r) => f.count(r.consumed) },
    { key: 'refunded', header: C.refunded, numeric: true, cell: (r) => f.count(r.refunded) },
    { key: 'net', header: C.net, numeric: true, cell: (r) => <strong>{signed(r.net)}</strong> },
  ];
  return (
    <Section id="credits" title={C.title} intro={C.intro}>
      <ScrollRegion label={C.title} className="-mx-4 sm:mx-0">
        <DataTable
          caption={C.title}
          columns={columns}
          rows={[...data.view.credits].reverse()}
          getRowKey={(r) => r.month}
          rowData={(r) => ({ 'data-month': r.month })}
        />
      </ScrollRegion>
    </Section>
  );
}

// ─── the payments ──────────────────────────────────────────────────────────────────────────────

function Payments({ data }: { data: FinancePageData }) {
  const { t, fmt, plural, can } = useAdminUi();
  const f = useReportFormat();
  const P = t.finance.payments;
  const { payments, filters } = data;
  const pages = Math.max(1, Math.ceil(payments.total / payments.pageSize));
  const query = filtersQuery(filters);
  const canExport = can('finance.export');
  const exportButton = canExport ? (
    <Hint text={t.finance.export.help}>
      <Button asChild variant="secondary" size="sm" icon={<Download />}>
        <a
          href={`/api/admin/finance/export${query ? `?${query}` : ''}`}
          download
          data-testid="finance-export"
        >
          {t.finance.export.button}
        </a>
      </Button>
    </Hint>
  ) : (
    <Hint text={t.finance.export.help} disabledText={t.finance.export.denied}>
      <Button variant="secondary" size="sm" icon={<Download />} disabled data-testid="finance-export">
        {t.finance.export.button}
      </Button>
    </Hint>
  );
  return (
    <Section id="payments" title={P.title} intro={P.intro} actions={exportButton}>
      <PaymentFiltersForm key={query} filters={filters} providers={payments.providers} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <p className="text-muted tabular-nums" data-testid="payments-summary">
          {plural(P.summary, payments.total, { paid: f.exact(payments.paidSum) })}
        </p>
        {!can('users.pii') ? <p className="text-[12.5px] text-muted">{t.finance.masked}</p> : null}
      </div>
      <PaymentsList rows={payments.rows} />
      <Pager
        page={payments.page}
        pages={pages}
        href={(page) => `/app/admin/finance?${filtersQuery(filters, { page })}#payments`}
        label={fmt(P.page, { page: payments.page, pages })}
        previousHelp={t.common.previous}
        nextHelp={t.common.next}
      />
    </Section>
  );
}

function PaymentFiltersForm({ filters, providers }: { filters: PaymentFilters; providers: string[] }) {
  const { t, can } = useAdminUi();
  const F = t.finance.filters;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<PaymentFilters>(filters);
  const set = <K extends keyof PaymentFilters>(key: K, value: string) =>
    setDraft((d) => ({ ...d, [key]: value || undefined }));
  const go = (next: PaymentFilters) =>
    start(() => {
      const query = filtersQuery(next);
      router.push(`/app/admin/finance${query ? `?${query}` : ''}#payments`, { scroll: false });
    });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(draft);
  };
  const any = Object.values(filters).some((v) => v !== undefined);
  return (
    <form onSubmit={submit} aria-label={F.label} data-testid="payment-filters">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7">
        <Field label={F.kind}>
          <Select value={draft.kind ?? ''} onChange={(e) => set('kind', e.target.value)} name="kind">
            <option value="">{F.all}</option>
            <option value="purchase">{t.finance.kinds.purchase}</option>
            <option value="renewal">{t.finance.kinds.renewal}</option>
          </Select>
        </Field>
        <Field label={F.status}>
          <Select value={draft.status ?? ''} onChange={(e) => set('status', e.target.value)} name="status">
            <option value="">{F.allStatuses}</option>
            {(['paid', 'failed', 'canceled', 'pending'] as const).map((s) => (
              <option key={s} value={s}>
                {t.finance.statuses[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={F.product}>
          <Select value={draft.product ?? ''} onChange={(e) => set('product', e.target.value)} name="product">
            <option value="">{F.all}</option>
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {t.finance.products[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={F.provider}>
          <Select
            value={draft.provider ?? ''}
            onChange={(e) => set('provider', e.target.value)}
            name="provider"
          >
            <option value="">{F.all}</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={F.from}>
          <Input
            type="date"
            value={draft.from ?? ''}
            onChange={(e) => set('from', e.target.value)}
            name="from"
          />
        </Field>
        <Field label={F.to}>
          <Input type="date" value={draft.to ?? ''} onChange={(e) => set('to', e.target.value)} name="to" />
        </Field>
        <Field label={F.search} className="col-span-2 md:col-span-2 2xl:col-span-1">
          <Input
            type="search"
            value={draft.q ?? ''}
            onChange={(e) => set('q', e.target.value)}
            placeholder={can('users.pii') ? F.searchPlaceholderPii : F.searchPlaceholder}
            maxLength={100}
            name="q"
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Hint text={F.applyHelp}>
          <Button type="submit" size="md" icon={<Filter />} loading={pending}>
            {F.apply}
          </Button>
        </Hint>
        <Hint text={F.clearHelp}>
          <Button
            type="button"
            variant="ghost"
            size="md"
            icon={<X />}
            disabled={!any || pending}
            onClick={() => {
              setDraft({});
              go({});
            }}
          >
            {F.clear}
          </Button>
        </Hint>
      </div>
    </form>
  );
}

function PaymentsList({ rows }: { rows: PaymentRow[] }) {
  const { t, dateTime } = useAdminUi();
  const f = useReportFormat();
  const P = t.finance.payments;
  const product = (r: PaymentRow) => (r.product ? t.finance.products[r.product] : '—');
  const amount = (r: PaymentRow) => (r.amount === null ? '—' : f.exact(r.amount));
  const customer = (r: PaymentRow) => (
    <PersonCell
      userId={r.userId}
      name={r.name}
      email={r.email}
      fallback={t.common.unknown}
      missing={t.finance.deletedAccount}
      openLabel={P.open}
    />
  );
  const status = (r: PaymentRow) => (
    <Badge variant={STATUS_BADGE[r.status]}>{t.finance.statuses[r.status]}</Badge>
  );
  const empty = (
    <p className="flex flex-col items-center gap-2 px-3 py-8 text-center text-[13px] text-muted">
      <Receipt aria-hidden className="size-5" strokeWidth={1.75} />
      {P.empty}
    </p>
  );
  const columns: DataTableColumn<PaymentRow>[] = [
    { key: 'at', header: P.date, cell: (r) => dateTime(r.at), className: 'whitespace-nowrap tabular-nums' },
    { key: 'customer', header: P.customer, cell: customer, className: 'max-w-[260px]' },
    {
      key: 'product',
      header: P.product,
      cell: (r) => (
        <span className="whitespace-nowrap">
          {product(r)} <span className="text-muted">· {t.finance.kinds[r.kind]}</span>
        </span>
      ),
    },
    { key: 'amount', header: P.amount, numeric: true, cell: amount },
    { key: 'status', header: P.status, cell: status },
    { key: 'provider', header: P.provider, cell: (r) => r.provider },
  ];
  return (
    <div data-testid="payments" className="mt-3">
      <div className="hidden md:block">
        <DataTable
          caption={P.title}
          columns={columns}
          rows={rows}
          getRowKey={(r) => `${r.kind}:${r.id}`}
          rowData={(r) => ({ 'data-payment': r.id, 'data-status': r.status })}
          empty={empty}
        />
      </div>
      <ul className="flex flex-col divide-y divide-line md:hidden">
        {rows.length === 0 ? <li>{empty}</li> : null}
        {rows.map((r) => (
          <li
            key={`${r.kind}:${r.id}`}
            className="flex flex-col gap-1.5 py-3"
            data-payment={r.id}
            data-status={r.status}
          >
            <div className="flex items-start justify-between gap-3">
              {customer(r)}
              <span className="shrink-0 text-[15px] font-bold tabular-nums">{amount(r)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
              {status(r)}
              <span>
                {product(r)} · {t.finance.kinds[r.kind]}
              </span>
              <span className="tabular-nums">{dateTime(r.at)}</span>
              <span>{r.provider}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

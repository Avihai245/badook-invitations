'use client';

import { Activity, CreditCard, Search, UsersRound, Wallet, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Field,
  Hint,
  Input,
  KpiCard,
  type BadgeVariant,
  type DataTableColumn,
} from '@/components/app';
import { AdminPageHeader } from '../../ui/AdminShell.client';
import { useAdminUi } from '../../ui/AdminUi.client';
import { Definitions, Pager, PersonCell, Section, useReportFormat } from '../../ui/charts/parts.client';
import { StackedColumns } from '../../ui/charts/StackedColumns.client';
import type { ApiCall, Opener, PartnerAccountRow, PartnersRaw } from '../model';
import type { PartnersPageData } from '../server';

/**
 * The API's answers per day: answered (the dataviz method's slot 1), refused — 4xx (slot 4) — and failed
 * — 5xx (the status palette's critical); validated as adjacent pairs on this surface.
 */
const API_SERIES = { ok: '#2a78d6', refused: '#eda100', failed: '#d03b3b' } as const;

const PLAN_BADGE: Record<PartnerAccountRow['plan'], BadgeVariant> = {
  free: 'neutral',
  pro: 'info',
  business: 'live',
};

/**
 * The console's Badook Events area (/app/admin/partners, partners.view): the accounts it opened, who
 * there opened them, its venues, the accounts themselves (searched in the address) and its API's
 * health. Refreshes by itself when Badook Events opens or updates an account.
 */
export function PartnersScreen({ data }: { data: PartnersPageData }) {
  const { t } = useAdminUi();
  const P = t.partners;
  return (
    <div className="flex flex-col gap-6" data-testid="admin-partners">
      <AdminPageHeader title={P.title} intro={P.intro} />
      <Kpis overview={data.overview} />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Openers overview={data.overview} />
        <Venues overview={data.overview} />
      </div>
      <Accounts data={data} />
      <ApiHealth api={data.overview.api} />
      <Definitions title={P.definitions.title} lines={P.definitions.lines} />
    </div>
  );
}

function Kpis({ overview }: { overview: PartnersRaw }) {
  const { t, fmt } = useAdminUi();
  const f = useReportFormat();
  const K = t.partners.kpi;
  const a = overview.accounts;
  const tiles = [
    {
      id: 'total',
      icon: <UsersRound />,
      label: K.total,
      value: f.count(a.total),
      sub: fmt(K.totalSub, { n: f.count(a.last30) }),
    },
    { id: 'active', icon: <Activity />, label: K.active, value: f.count(a.active30), sub: K.activeSub },
    {
      id: 'paid',
      icon: <CreditCard />,
      label: K.paid,
      value: f.count(a.paid),
      sub: fmt(K.paidSub, { pct: f.pct(a.total ? a.paid / a.total : null, 0) }),
    },
    {
      id: 'revenue',
      icon: <Wallet />,
      label: K.revenue,
      value: f.money(a.revenue),
      sub: fmt(K.revenueSub, { amount: f.exact(a.revenueMonth) }),
    },
  ];
  return (
    <section aria-label={t.partners.title}>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.id} data-testid={`kpi-${tile.id}`} className="min-w-0">
            <KpiCard
              className="h-full"
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
              sub={tile.sub}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Ronit Cohen (manager)", with the venue-owner note when the call didn't say. */
function OpenerName({ opener }: { opener: Pick<Opener, 'id' | 'name' | 'role' | 'via'> }) {
  const { t } = useAdminUi();
  const O = t.partners.openers;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span className="font-medium">{opener.name ?? opener.id}</span>
      {opener.role ? <span className="text-muted">({opener.role})</span> : null}
      {opener.via === 'venue' ? (
        <Hint text={O.viaVenueHelp}>
          <span tabIndex={0} className="inline-flex">
            <Badge variant="neutral">{O.viaVenue}</Badge>
          </span>
        </Hint>
      ) : null}
    </span>
  );
}

function Openers({ overview }: { overview: PartnersRaw }) {
  const { t, fmt, plural, relative } = useAdminUi();
  const f = useReportFormat();
  const O = t.partners.openers;
  type Row = PartnersRaw['openers'][number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: 'user',
      header: O.user,
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <OpenerName opener={r} />
          <span className="text-[12px] text-muted">
            <bdi>{fmt(O.id, { id: r.id })}</bdi>
            {r.email ? (
              <>
                {' · '}
                <bdi dir="ltr">{r.email}</bdi>
              </>
            ) : null}
          </span>
        </span>
      ),
      className: 'min-w-[180px]',
    },
    { key: 'accounts', header: O.accounts, numeric: true, cell: (r) => f.count(r.accounts) },
    { key: 'paid', header: O.paid, numeric: true, cell: (r) => f.count(r.paid) },
    {
      key: 'venues',
      header: O.venues,
      cell: (r) => (r.venues.length ? r.venues.join(', ') : '—'),
      className: 'max-w-[200px] truncate',
    },
    {
      key: 'last',
      header: O.last,
      cell: (r) => <span suppressHydrationWarning>{relative(r.lastAt)}</span>,
      className: 'whitespace-nowrap',
    },
  ];
  return (
    <Section id="openers" title={O.title} intro={O.intro}>
      <div data-testid="openers">
        <DataTable
          className="-mx-4 sm:mx-0"
          caption={O.title}
          columns={columns}
          rows={overview.openers}
          getRowKey={(r) => r.id}
          rowData={(r) => ({ 'data-opener': r.id })}
          empty={<p className="px-3 py-6 text-center text-[13px] text-muted">{O.none}</p>}
        />
        {overview.accounts.unknownOpener > 0 ? (
          <p className="mt-3 text-[12.5px] text-muted" data-testid="unknown-openers">
            <Hint text={O.unknownHelp}>
              <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
                {plural(O.unknown, overview.accounts.unknownOpener)}
              </span>
            </Hint>
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function Venues({ overview }: { overview: PartnersRaw }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const V = t.partners.venues;
  type Row = PartnersRaw['venues'][number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      header: V.name,
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{r.name}</span>
          <span className="text-[12px] text-muted">
            <bdi>{r.id}</bdi>
            {r.address ? ` · ${r.address}` : ''}
          </span>
        </span>
      ),
      className: 'min-w-[160px]',
    },
    {
      key: 'floorPlan',
      header: V.floorPlan,
      cell: (r) => <Badge variant={r.floorPlan ? 'live' : 'neutral'}>{r.floorPlan ? V.yes : V.no}</Badge>,
    },
    { key: 'accounts', header: V.accounts, numeric: true, cell: (r) => f.count(r.accounts) },
    {
      key: 'owner',
      header: V.owner,
      cell: (r) =>
        r.owner ? (
          <span>
            {r.owner.name ?? r.owner.id}
            {r.owner.role ? <span className="text-muted"> ({r.owner.role})</span> : null}
          </span>
        ) : (
          '—'
        ),
    },
  ];
  return (
    <Section id="venues" title={V.title}>
      <div data-testid="venues">
        <DataTable
          className="-mx-4 sm:mx-0"
          caption={V.title}
          columns={columns}
          rows={overview.venues}
          getRowKey={(r) => r.id}
          rowData={(r) => ({ 'data-venue': r.id })}
          empty={<p className="px-3 py-6 text-center text-[13px] text-muted">{V.none}</p>}
        />
      </div>
    </Section>
  );
}

// ─── the accounts ──────────────────────────────────────────────────────────────────────────────

function Accounts({ data }: { data: PartnersPageData }) {
  const { t, fmt, plural, can } = useAdminUi();
  const A = t.partners.accounts;
  const { accounts } = data;
  const pages = Math.max(1, Math.ceil(accounts.total / accounts.pageSize));
  const link = (page: number) => {
    const q = new URLSearchParams();
    if (accounts.query) q.set('q', accounts.query);
    if (page > 1) q.set('page', String(page));
    const s = q.toString();
    return `/app/admin/partners${s ? `?${s}` : ''}#accounts`;
  };
  return (
    <Section id="accounts" title={A.title}>
      <AccountsSearch key={accounts.query} query={accounts.query} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <p className="text-muted tabular-nums" data-testid="accounts-summary">
          {plural(A.summary, accounts.total)}
        </p>
        {!can('users.pii') ? <p className="text-[12.5px] text-muted">{t.partners.masked}</p> : null}
      </div>
      <AccountsList rows={accounts.rows} />
      <Pager
        page={accounts.page}
        pages={pages}
        href={link}
        label={fmt(A.page, { page: accounts.page, pages })}
        previousHelp={t.common.previous}
        nextHelp={t.common.next}
      />
    </Section>
  );
}

function AccountsSearch({ query }: { query: string }) {
  const { t, can } = useAdminUi();
  const A = t.partners.accounts;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(query);
  const go = (q: string) =>
    start(() =>
      router.push(`/app/admin/partners${q ? `?q=${encodeURIComponent(q)}` : ''}#accounts`, { scroll: false }),
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(value.trim());
  };
  return (
    <form role="search" aria-label={A.search} onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <Field label={A.search} className="min-w-[220px] flex-1">
        <Input
          type="search"
          icon={<Search />}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={can('users.pii') ? A.searchPlaceholderPii : A.searchPlaceholder}
          maxLength={100}
          name="q"
        />
      </Field>
      <Hint text={A.searchHelp}>
        <Button type="submit" loading={pending} icon={<Search />}>
          {A.searchButton}
        </Button>
      </Hint>
      <Hint text={A.clearHelp}>
        <Button
          type="button"
          variant="ghost"
          icon={<X />}
          disabled={!query || pending}
          onClick={() => {
            setValue('');
            go('');
          }}
        >
          {A.clear}
        </Button>
      </Hint>
    </form>
  );
}

function AccountsList({ rows }: { rows: PartnerAccountRow[] }) {
  const { t, date } = useAdminUi();
  const f = useReportFormat();
  const A = t.partners.accounts;
  const person = (r: PartnerAccountRow) => (
    <span className="flex min-w-0 flex-col">
      <PersonCell userId={r.userId} name={r.name} email={r.email} fallback={A.noName} openLabel={A.open} />
      {r.externalId ? (
        <span className="text-[12px] text-muted">
          <bdi>{r.externalId}</bdi>
        </span>
      ) : null}
    </span>
  );
  const opener = (r: PartnerAccountRow) =>
    r.opener ? <OpenerName opener={r.opener} /> : <span className="text-muted">{A.unknownOpener}</span>;
  const plan = (r: PartnerAccountRow) => (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={r.paidPlan ? PLAN_BADGE[r.plan] : 'neutral'}>{t.partners.plans[r.plan]}</Badge>
      {r.userManaged ? (
        <Hint text={A.selfManagedHelp}>
          <span tabIndex={0} className="inline-flex">
            <Badge variant="draft">{A.selfManaged}</Badge>
          </span>
        </Hint>
      ) : null}
    </span>
  );
  const empty = <p className="px-3 py-8 text-center text-[13px] text-muted">{A.empty}</p>;
  const columns: DataTableColumn<PartnerAccountRow>[] = [
    { key: 'name', header: A.name, cell: person, className: 'max-w-[240px]' },
    { key: 'opened', header: A.opened, cell: (r) => date(r.openedAt), className: 'whitespace-nowrap' },
    { key: 'by', header: A.by, cell: opener },
    { key: 'venue', header: A.venue, cell: (r) => r.venue?.name ?? '—' },
    { key: 'plan', header: A.plan, cell: plan },
    { key: 'invitations', header: A.invitations, numeric: true, cell: (r) => f.count(r.invitations) },
    { key: 'revenue', header: A.revenue, numeric: true, cell: (r) => f.exact(r.revenue) },
  ];
  return (
    <div data-testid="partner-accounts" className="mt-3">
      <div className="hidden md:block">
        <DataTable
          caption={A.title}
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.userId}
          rowData={(r) => ({ 'data-account': r.userId })}
          empty={empty}
        />
      </div>
      <ul className="flex flex-col divide-y divide-line md:hidden">
        {rows.length === 0 ? <li>{empty}</li> : null}
        {rows.map((r) => (
          <li key={r.userId} className="flex flex-col gap-1.5 py-3" data-account={r.userId}>
            <div className="flex items-start justify-between gap-3">
              {person(r)}
              <span className="shrink-0 text-[14px] font-bold tabular-nums">{f.exact(r.revenue)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
              {plan(r)}
              <span>
                {A.by}: {r.opener ? (r.opener.name ?? r.opener.id) : A.unknownOpener}
              </span>
              {r.venue ? <span>· {r.venue.name}</span> : null}
              <span>· {date(r.openedAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── the API's health ──────────────────────────────────────────────────────────────────────────

function CallLine({ call, label }: { call: ApiCall; label: string }) {
  const { dateTime, relative } = useAdminUi();
  return (
    <p className="text-[13px]">
      <span className="font-semibold">{label}: </span>
      {/* (a relative time: the browser's clock may be a minute past the server's) */}
      <span className="tabular-nums" title={dateTime(call.at)} suppressHydrationWarning>
        {relative(call.at)}
      </span>{' '}
      ·{' '}
      <bdi dir="ltr" className="font-mono text-[12.5px]">
        {call.method} {call.endpoint} → {call.status}
        {call.code ? ` ${call.code}` : ''}
      </bdi>
    </p>
  );
}

function ApiHealth({ api }: { api: PartnersRaw['api'] }) {
  const { t, fmt } = useAdminUi();
  const f = useReportFormat();
  const A = t.partners.api;
  const tiles = [
    { id: 'calls', label: A.calls24, value: f.count(api.last24h.calls) },
    { id: 'refused', label: A.refused24, value: f.count(api.last24h.refused) },
    { id: 'failed', label: A.failed24, value: f.count(api.last24h.failed) },
    { id: 'avg', label: A.avg, value: fmt(A.ms, { n: f.count(api.last24h.avgMs) }) },
  ];
  return (
    <Section id="api" title={A.title} intro={A.intro}>
      <div data-testid="api-health" className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className="rounded-[12px] border border-line bg-canvas px-3 py-2.5"
              data-testid={`api-${tile.id}`}
            >
              <dt className="text-[12.5px] text-muted">{tile.label}</dt>
              <dd className="mt-0.5 text-[20px] font-bold tabular-nums">{tile.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1" data-testid="api-last">
          {api.lastCall ? (
            <CallLine call={api.lastCall} label={A.lastCall} />
          ) : (
            <p className="text-[13px] text-muted">{A.never}</p>
          )}
          {api.lastError ? (
            <CallLine call={api.lastError} label={A.lastError} />
          ) : api.lastCall ? (
            <p className="text-[13px] text-muted">{A.noErrors}</p>
          ) : null}
        </div>
        <div>
          <h3 className="mb-2 text-[14px] font-bold">{A.perDay}</h3>
          <StackedColumns
            testId="api-chart"
            rows={api.days}
            series={[
              { key: 'ok', label: A.ok, color: API_SERIES.ok },
              { key: 'refused', label: A.refused, color: API_SERIES.refused },
              { key: 'failed', label: A.failed, color: API_SERIES.failed },
            ]}
            title={A.perDay}
            hint={A.hint}
            dayLabel={f.dayShort}
            dayLong={f.dayLong}
            format={f.count}
            formatAxis={f.compactCount}
            tableLabel={A.table}
            dayHeader={A.day}
            totalLabel={t.common.total}
            height={160}
          />
        </div>
        {api.endpoints.length ? (
          <div>
            <h3 className="mb-2 text-[14px] font-bold">{A.endpoints}</h3>
            <DataTable
              className="-mx-4 sm:mx-0"
              caption={A.endpoints}
              columns={[
                {
                  key: 'endpoint',
                  header: A.endpoint,
                  cell: (r) => (
                    <bdi dir="ltr" className="font-mono text-[12.5px] whitespace-nowrap">
                      {r.method} {r.endpoint}
                    </bdi>
                  ),
                },
                { key: 'calls', header: A.calls, numeric: true, cell: (r) => f.count(r.calls) },
                { key: 'refused', header: A.refused, numeric: true, cell: (r) => f.count(r.refused) },
                { key: 'failed', header: A.failed, numeric: true, cell: (r) => f.count(r.failed) },
                {
                  key: 'avgMs',
                  header: A.avgMs,
                  numeric: true,
                  cell: (r) => fmt(A.ms, { n: f.count(r.avgMs) }),
                },
              ]}
              rows={api.endpoints}
              getRowKey={(r) => `${r.method} ${r.endpoint}`}
            />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

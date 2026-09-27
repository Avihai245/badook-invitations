'use client';

import { BellOff, CircleCheck, CircleX, Eye, Hourglass, MessageCircle, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, DataTable, Hint, KpiCard, Segmented, type DataTableColumn } from '@/components/app';
import { AdminPageHeader } from '../../ui/AdminShell.client';
import { useAdminUi } from '../../ui/AdminUi.client';
import { Definitions, PersonCell, Section, useReportFormat } from '../../ui/charts/parts.client';
import { StackedColumns } from '../../ui/charts/StackedColumns.client';
import {
  EMAIL_GROUPS,
  emailDays,
  emailTotals,
  WA_KINDS,
  waDays,
  waTotals,
  type EmailKindTotals,
  type QueueRow,
  type WaKind,
} from '../model';
import type { FailureRow, MessagesPageData } from '../server';

/**
 * The stack's colors, bottom to top: read, delivered, sent — one hue, light to dark (an ordinal ramp,
 * validated) — then failed (the status palette's critical) and waiting (the app's muted gray). Adjacent
 * pairs validated for color vision deficiencies on this surface.
 */
const WA_COLORS = {
  read: '#104281',
  delivered: '#3987e5',
  sent: '#86b6ef',
  failed: '#d03b3b',
  pending: '#78716c',
} as const;
/** The emails' five groups: the categorical slots 1–5 in their fixed order (validated). */
const EMAIL_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const;

/**
 * The console's messages area (/app/admin/messages, messages.view): WhatsApp's three kinds over 30 days
 * — per day, rates, cost — the queues now, the failures, the numbers that asked to stop, and the
 * emails. Refreshes by itself when messages go out.
 */
export function MessagesScreen({ data }: { data: MessagesPageData }) {
  const { t, fmt } = useAdminUi();
  const M = t.messages;
  return (
    <div className="flex flex-col gap-6" data-testid="admin-messages">
      <AdminPageHeader title={M.title} intro={`${M.intro} ${M.period}.`} />
      <Kpis data={data} />
      <Daily data={data} />
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <ByKind data={data} />
        <Queues queue={data.queue} />
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Errors data={data} />
        <Failures rows={data.failures} />
      </div>
      <Emails data={data} />
      <Definitions
        title={M.definitions.title}
        lines={M.definitions.lines.map((l) => fmt(l, { rate: String(data.usdRate) }))}
      />
    </div>
  );
}

function Kpis({ data }: { data: MessagesPageData }) {
  const { t, fmt, relative } = useAdminUi();
  const f = useReportFormat();
  const K = t.messages.kpi;
  const all = waTotals(data.totals);
  const kind = (k: WaKind) => f.count(waTotals(data.totals, k).total);
  const pending = data.queue.reduce((a, q) => a + q.queued + q.sending, 0);
  const oldest = data.queue
    .map((q) => q.oldestAt)
    .filter((v): v is string => !!v)
    .sort()[0];
  const usd30 = all.usd;
  const tiles = [
    {
      id: 'total',
      icon: <MessageCircle />,
      label: K.total,
      value: f.count(all.total),
      sub: fmt(K.totalSub, {
        invitation: kind('invitation'),
        table: kind('table'),
        gallery: kind('gallery'),
      }),
    },
    {
      id: 'delivered',
      icon: <CircleCheck />,
      label: K.delivered,
      value: f.pct(all.deliveredRate),
      sub: fmt(K.deliveredSub, {
        delivered: f.count(all.delivered),
        finished: f.count(all.sent + all.failed),
      }),
    },
    {
      id: 'read',
      icon: <Eye />,
      label: K.read,
      value: f.pct(all.readRate),
      sub: fmt(K.readSub, { read: f.count(all.read), delivered: f.count(all.delivered) }),
    },
    {
      id: 'failed',
      icon: <CircleX />,
      label: K.failed,
      value: f.count(all.failed),
      sub: fmt(K.failedSub, { rate: f.pct(all.failRate) }),
    },
    {
      id: 'queue',
      icon: <Hourglass />,
      label: K.queue,
      value: f.count(pending),
      sub: oldest ? fmt(K.queueOldest, { since: relative(oldest) }) : K.queueEmpty,
    },
    {
      id: 'cost',
      icon: <Wallet />,
      label: K.cost,
      value: f.exact(data.monthIls),
      sub: fmt(K.costSub, { usd: f.usd(data.monthUsd), cost30: f.exact(usd30 * data.usdRate) }),
    },
    {
      id: 'opt-outs',
      icon: <BellOff />,
      label: K.optOuts,
      value: f.count(data.optOuts.total),
      sub: fmt(K.optOutsSub, { n: f.count(data.optOuts.last30) }),
    },
  ];
  return (
    <section aria-label={t.messages.period}>
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

function Daily({ data }: { data: MessagesPageData }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const M = t.messages;
  const [kind, setKind] = useState<WaKind | 'all'>('all');
  const rows = waDays(data, kind);
  const S = M.statuses;
  return (
    <Section
      id="daily"
      title={M.daily.title}
      intro={M.period}
      actions={
        <Segmented
          label={M.kindsLabel}
          value={kind}
          onValueChange={setKind}
          options={(['all', ...WA_KINDS] as const).map((k) => ({ value: k, label: M.kinds[k] }))}
        />
      }
    >
      <StackedColumns
        testId="messages-chart"
        rows={rows}
        series={[
          { key: 'read', label: S.read, color: WA_COLORS.read },
          { key: 'delivered', label: S.delivered, color: WA_COLORS.delivered },
          { key: 'sent', label: S.sent, color: WA_COLORS.sent },
          { key: 'failed', label: S.failed, color: WA_COLORS.failed },
          { key: 'pending', label: S.pending, color: WA_COLORS.pending },
        ]}
        title={`${M.daily.title} · ${M.kinds[kind]}`}
        hint={M.chartHint}
        dayLabel={f.dayShort}
        dayLong={f.dayLong}
        format={f.count}
        formatAxis={f.compactCount}
        tableLabel={M.daily.table}
        dayHeader={M.daily.day}
        totalLabel={M.daily.total}
      />
    </Section>
  );
}

function ByKind({ data }: { data: MessagesPageData }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const B = t.messages.byKind;
  const rows = [...WA_KINDS, 'all' as const].map((kind) => ({ kind, ...waTotals(data.totals, kind) }));
  type Row = (typeof rows)[number];
  const bold = (r: Row, text: string) => (r.kind === 'all' ? <strong>{text}</strong> : text);
  const columns: DataTableColumn<Row>[] = [
    { key: 'kind', header: B.kind, cell: (r) => bold(r, t.messages.kinds[r.kind]) },
    { key: 'total', header: B.total, numeric: true, cell: (r) => bold(r, f.count(r.total)) },
    { key: 'delivered', header: B.delivered, numeric: true, cell: (r) => bold(r, f.pct(r.deliveredRate)) },
    { key: 'read', header: B.read, numeric: true, cell: (r) => bold(r, f.pct(r.readRate)) },
    { key: 'failed', header: B.failed, numeric: true, cell: (r) => bold(r, f.count(r.failed)) },
    { key: 'pending', header: B.pending, numeric: true, cell: (r) => bold(r, f.count(r.pending)) },
    { key: 'cost', header: B.cost, numeric: true, cell: (r) => bold(r, f.usd(r.usd)) },
  ];
  return (
    <Section id="by-kind" title={B.title} intro={t.messages.period}>
      <DataTable
        className="-mx-4 sm:mx-0"
        caption={B.title}
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.kind}
        rowData={(r) => ({ 'data-kind': r.kind })}
      />
    </Section>
  );
}

function Queues({ queue }: { queue: QueueRow[] }) {
  const { t, relative, dateTime } = useAdminUi();
  const f = useReportFormat();
  const Q = t.messages.queue;
  const columns: DataTableColumn<QueueRow>[] = [
    { key: 'kind', header: Q.kind, cell: (r) => t.messages.kinds[r.kind] },
    { key: 'queued', header: Q.queued, numeric: true, cell: (r) => f.count(r.queued) },
    { key: 'retrying', header: Q.retrying, numeric: true, cell: (r) => f.count(r.retrying) },
    { key: 'sending', header: Q.sending, numeric: true, cell: (r) => f.count(r.sending) },
    {
      key: 'stuck',
      header: (
        <Hint text={Q.stuckHelp}>
          <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
            {Q.stuck}
          </span>
        </Hint>
      ),
      numeric: true,
      cell: (r) => (r.stuck ? <Badge variant="danger">{f.count(r.stuck)}</Badge> : f.count(0)),
    },
    {
      key: 'oldest',
      header: Q.oldest,
      cell: (r) =>
        r.oldestAt ? (
          <span title={dateTime(r.oldestAt)} className="whitespace-nowrap">
            {relative(r.oldestAt)}
          </span>
        ) : (
          <span className="text-muted">{Q.empty}</span>
        ),
    },
  ];
  return (
    <Section id="queues" title={Q.title}>
      <div data-testid="queues">
        <DataTable
          className="-mx-4 sm:mx-0"
          caption={Q.title}
          columns={columns}
          rows={queue}
          getRowKey={(r) => r.kind}
          rowData={(r) => ({ 'data-kind': r.kind })}
        />
      </div>
    </Section>
  );
}

function Errors({ data }: { data: MessagesPageData }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const E = t.messages.errors;
  const top = Math.max(1, ...data.errors.map((e) => e.n));
  return (
    <Section id="errors" title={E.title} intro={E.intro}>
      {data.errors.length ? (
        <ul className="flex flex-col gap-3" data-testid="errors">
          {data.errors.map((e) => (
            <li key={e.error} className="flex flex-col gap-1 text-[13px]">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words">
                  {e.error ? <bdi>{e.error}</bdi> : <span className="text-muted">{E.noText}</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{f.count(e.n)}</span>
              </span>
              <span aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-subtle">
                <span className="h-full rounded-full bg-ink" style={{ width: `${(e.n / top) * 100}%` }} />
              </span>
              <span className="text-[12px] text-muted">
                {WA_KINDS.filter((k) => e[k] > 0)
                  .map((k) => `${t.messages.kinds[k]} ${f.count(e[k])}`)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">{E.none}</p>
      )}
    </Section>
  );
}

function Failures({ rows }: { rows: FailureRow[] }) {
  const { t, dateTime, can } = useAdminUi();
  const F = t.messages.failures;
  const invitation = (r: FailureRow) => (
    <Link
      href={`/app/admin/invitations/${r.invitationId}`}
      title={F.openInvitation}
      className="rounded-[4px] font-medium underline-offset-2 hover:underline"
    >
      <bdi>{r.title}</bdi>
    </Link>
  );
  const owner = (r: FailureRow) => (
    <PersonCell
      userId={r.ownerId}
      name={r.ownerName}
      email={r.ownerEmail}
      fallback={t.common.unknown}
      openLabel={F.openOwner}
    />
  );
  const error = (r: FailureRow) =>
    r.error ? (
      <bdi className="break-words">{r.error}</bdi>
    ) : (
      <span className="text-muted">{t.messages.errors.noText}</span>
    );
  const columns: DataTableColumn<FailureRow>[] = [
    { key: 'at', header: F.at, cell: (r) => dateTime(r.at), className: 'whitespace-nowrap tabular-nums' },
    { key: 'kind', header: F.kind, cell: (r) => <Badge variant="neutral">{t.messages.kinds[r.kind]}</Badge> },
    { key: 'invitation', header: F.invitation, cell: invitation, className: 'max-w-[180px] truncate' },
    { key: 'owner', header: F.owner, cell: owner, className: 'max-w-[200px]' },
    { key: 'error', header: F.error, cell: error, className: 'min-w-[160px]' },
  ];
  const empty = <p className="px-3 py-8 text-center text-[13px] text-muted">{F.none}</p>;
  return (
    <Section id="failures" title={F.title} intro={F.intro}>
      {!can('users.pii') ? <p className="mb-2 text-[12.5px] text-muted">{t.messages.masked}</p> : null}
      <div data-testid="failures">
        <div className="hidden md:block">
          <DataTable
            caption={F.title}
            columns={columns}
            rows={rows}
            getRowKey={(r) => `${r.kind}:${r.id}`}
            rowData={(r) => ({ 'data-failure': r.id })}
            empty={empty}
          />
        </div>
        <ul className="flex flex-col divide-y divide-line md:hidden">
          {rows.length === 0 ? <li>{empty}</li> : null}
          {rows.map((r) => (
            <li
              key={`${r.kind}:${r.id}`}
              className="flex flex-col gap-1.5 py-3 text-[13px]"
              data-failure={r.id}
            >
              <div className="flex items-start justify-between gap-3">
                {invitation(r)}
                <Badge variant="neutral">{t.messages.kinds[r.kind]}</Badge>
              </div>
              {owner(r)}
              <p className="text-danger">{error(r)}</p>
              <span className="text-[12px] text-muted tabular-nums">{dateTime(r.at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Emails({ data }: { data: MessagesPageData }) {
  const { t } = useAdminUi();
  const f = useReportFormat();
  const E = t.messages.emails;
  const rows = emailDays(data);
  const totals = emailTotals(data);
  const kindLabel = (kind: string) => (E.kinds as Record<string, string>)[kind] ?? kind;
  const columns: DataTableColumn<EmailKindTotals>[] = [
    { key: 'kind', header: E.kind, cell: (r) => kindLabel(r.kind) },
    { key: 'sent', header: E.sent, numeric: true, cell: (r) => f.count(r.sent) },
    {
      key: 'failed',
      header: E.failed,
      numeric: true,
      cell: (r) => (r.failed ? <Badge variant="danger">{f.count(r.failed)}</Badge> : f.count(0)),
    },
    {
      key: 'skipped',
      header: (
        <Hint text={E.skippedHelp}>
          <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
            {E.skipped}
          </span>
        </Hint>
      ),
      numeric: true,
      cell: (r) => f.count(r.skipped),
    },
  ];
  return (
    <Section id="emails" title={E.title} intro={E.intro}>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <StackedColumns
          testId="emails-chart"
          rows={rows}
          series={EMAIL_GROUPS.map((g, i) => ({ key: g, label: E.groups[g], color: EMAIL_COLORS[i]! }))}
          title={E.title}
          hint={t.messages.chartHint}
          dayLabel={f.dayShort}
          dayLong={f.dayLong}
          format={f.count}
          formatAxis={f.compactCount}
          tableLabel={E.table}
          dayHeader={t.messages.daily.day}
          totalLabel={t.messages.daily.total}
          height={170}
        />
        <div data-testid="emails-by-kind">
          <h3 className="mb-2 text-[14px] font-bold">{E.byKind}</h3>
          <DataTable
            caption={E.byKind}
            columns={columns}
            rows={totals}
            getRowKey={(r) => r.kind}
            rowData={(r) => ({ 'data-kind': r.kind })}
            empty={<p className="px-3 py-6 text-center text-[13px] text-muted">{E.none}</p>}
          />
        </div>
      </div>
    </Section>
  );
}

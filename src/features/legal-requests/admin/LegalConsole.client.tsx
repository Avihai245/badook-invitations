'use client';

import Link from 'next/link';
import { Badge, Card, EmptyState, cn } from '@/components/app';
import { AdminPageHeader } from '@/features/admin/ui/AdminShell.client';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import type { AdminReport, AdminRequest } from '../types';
import { ReportDetail } from './ReportDetail.client';
import { RequestDetail } from './RequestDetail.client';
import { legalHref, type AdminStrings } from './shared';

const OPEN_REPORT = ['new', 'in_review'];
const OPEN_REQUEST = ['new', 'verifying', 'in_progress'];

/**
 * /app/admin/legal: two tabs (content reports, privacy requests), the open / all filter, the list
 * (reports: urgent first; requests: by due date, the overdue ones marked) and the selected one beside
 * it (below it on a phone). The data comes from the server (the page's own refresh after each action).
 */
export function LegalConsole({
  s,
  tab,
  show,
  selected,
  reports,
  requests,
  report,
  request,
}: {
  s: AdminStrings;
  tab: 'reports' | 'requests';
  show: 'open' | 'all';
  selected: string | null;
  reports: AdminReport[];
  requests: AdminRequest[];
  report: AdminReport | null;
  request: AdminRequest | null;
}) {
  const { number } = useAdminUi();
  const openReports = reports.filter((r) => OPEN_REPORT.includes(r.status)).length;
  const openRequests = requests.filter((r) => OPEN_REQUEST.includes(r.status)).length;
  const hasDetail = selected !== null;
  return (
    <>
      <AdminPageHeader title={s.title} intro={s.intro} />
      <nav
        aria-label={s.tabs.label}
        className="flex gap-1 overflow-x-auto border-b border-line"
        data-testid="legal-tabs"
      >
        {(['reports', 'requests'] as const).map((id) => {
          const active = tab === id;
          const count = id === 'reports' ? openReports : openRequests;
          return (
            <Link
              key={id}
              href={legalHref({ tab: id, show })}
              aria-current={active ? 'page' : undefined}
              data-testid={`legal-tab-${id}`}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] whitespace-nowrap',
                active
                  ? 'border-brand font-semibold text-ink'
                  : 'border-transparent font-medium text-muted hover:text-ink',
              )}
            >
              {s.tabs[id]}
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-subtle px-1.5 text-[11.5px] font-bold text-ink tabular-nums">
                {number(count)}
              </span>
            </Link>
          );
        })}
      </nav>
      <nav aria-label={s.filter.label} className="mt-3 flex items-center gap-2 text-[13px]">
        <span className="text-muted">{s.filter.label}</span>
        {(['open', 'all'] as const).map((f) => (
          <Link
            key={f}
            href={legalHref({ tab, show: f })}
            aria-current={show === f ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1',
              show === f
                ? 'border-brand bg-brand-soft font-semibold'
                : 'border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {s.filter[f]}
          </Link>
        ))}
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className={cn(hasDetail && 'hidden lg:block')}>
          {tab === 'reports' ? (
            <ReportList s={s} show={show} items={reports} selected={selected} />
          ) : (
            <RequestList s={s} show={show} items={requests} selected={selected} />
          )}
        </div>
        <div className={cn('min-w-0', !hasDetail && 'hidden lg:block')}>
          {!hasDetail ? (
            <Card padding="lg">
              <p className="text-[14px] text-muted">{s.detail.empty}</p>
            </Card>
          ) : tab === 'reports' ? (
            report ? (
              <ReportDetail key={report.id} s={s} report={report} back={legalHref({ tab, show })} />
            ) : (
              <NotFound s={s} back={legalHref({ tab, show })} />
            )
          ) : request ? (
            <RequestDetail key={request.id} s={s} request={request} back={legalHref({ tab, show })} />
          ) : (
            <NotFound s={s} back={legalHref({ tab, show })} />
          )}
        </div>
      </div>
    </>
  );
}

function NotFound({ s, back }: { s: AdminStrings; back: string }) {
  return (
    <Card padding="lg">
      <p className="text-[14px]">{s.detail.notFound}</p>
      <Link href={back} className="mt-2 inline-block text-[14px] font-medium underline underline-offset-2">
        {s.detail.back}
      </Link>
    </Card>
  );
}

function ReportList({
  s,
  show,
  items,
  selected,
}: {
  s: AdminStrings;
  show: 'open' | 'all';
  items: AdminReport[];
  selected: string | null;
}) {
  const { fmt, relative } = useAdminUi();
  if (!items.length) return <EmptyState title={s.list.emptyReports} />;
  return (
    <ul aria-label={s.list.caption.reports} className="flex flex-col gap-2" data-testid="report-list">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={legalHref({ tab: 'reports', show, id: r.id })}
            aria-current={selected === r.id ? 'true' : undefined}
            className={cn(
              'block rounded-card border bg-surface p-3 text-[14px] hover:bg-subtle',
              selected === r.id ? 'border-brand' : 'border-line',
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tabular-nums">{fmt(s.list.reportRow, { n: r.number })}</span>
              {r.urgent ? <Badge variant="danger">{s.badges.urgent}</Badge> : null}
              <Badge variant={OPEN_REPORT.includes(r.status) ? 'warning' : 'neutral'}>
                {s.status.report[r.status]}
              </Badge>
            </span>
            <span className="mt-1 block text-muted">
              {s.category[r.category]} · {r.itemId ? s.surface[r.surface] : s.list.noItem}
            </span>
            <span className="mt-0.5 block text-[12px] text-muted">
              {fmt(s.list.created, { when: relative(r.createdAt) })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RequestList({
  s,
  show,
  items,
  selected,
}: {
  s: AdminStrings;
  show: 'open' | 'all';
  items: AdminRequest[];
  selected: string | null;
}) {
  const { fmt, date, relative } = useAdminUi();
  if (!items.length) return <EmptyState title={s.list.emptyRequests} />;
  return (
    <ul aria-label={s.list.caption.requests} className="flex flex-col gap-2" data-testid="request-list">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={legalHref({ tab: 'requests', show, id: r.id })}
            aria-current={selected === r.id ? 'true' : undefined}
            className={cn(
              'block rounded-card border bg-surface p-3 text-[14px] hover:bg-subtle',
              selected === r.id ? 'border-brand' : 'border-line',
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tabular-nums">{fmt(s.list.requestRow, { n: r.number })}</span>
              {r.overdue ? <Badge variant="danger">{s.badges.overdue}</Badge> : null}
              <Badge variant={OPEN_REQUEST.includes(r.status) ? 'warning' : 'neutral'}>
                {s.status.request[r.status]}
              </Badge>
            </span>
            <span className="mt-1 block text-muted">{s.kind[r.kind]}</span>
            <span className="mt-0.5 block text-[12px] text-muted">
              {fmt(s.list.created, { when: relative(r.createdAt) })}
              {OPEN_REQUEST.includes(r.status) ? ` · ${fmt(s.list.dueOn, { date: date(r.dueAt) })}` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

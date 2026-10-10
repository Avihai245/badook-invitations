'use client';

import { CalendarCheck2, Coins, LifeBuoy, Mail, MessageCircle, UserPlus, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, Segmented } from '@/components/app';
import type { ActivityItem } from '../../activity';
import type { Overview, Periods } from '../../server/core-db';
import type { FinanceSummary } from '../../server/summaries/finance';
import type { HostPathStep } from '../../server/summaries/host-path';
import type { SupportSummary } from '../../server/summaries/support';
import { AdminPageHeader } from '../AdminShell.client';
import { useAdminUi } from '../AdminUi.client';
import { DayChart } from '../core/DayChart.client';
import { Stat } from '../core/Stat.client';
import { TimeAgo } from '../core/TimeAgo.client';
import { Feed } from './Feed.client';

type Period = 'today' | 'd7' | 'd30';
const PERIODS: readonly Period[] = ['today', 'd7', 'd30'];
const STORE = 'admin:overview:period';
const before: Record<Period, keyof Periods> = { today: 'yesterday', d7: 'prev7', d30: 'prev30' };

/** A count in the chosen period, with the one before it for the change. */
const pick = (p: Periods, period: Period) => ({ now: p[period], before: p[before[period]] });

/**
 * The console's first screen — the business now: the numbers of the chosen period (today, 7 or 30
 * days, each against the period before), the last 30 days day by day, and what is happening, live.
 * Money and tickets come from their areas when the role may see them.
 */
export function OverviewScreen({
  data,
  feed,
  finance,
  support,
  path = null,
  denied,
}: {
  data: Overview;
  feed: ActivityItem[];
  finance: FinanceSummary | null;
  support: SupportSummary | null;
  /** the hosts' path over 30 days (features/analytics); null: not read */
  path?: HostPathStep[] | null;
  denied: boolean;
}) {
  const { t, fmt, number, money, dateTime } = useAdminUi();
  const o = t.overview;
  const [period, setPeriod] = useState<Period>('d7');
  // the period chosen last time (this browser only)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORE);
      if (saved && (PERIODS as readonly string[]).includes(saved)) setPeriod(saved as Period);
    } catch {
      // no storage here: the default
    }
  }, []);
  const choose = (p: Period) => {
    setPeriod(p);
    try {
      window.localStorage.setItem(STORE, p);
    } catch {
      // not kept
    }
  };

  const u = data.users;
  const inv = data.invitations;
  const wa = data.whatsapp;
  const rate = wa.delivery.settled > 0 ? wa.delivery.delivered / wa.delivery.settled : null;
  const queued = wa.queued.invitation + wa.queued.table + wa.queued.gallery;
  const series = (key: 'signups' | 'invitations' | 'rsvps' | 'messages') =>
    data.series.map((d) => ({ day: d.day, value: d[key] }));
  const total = (key: 'signups' | 'invitations' | 'rsvps' | 'messages') =>
    data.series.reduce((sum, d) => sum + d[key], 0);

  return (
    <>
      <AdminPageHeader
        title={o.title}
        intro={o.intro}
        actions={
          <p className="text-[12.5px] text-muted" data-testid="admin-overview-updated">
            {fmt(o.updated, { time: dateTime(data.now) })}
          </p>
        }
      />
      {denied ? (
        <p
          role="alert"
          data-testid="admin-denied"
          className="mb-5 rounded-[12px] border border-warning/40 bg-warning-bg px-4 py-3 text-[14px] text-ink"
        >
          {t.denied}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <section aria-labelledby="admin-kpis" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 id="admin-kpis" className="sr-only">
              {o.period.label}
            </h2>
            <Segmented
              label={o.period.label}
              value={period}
              onValueChange={choose}
              options={PERIODS.map((p) => ({ value: p, label: o.period[p] }))}
            />
            <p className="min-w-0 flex-1 basis-[240px] text-[12.5px] text-muted">{o.period.help}</p>
          </div>
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3"
            data-testid="admin-kpis"
            data-period={period}
          >
            <Stat
              testId="kpi-users"
              icon={<UserPlus />}
              label={o.kpi.users}
              value={number(u.new[period])}
              delta={pick(u.new, period)}
              vs={o.vs[period]}
              vsZero={o.vsZero[period]}
              sub={fmt(o.kpi.usersSub, { total: number(u.total), active: number(u.active7) })}
            >
              <p className="mt-2 text-[12px] text-muted">{o.kpi.sourcesLabel}</p>
              <ul className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
                {(['signup', 'google', 'partner'] as const).map((s) => (
                  <li key={s} className="rounded-full bg-subtle px-2 py-0.5 tabular-nums">
                    {o.kpi.source[s]} {number(u.bySource[s])}
                  </li>
                ))}
              </ul>
            </Stat>
            <Stat
              testId="kpi-invitations"
              icon={<Mail />}
              label={o.kpi.invitations}
              value={number(inv.created[period])}
              delta={pick(inv.created, period)}
              vs={o.vs[period]}
              vsZero={o.vsZero[period]}
              sub={fmt(o.kpi.invitationsSub, {
                published: number(inv.published[period]),
                live: number(inv.status.published),
              })}
            />
            <Stat
              testId="kpi-rsvps"
              icon={<CalendarCheck2 />}
              label={o.kpi.rsvps}
              value={number(data.rsvps.responses[period])}
              delta={pick(data.rsvps.responses, period)}
              vs={o.vs[period]}
              vsZero={o.vsZero[period]}
              sub={fmt(o.kpi.rsvpsSub, { people: number(data.rsvps.people[period]) })}
            />
            <Stat
              testId="kpi-whatsapp"
              icon={<MessageCircle />}
              label={o.kpi.whatsapp}
              value={number(wa.sent[period])}
              delta={pick(wa.sent, period)}
              vs={o.vs[period]}
              vsZero={o.vsZero[period]}
              sub={
                <>
                  {fmt(o.kpi.whatsappSub, {
                    rate:
                      rate === null
                        ? o.kpi.noRate
                        : number(rate, { style: 'percent', maximumFractionDigits: 0 }),
                    failed: number(wa.failed24h),
                    queued: number(queued),
                  })}
                  <br />
                  {fmt(o.kpi.whatsappKinds, {
                    invitation: number(wa.byKind.invitation),
                    table: number(wa.byKind.table),
                    gallery: number(wa.byKind.gallery),
                  })}
                </>
              }
            />
            <Stat
              testId="kpi-credits"
              icon={<Coins />}
              label={o.kpi.credits}
              value={number(data.credits.inSystem)}
              sub={fmt(o.kpi.creditsSub, {
                used: number(data.credits.usedMonth),
                bought: number(data.credits.boughtMonth),
                team: number(data.credits.teamMonth),
              })}
            />
            {finance ? (
              <Stat
                testId="kpi-money"
                icon={<Wallet />}
                label={o.kpi.money}
                value={money(finance.revenueMonth)}
                delta={{ now: finance.revenueMonth, before: finance.revenuePrevMonth }}
                format={(n) => money(n)}
                vs={fmt(o.kpi.moneyVs, { prev: money(finance.revenuePrevMonth) })}
                sub={fmt(o.kpi.moneySub, {
                  mrr: money(finance.mrr),
                  subs: number(finance.activeSubscriptions),
                  cost: money(finance.whatsappCostMonth),
                })}
              />
            ) : null}
            {support ? (
              <Stat
                testId="kpi-tickets"
                icon={<LifeBuoy />}
                label={o.kpi.tickets}
                value={number(support.open)}
                upIsBad
                sub={
                  <>
                    {fmt(o.kpi.ticketsSub, { waiting: number(support.waiting) })}
                    <br />
                    {support.oldestOpenAt ? (
                      <>
                        {fmt(o.kpi.ticketsOldest, { when: '' })}
                        <TimeAgo at={support.oldestOpenAt} />
                      </>
                    ) : (
                      o.kpi.ticketsNone
                    )}
                  </>
                }
              />
            ) : null}
          </div>
        </section>

        <aside aria-label={o.feed.title} className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <Feed items={feed} />
        </aside>

        <section aria-labelledby="admin-charts" className="min-w-0">
          <h2 id="admin-charts" className="text-[17px] font-bold">
            {o.charts.title}
          </h2>
          <p className="mt-0.5 mb-3 text-[13px] text-muted">{o.charts.intro}</p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {(
              [
                ['signups', o.charts.signups],
                ['invitations', o.charts.invitations],
                ['rsvps', o.charts.rsvps],
                ['messages', o.charts.messages],
              ] as const
            ).map(([key, title]) => (
              <Card key={key} padding="md" className="min-w-0">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-[14px] font-bold">{title}</h3>
                  <p className="text-[12.5px] text-muted tabular-nums">
                    {fmt(o.charts.total, { n: number(total(key)) })}
                  </p>
                </div>
                <DayChart points={series(key)} title={title} testId={`chart-${key}`} />
              </Card>
            ))}
          </div>
        </section>

        {path ? <HostPath steps={path} /> : null}
      </div>
    </>
  );
}

/**
 * Where new hosts stop (features/analytics): each step of the hosts' path over the last 30 days — how
 * many hosts took it, how often — with a bar against the most-taken step.
 */
function HostPath({ steps }: { steps: HostPathStep[] }) {
  const { t, number } = useAdminUi();
  const P = t.overview.path;
  const top = Math.max(1, ...steps.map((s) => s.hosts));
  return (
    <section aria-labelledby="admin-path" className="min-w-0" data-testid="admin-host-path">
      <h2 id="admin-path" className="text-[17px] font-bold">
        {P.title}
      </h2>
      <p className="mt-0.5 mb-3 text-[13px] text-muted">{P.intro}</p>
      <Card padding="md" className="min-w-0 overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-start text-[12px] text-muted">
              <th scope="col" className="pb-2 text-start font-semibold">
                {P.step}
              </th>
              <th scope="col" className="pb-2 text-end font-semibold">
                {P.hosts}
              </th>
              <th scope="col" className="pb-2 text-end font-semibold">
                {P.times}
              </th>
              <th scope="col" className="w-[40%] pb-2">
                <span className="sr-only">{P.bar}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.name} className="border-t border-line">
                <th scope="row" className="py-2 text-start font-medium">
                  {P.steps[s.name]}
                </th>
                <td className="py-2 text-end font-bold tabular-nums">{number(s.hosts)}</td>
                <td className="py-2 text-end text-muted tabular-nums">{number(s.times)}</td>
                <td className="py-2 ps-4">
                  <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-subtle">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${(s.hosts / top) * 100}%` }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

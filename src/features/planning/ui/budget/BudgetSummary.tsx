'use client';

import { Banknote, CircleCheck, Handshake, Receipt, Users, Wallet } from 'lucide-react';
import { Card, KpiCard } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { shekels } from '../../model/budget';
import { totalOver } from '../../model/budget-view';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { Fill } from './Fill';

/** The size of a KPI's number: two cards fit across a phone with amounts of seven digits. */
const BIG = 'text-[22px] sm:text-[30px]';

/** The four numbers — planned, committed, paid, left — with one meter, the cost per guest, and (only when the total is exceeded) a quiet note. */
export function BudgetSummary() {
  const { t, plural, number, fmt, locale } = useUi();
  const T = t.planning.budget;
  const { view } = usePlan();
  const totals = view.totals;
  const total = totals.totalBudget;
  const vat = view.settings?.vatMode ?? 'included';
  const pct = view.settings?.vatPct ?? 18;
  const over = totalOver(totals.committed, total);

  // the meter: paid | committed and not yet paid | the rest, of the total (else of what is planned)
  const whole = Math.max(total ?? totals.planned, totals.committed, 1);
  const paid = Math.min(totals.paid, totals.committed);
  const share = (n: number) => `${Math.max(0, Math.min(100, (n / whole) * 100))}%`;
  const meter = total === null ? T.meter.summaryNoTotal : T.meter.summary;
  const meterText = (
    <Fill
      text={meter}
      vars={{
        paid: <Money value={totals.paid} />,
        committed: <Money value={totals.committed} />,
        total: <Money value={total ?? 0} />,
      }}
    />
  );
  const meterLabel = fmt(meter, {
    paid: shekels(totals.paid, locale),
    committed: shekels(totals.committed, locale),
    total: shekels(total ?? 0, locale),
  });

  return (
    <section aria-label={T.kpi.label} className="flex flex-col gap-3" data-testid="budget-summary">
      {over > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-btn bg-warning-bg px-3.5 py-2.5 text-[13.5px] text-warning"
          data-testid="budget-over"
        >
          <Wallet aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <Fill text={T.over.total} vars={{ amount: <Money value={over} className="font-semibold" /> }} />
          </span>
        </p>
      ) : null}
      <div
        className={
          totals.perGuest !== null
            ? 'grid grid-cols-2 gap-3 lg:grid-cols-5'
            : 'grid grid-cols-2 gap-3 lg:grid-cols-4'
        }
      >
        <KpiCard
          icon={<Banknote />}
          label={T.kpi.planned}
          value={<Money className={BIG} value={totals.planned} />}
          sub={
            total === null ? (
              T.kpiSub.plannedNoTotal
            ) : (
              <Fill text={T.kpiSub.planned} vars={{ total: <Money value={total} /> }} />
            )
          }
        />
        <KpiCard
          icon={<Handshake />}
          label={T.kpi.committed}
          value={<Money className={BIG} value={totals.committed} />}
          sub={T.kpiSub.committed}
        />
        <KpiCard
          icon={<CircleCheck />}
          label={T.kpi.paid}
          value={<Money className={BIG} value={totals.paid} />}
          sub={
            totals.unpaid > 0 ? (
              <Fill text={T.kpiSub.paidLeft} vars={{ amount: <Money value={totals.unpaid} /> }} />
            ) : (
              T.kpiSub.paidNone
            )
          }
        />
        <KpiCard
          icon={<Receipt />}
          label={T.kpi.remaining}
          value={totals.remaining === null ? '—' : <Money className={BIG} value={totals.remaining} />}
          sub={totals.remaining === null ? T.kpiSub.remainingNone : T.kpiSub.remaining}
        />
        {totals.perGuest !== null ? (
          <KpiCard
            className="col-span-2 lg:col-span-1"
            icon={<Users />}
            label={T.kpi.perGuest}
            value={<Money className={BIG} value={totals.perGuest} />}
            sub={plural(T.guests.guestsN, view.headcount.guests, { n: number(view.headcount.guests) })}
          />
        ) : null}
      </div>
      <Card padding="md">
        <div
          role="img"
          aria-label={meterLabel}
          className="flex h-3 overflow-hidden rounded-full bg-subtle"
          data-testid="budget-meter"
        >
          <span
            className="h-full bg-success transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: share(paid) }}
          />
          <span
            className="h-full bg-chart-1 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: share(totals.committed - paid) }}
          />
        </div>
        <p className="mt-2.5 text-[13px] text-ink/80">{meterText}</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-success" />
            {T.meter.paid}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1" />
            {T.meter.committed}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px] bg-subtle ring-1 ring-line-strong" />
            {T.meter.rest}
          </li>
        </ul>
        <p className="mt-2 text-[12px] text-muted">
          <Fill text={T.vat.note[vat]} vars={{ pct: <bdi dir="ltr">{pct}%</bdi> }} />
        </p>
      </Card>
    </section>
  );
}

/** The summary of an event that is over: the final spend, what was paid, what is still unpaid. No warnings. */
export function PastSummary() {
  const { t, plural, number } = useUi();
  const T = t.planning.budget;
  const { view } = usePlan();
  const totals = view.totals;
  return (
    <section aria-label={T.past.title} className="flex flex-col gap-3" data-testid="budget-past">
      <div>
        <h2 className="text-[16px] font-bold">{T.past.title}</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">{T.past.body}</p>
      </div>
      <div
        className={
          totals.perGuest !== null
            ? 'grid grid-cols-2 gap-3 lg:grid-cols-4'
            : 'grid grid-cols-2 gap-3 lg:grid-cols-3'
        }
      >
        <KpiCard
          icon={<Handshake />}
          label={T.past.spent}
          value={<Money className={BIG} value={totals.committed} />}
        />
        <KpiCard
          icon={<CircleCheck />}
          label={T.kpi.paid}
          value={<Money className={BIG} value={totals.paid} />}
        />
        <KpiCard
          icon={<Receipt />}
          label={T.past.unpaid}
          value={<Money className={BIG} value={totals.unpaid} />}
          className={totals.perGuest !== null ? '' : 'col-span-2 lg:col-span-1'}
        />
        {totals.perGuest !== null ? (
          <KpiCard
            icon={<Users />}
            label={T.kpi.perGuest}
            value={<Money className={BIG} value={totals.perGuest} />}
            sub={plural(T.guests.guestsN, view.headcount.guests, { n: number(view.headcount.guests) })}
          />
        ) : null}
      </div>
    </section>
  );
}

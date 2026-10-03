'use client';

import { CalendarClock, ChartColumn, Check, Handshake, Receipt, Table2, Users, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button, Card, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { categoryOver, categoryRows, paymentRows, totalOver } from '../../model/budget-view';
import { daysBetween } from '../../model/schedule';
import { BudgetGauge, MiniGauge } from '../BudgetGauge';
import { dueText, toneClass } from '../format';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { Fill } from './Fill';
import { useBudget } from './useBudget';

/**
 * The budget's top (UX report §4.5): the speedometer, big, beside the four numbers — the budget, what is
 * committed, what is paid, what is left — and the cost per guest with the guest number it is counted by.
 */
export function BudgetHero() {
  const { t, plural, number } = useUi();
  const T = t.planning.budget;
  const H = T.hero;
  const { view } = usePlan();
  const totals = view.totals;
  const total = totals.totalBudget!;
  const left = totals.remaining ?? total - totals.committed;
  const over = totalOver(totals.committed, total);
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
      <Card padding="none" className="overflow-hidden" data-testid="budget-hero">
        <div className="grid grid-cols-1 items-center gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="flex min-w-0 justify-center">
            <BudgetGauge
              size="lg"
              total={total}
              committed={totals.committed}
              paid={totals.paid}
              planned={totals.planned}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-[13px] font-bold tracking-wide text-muted uppercase">{H.title}</h2>
            <dl className="grid grid-cols-2 gap-3">
              <Stat icon={<Wallet />} label={H.budget} value={<Money value={total} />} strong />
              <Stat icon={<Handshake />} label={H.committed} value={<Money value={totals.committed} />} />
              <Stat
                icon={<Check />}
                label={H.paid}
                value={<Money value={totals.paid} />}
                sub={
                  totals.unpaid > 0 ? (
                    <Fill text={T.kpiSub.paidLeft} vars={{ amount: <Money value={totals.unpaid} /> }} />
                  ) : undefined
                }
              />
              <Stat
                icon={<Receipt />}
                label={left < 0 ? H.overLeft : H.left}
                value={<Money value={Math.abs(left)} />}
                tone={left < 0 ? 'danger' : 'success'}
              />
            </dl>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[14px] bg-subtle px-4 py-3 text-[13px]">
              <span className="flex items-center gap-2">
                <Users aria-hidden className="size-4 text-muted" />
                <span className="text-muted">{H.perGuest}</span>
                <span className="font-bold">
                  {totals.perGuest !== null ? <Money value={Math.round(totals.perGuest)} /> : '—'}
                </span>
                <span className="text-muted">
                  {plural(H.guests, view.headcount.guests, { n: number(view.headcount.guests) })}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted">{H.planned}</span>
                <span className="font-bold">
                  <Money value={totals.planned} />
                </span>
              </span>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  strong = false,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  strong?: boolean;
  tone?: 'success' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-line p-3.5',
        strong && 'border-brand-line bg-brand-soft/50',
      )}
    >
      <dt className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted [&_svg]:size-4">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 text-[20px] font-extrabold sm:text-[26px]',
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : '',
        )}
      >
        {value}
      </dd>
      {sub ? <dd className="mt-0.5 text-[12px] text-muted">{sub}</dd> : null}
    </div>
  );
}

/**
 * Every category as a small gauge — what is closed against what is planned — the furthest over first; a
 * tap opens the category below.
 */
export function CategoryGauges({ onOpen }: { onOpen: (categoryId: string) => void }) {
  const { t, fmt, number } = useUi();
  const T = t.planning.budget;
  const C = T.catGauges;
  const { view } = usePlan();
  const rows = categoryRows(view)
    .map((r) => {
      const name = r.category.name ?? (r.category.key ? t.planning.categories[r.category.key] : '');
      const ratio =
        r.totals.planned > 0 ? r.totals.committed / r.totals.planned : r.totals.committed > 0 ? 1.3 : 0;
      return { r, name, ratio, over: categoryOver(r.totals) };
    })
    .sort((a, b) => b.over - a.over || b.ratio - a.ratio || b.r.totals.planned - a.r.totals.planned);
  const [table, setTable] = useState(false);
  if (!rows.length) return null;
  const Ch = T.chart;
  const metrics = ['planned', 'committed', 'paid'] as const;
  return (
    <section
      aria-labelledby="budget-cat-gauges"
      className="flex flex-col gap-3"
      data-testid="budget-cat-gauges"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="budget-cat-gauges" className="text-[16px] font-bold">
            {C.title}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{C.body}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={table ? <ChartColumn /> : <Table2 />}
          onClick={() => setTable((x) => !x)}
          aria-pressed={table}
        >
          {table ? Ch.showChart : Ch.showTable}
        </Button>
      </div>
      {table ? (
        <div className="overflow-auto rounded-card border border-line bg-surface">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{Ch.table}</caption>
            <thead className="bg-subtle">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">
                  {Ch.category}
                </th>
                {metrics.map((m) => (
                  <th key={m} scope="col" className="px-3 py-2 text-end font-semibold">
                    {T.kpi[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, name }) => (
                <tr key={r.category.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-1.5 text-start font-normal">
                    {name}
                  </th>
                  {metrics.map((m) => (
                    <td key={m} className="px-3 py-1.5 text-end">
                      <Money value={r.totals[m]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map(({ r, name, ratio, over }) => (
            <li key={r.category.id}>
              <button
                type="button"
                onClick={() => onOpen(r.category.id)}
                aria-label={fmt(C.open, { name })}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[16px] border bg-surface p-3.5 text-start shadow-xs transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  over > 0 ? 'border-danger-line' : 'border-line',
                )}
              >
                <MiniGauge
                  ratio={ratio}
                  label={fmt(C.meter, { name, percent: `${number(Math.round(ratio * 100))}%` })}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{name}</span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    {r.totals.committed > 0 ? (
                      <Fill
                        text={C.of}
                        vars={{
                          committed: <Money value={r.totals.committed} />,
                          planned: <Money value={r.totals.planned} />,
                        }}
                      />
                    ) : (
                      <>
                        {C.nothing} · <Money value={r.totals.planned} />
                      </>
                    )}
                  </span>
                  {over > 0 ? (
                    <span className="mt-0.5 block text-[12.5px] font-semibold text-danger">
                      <Fill text={C.over} vars={{ amount: <Money value={over} /> }} />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The payments of the next 30 days (and any overdue) as a timeline, each one a tap from paid. */
export function UpcomingPayments({
  onAll,
  onOpenItem,
}: {
  onAll: () => void;
  onOpenItem: (itemId: string) => void;
}) {
  const ui = useUi();
  const { t } = ui;
  const U = t.planning.budget.upcoming;
  const { view } = usePlan();
  const { markPaid } = useBudget();
  const rows = paymentRows(view).filter(
    (r) =>
      r.payment.paidAt === null &&
      r.payment.dueDate !== null &&
      daysBetween(view.today, r.payment.dueDate) <= 30,
  );
  const total = Math.round(rows.reduce((n, r) => n + r.payment.amount, 0) * 100) / 100;
  return (
    <Card padding="lg" data-testid="budget-upcoming">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-bold">
            <CalendarClock aria-hidden className="size-[18px] text-brand-deep" />
            {U.title}
          </h2>
          <p className="text-[12.5px] text-muted">{U.sub}</p>
        </div>
        {rows.length ? (
          <p className="text-[13px] font-semibold">
            <Fill text={U.total} vars={{ amount: <Money value={total} /> }} />
          </p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-btn bg-subtle px-3.5 py-3 text-[13.5px] text-muted">{U.none}</p>
      ) : (
        <ol className="relative mt-4 flex flex-col gap-3 border-s-2 border-line ps-5">
          {rows.slice(0, 8).map((r) => {
            const due = dueText(ui, view.today, r.payment.dueDate);
            return (
              <li key={r.payment.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1.5 -start-[27px] size-3 rounded-full ring-4 ring-surface',
                    due.tone === 'overdue' ? 'bg-danger' : due.tone === 'today' ? 'bg-warning' : 'bg-brand',
                  )}
                />
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => onOpenItem(r.item.id)}
                    className="min-w-0 text-start hover:underline"
                  >
                    <span className="block text-[14px] font-semibold">
                      <bdi>{r.item.title}</bdi>
                      <span className="text-muted"> · {r.payment.label}</span>
                    </span>
                    <span className={cn('block text-[12.5px] font-medium', toneClass[due.tone])}>
                      {due.text}
                    </span>
                  </button>
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-bold">
                      <Money value={r.payment.amount} />
                    </span>
                    <button
                      type="button"
                      onClick={() => void markPaid(r.payment, true)}
                      className="rounded-btn px-2 py-1 text-[12.5px] font-semibold text-brand-deep hover:bg-brand-soft"
                    >
                      {U.markPaid}
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button
        type="button"
        onClick={onAll}
        className="mt-4 rounded-btn text-[13px] font-semibold text-brand-deep hover:underline"
      >
        {U.all}
      </button>
    </Card>
  );
}

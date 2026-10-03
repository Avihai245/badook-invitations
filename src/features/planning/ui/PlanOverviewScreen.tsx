'use client';

import { ArrowLeft, Check, ClipboardCheck, ListChecks, Plus, Store, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button, Card, CardTitle, cn, KpiCard } from '@/components/app';
import { CountdownChip } from '@/features/invitations/app/countdown';
import { useUi } from '@/lib/i18n/client';
import { percentOf } from '../model/budget';
import { systemText } from '../model/system-text';
import { SYSTEM_HREF } from '../model/system-tasks';
import { taskNotes, taskTitle } from '../model/task-text';
import { daysBetween } from '../model/schedule';
import { dueWithin, isDone, nextTask } from '../model/week';
import type { PlanPayment, TaskView } from '../model/plan';
import { dueText, toneClass } from './format';
import { Money } from './Money';
import { isPast, PlanFrame, ToolHelp } from './PlanFrame';
import { usePlan } from './PlanProvider';
import { useTaskActions } from './tasks/useTaskActions';
import { useToast } from '@/components/app';

/**
 * The planning overview: the one thing to do next, this week's tasks and payments, the budget as four
 * numbers and one meter, how many vendors are booked and what is still missing, and the countdown. After
 * the event it turns into a summary (what was spent, what was paid, how the vendors were).
 */
export function PlanOverviewScreen() {
  const { t } = useUi();
  const P = t.planning;
  const plan = usePlan();
  const { view } = plan;
  const past = isPast(view);
  const help = (
    <ToolHelp
      title={P.help.title}
      items={[
        {
          icon: <ArrowLeft className="icon-dir" />,
          label: P.help.items.next.label,
          text: P.help.items.next.text,
        },
        { icon: <ClipboardCheck />, label: P.help.items.week.label, text: P.help.items.week.text },
        { icon: <Wallet />, label: P.help.items.budget.label, text: P.help.items.budget.text },
        { icon: <Store />, label: P.help.items.vendors.label, text: P.help.items.vendors.text },
      ]}
    />
  );
  return (
    <PlanFrame tool="overview" title={P.title} description={P.subtitle} help={help}>
      {view.invitation.date ? (
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-brand-deep">
          {t.eventTypes[view.invitation.eventType]}
          <CountdownChip date={view.invitation.date} />
        </p>
      ) : null}
      {past ? (
        <PastSummary />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <NextStep />
            <WeekCard />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BudgetCard />
            </div>
            <div className="flex flex-col gap-4">
              <VendorsCard />
              <TasksCard />
            </div>
          </div>
        </>
      )}
    </PlanFrame>
  );
}

function useNames() {
  const { t, locale } = useUi();
  const { view } = usePlan();
  const confirmed = { adults: view.headcount.confirmedAdults, children: view.headcount.confirmedChildren };
  return {
    title: (task: TaskView) =>
      taskTitle(task, view.settings, locale) ??
      (task.systemKey ? systemText(t, task.systemKey, confirmed).title : ''),
    notes: (task: TaskView) =>
      taskNotes(task, view.settings, locale) ??
      (task.systemKey ? systemText(t, task.systemKey, confirmed).body : null),
  };
}

function NextStep() {
  const { t, plural, number, date } = useUi();
  const O = t.planning.overview.next;
  const plan = usePlan();
  const { view } = plan;
  const names = useNames();
  const task = nextTask(view.tasks);
  const href = task?.systemKey ? SYSTEM_HREF[task.systemKey] : null;
  const due = task ? dueText({ t, plural, number, date } as never, view.today, task.dueDate) : null;
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-plan-card="next">
      <CardTitle as="h2">{O.title}</CardTitle>
      {task && due ? (
        <>
          <div>
            <p className="text-[18px] leading-snug font-bold">
              <bdi>{names.title(task)}</bdi>
            </p>
            {names.notes(task) ? <p className="mt-1 text-[13.5px] text-muted">{names.notes(task)}</p> : null}
            {task.dueDate ? (
              <p className={cn('mt-2 text-[13px] font-semibold', toneClass[due.tone])}>{due.text}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 max-sm:[&>*]:flex-1">
            {href ? (
              <Button icon={<ArrowLeft className="icon-dir" />} asChild>
                <Link href={`/app/invitations/${plan.id}${href}`}>{O.doIt}</Link>
              </Button>
            ) : null}
            <Button variant={href ? 'secondary' : 'primary'} asChild>
              <Link href={`/app/invitations/${plan.id}/plan/tasks`}>{href ? O.allTasks : O.open}</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white dark:text-success-bg"
            >
              <Check className="size-5" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-[16px] font-bold">{O.allDone}</p>
              <p className="text-[13.5px] text-muted">{O.allDoneBody}</p>
            </div>
          </div>
          <Button variant="secondary" asChild className="self-start">
            <Link href={`/app/invitations/${plan.id}/plan/tasks`}>{O.allTasks}</Link>
          </Button>
        </>
      )}
    </Card>
  );
}

type WeekEntry =
  | { kind: 'task'; date: string | null; task: TaskView }
  | { kind: 'payment'; date: string | null; payment: PlanPayment; itemTitle: string };

function WeekCard() {
  const { t, plural, number, date, fmt } = useUi();
  const W = t.planning.overview.week;
  const plan = usePlan();
  const { view } = plan;
  const names = useNames();
  const actions = useTaskActions();
  const { toast } = useToast();
  const entries = useMemo<WeekEntry[]>(() => {
    const tasks = dueWithin(view.tasks, view.today, 7).map((task): WeekEntry => ({
      kind: 'task',
      date: task.dueDate,
      task,
    }));
    const payments = view.payments
      .filter((p) => !p.paidAt && p.dueDate !== null && daysBetween(view.today, p.dueDate) <= 7)
      .map((payment): WeekEntry => ({
        kind: 'payment',
        date: payment.dueDate,
        payment,
        itemTitle: view.items.find((i) => i.id === payment.itemId)?.title ?? '',
      }));
    return [...tasks, ...payments].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 8);
  }, [view.tasks, view.payments, view.items, view.today]);

  const markPaid = async (payment: PlanPayment) => {
    const stamp = new Date().toISOString();
    plan.patch((v) => ({
      ...v,
      payments: v.payments.map((p) => (p.id === payment.id ? { ...p, paidAt: stamp } : p)),
    }));
    const res = await plan.call('/budget', { op: 'payment_paid', id: payment.id, paid: true });
    if (!res.ok) {
      plan.patch((v) => ({
        ...v,
        payments: v.payments.map((p) => (p.id === payment.id ? { ...p, paidAt: null } : p)),
      }));
      return void toast({ title: t.planning.common.failed, variant: 'danger' });
    }
    toast({ title: W.paidDone, variant: 'success' });
    void plan.refresh();
  };

  return (
    <Card padding="lg" className="flex flex-col gap-3" data-plan-card="week">
      <CardTitle as="h2">{W.title}</CardTitle>
      {entries.length === 0 ? (
        <p className="text-[14px] text-muted">{W.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {entries.map((e) => {
            const due = dueText({ t, plural, number, date } as never, view.today, e.date);
            return e.kind === 'task' ? (
              <li key={e.task.id} className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone(e.task)}
                  aria-label={t.planning.tasks.row.complete}
                  disabled={
                    e.task.derived !== null && e.task.derived !== undefined && e.task.systemKey !== null
                  }
                  onClick={() => void actions.complete(e.task)}
                  className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span aria-hidden className="size-6 rounded-full border-2 border-line-strong bg-surface" />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    <bdi>{names.title(e.task)}</bdi>
                  </span>
                  <span className={cn('block text-[12.5px] font-medium', toneClass[due.tone])}>
                    {due.text}
                  </span>
                </span>
                {e.task.systemKey && SYSTEM_HREF[e.task.systemKey] ? (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/app/invitations/${plan.id}${SYSTEM_HREF[e.task.systemKey]}`}>
                      {t.planning.overview.next.doIt}
                    </Link>
                  </Button>
                ) : null}
              </li>
            ) : (
              <li key={e.payment.id} className="flex items-center gap-2 py-1">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center text-muted">
                  <Wallet className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {fmt(W.payment, { label: e.payment.label })}
                    {e.itemTitle ? (
                      <span className="font-normal text-muted">
                        {' '}
                        · <bdi>{e.itemTitle}</bdi>
                      </span>
                    ) : null}
                  </span>
                  <span className={cn('block text-[12.5px] font-medium', toneClass[due.tone])}>
                    <Money value={e.payment.amount} /> · {due.text}
                  </span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => void markPaid(e.payment)}>
                  {W.markPaid}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="ghost" asChild className="self-start">
        <Link href={`/app/invitations/${plan.id}/plan/tasks`}>{W.all}</Link>
      </Button>
    </Card>
  );
}

/** One meter for the whole budget: paid, committed but not yet paid, and what is left of the total. */
function BudgetMeter({ paid, committed, total }: { paid: number; committed: number; total: number }) {
  const { t } = useUi();
  const B = t.planning.overview.budget;
  const scale = Math.max(total, committed);
  const paidPct = percentOf(paid, scale);
  const committedPct = Math.max(paidPct, percentOf(committed, scale));
  return (
    <div>
      <div
        role="img"
        aria-label={B.meter
          .replace('{paid}', String(Math.round(paid)))
          .replace('{committed}', String(Math.round(committed)))
          .replace('{total}', String(Math.round(total)))}
        className="flex h-3 overflow-hidden rounded-full bg-subtle"
      >
        <span className="bg-success" style={{ width: `${paidPct}%` }} />
        <span className="bg-brand" style={{ width: `${committedPct - paidPct}%` }} />
      </div>
    </div>
  );
}

function BudgetCard() {
  const { t } = useUi();
  const B = t.planning.overview.budget;
  const plan = usePlan();
  const { view } = plan;
  const totals = view.totals;
  const total = totals.totalBudget;
  const over = total !== null && totals.committed > total;
  return (
    <Card padding="lg" className="flex flex-col gap-4" data-plan-card="budget">
      <div className="flex items-center justify-between gap-2">
        <CardTitle as="h2">{B.title}</CardTitle>
        {total !== null ? (
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/app/invitations/${plan.id}/plan/budget`}>{B.cta}</Link>
          </Button>
        ) : null}
      </div>
      {total === null ? (
        <div className="flex flex-col items-start gap-3">
          <div>
            <p className="text-[16px] font-bold">{B.setupTitle}</p>
            <p className="text-[13.5px] text-muted">{B.setupBody}</p>
          </div>
          <Button icon={<Plus />} asChild>
            <Link href={`/app/invitations/${plan.id}/plan/budget`}>{B.setupCta}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label={B.planned} value={<Money value={totals.planned} />} />
            <KpiCard label={B.committed} value={<Money value={totals.committed} />} />
            <KpiCard label={B.paid} value={<Money value={totals.paid} />} />
            <KpiCard label={B.remaining} value={<Money value={totals.remaining ?? 0} />} />
          </div>
          <BudgetMeter paid={totals.paid} committed={totals.committed} total={total} />
          {over ? (
            <p className="rounded-btn bg-warning-bg px-3 py-2 text-[13px] font-semibold text-warning">
              {B.over.split('{amount}')[0]}
              <Money value={totals.committed - total} />
              {B.over.split('{amount}')[1]}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

function VendorsCard() {
  const { t, fmt, number } = useUi();
  const V = t.planning.overview.vendors;
  const plan = usePlan();
  const { view } = plan;
  const live = view.vendors.filter((v) => v.status !== 'rejected');
  const closed = live.filter((v) => v.status === 'booked').length;
  const booked = new Set(view.vendors.filter((v) => v.status === 'booked').map((v) => v.category));
  const missing = (view.settings?.requiredVendors ?? []).filter((k) => !booked.has(k));
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-plan-card="vendors">
      <div className="flex items-center justify-between gap-2">
        <CardTitle as="h2">{V.title}</CardTitle>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/app/invitations/${plan.id}/plan/vendors`}>{V.cta}</Link>
        </Button>
      </div>
      <p className="text-[15px] font-semibold">
        {live.length === 0 ? V.none : fmt(V.closed, { closed: number(closed), total: number(live.length) })}
      </p>
      {missing.length ? (
        <div>
          <p className="text-[12.5px] text-muted">{V.missing}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {missing.map((k) => (
              <li key={k}>
                <Link
                  href={`/app/invitations/${plan.id}/plan/vendors?add=${k}`}
                  className="inline-flex min-h-9 items-center rounded-full bg-subtle px-3 text-[13px] font-medium hover:bg-brand-soft"
                >
                  {t.planning.categories[k]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function TasksCard() {
  const { t, fmt, number } = useUi();
  const K = t.planning.overview.tasks;
  const plan = usePlan();
  const counted = plan.view.tasks.filter((x) => x.status !== 'skipped' && !x.suggestHide);
  const done = counted.filter(isDone).length;
  return (
    <Card padding="lg" className="flex flex-col gap-3" data-plan-card="tasks">
      <div className="flex items-center justify-between gap-2">
        <CardTitle as="h2">{K.title}</CardTitle>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/app/invitations/${plan.id}/plan/tasks`}>{K.cta}</Link>
        </Button>
      </div>
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <ListChecks aria-hidden className="size-5 text-muted" />
        {fmt(K.progress, { done: number(done), total: number(counted.length) })}
      </p>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-subtle">
        <span
          className="block h-full rounded-full bg-success"
          style={{ width: `${percentOf(done, counted.length)}%` }}
        />
      </div>
    </Card>
  );
}

/** After the event: what was spent, what was paid, how the vendors were. No reminders, no tasks. */
function PastSummary() {
  const { t } = useUi();
  const S = t.planning.overview.past;
  const plan = usePlan();
  const { view } = plan;
  const unrated = view.vendors.filter((v) => v.status === 'booked' && v.rating === null).length;
  return (
    <Card padding="lg" className="flex flex-col gap-4" data-plan-card="past">
      <div>
        <CardTitle as="h2">{S.title}</CardTitle>
        <p className="mt-1 text-[14px] text-muted">{S.body}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={S.spent} value={<Money value={view.totals.committed} />} />
        <KpiCard label={S.paid} value={<Money value={view.totals.paid} />} />
        <KpiCard label={S.unpaid} value={<Money value={view.totals.unpaid} />} />
      </div>
      {unrated > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-subtle p-4">
          <p className="text-[13.5px] text-muted">{S.rateBody}</p>
          <Button variant="secondary" asChild>
            <Link href={`/app/invitations/${plan.id}/plan/vendors`}>{S.rate}</Link>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

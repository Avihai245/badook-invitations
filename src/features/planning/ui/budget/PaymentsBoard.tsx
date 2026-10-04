'use client';

import { CalendarClock, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState, Segmented, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { isOverdue, paymentRows, type PaymentRow } from '../../model/budget-view';
import { dueText, toneClass, type DueTone } from '../format';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { Fill } from './Fill';
import { useBudget } from './useBudget';

type Filter = 'open' | 'all';

/** "לוח תשלומים": every payment of every item by its due date, with a mark-as-paid for each (and a gentle word for the overdue). */
export function PaymentsBoard({
  past,
  onOpenItem,
  onAddExpense,
}: {
  past: boolean;
  onOpenItem: (itemId: string) => void;
  onAddExpense: () => void;
}) {
  const ui = useUi();
  const T = ui.t.planning.budget;
  const B = T.board;
  const { view } = usePlan();
  const { markPaid } = useBudget();
  const [filter, setFilter] = useState<Filter>('open');
  const all = paymentRows(view);
  const rows = filter === 'open' ? all.filter((r) => r.payment.paidAt === null) : all;
  const open = all.filter((r) => r.payment.paidAt === null);
  const openTotal = Math.round(open.reduce((n, r) => n + r.payment.amount, 0) * 100) / 100;

  if (all.length === 0)
    return (
      <Card>
        <EmptyState
          illustration={<CalendarClock className="size-14 text-faint" strokeWidth={1.4} />}
          title={B.empty.title}
          description={B.empty.body}
          action={
            view.categories.length > 0 ? (
              <Button icon={<Plus />} onClick={onAddExpense}>
                {T.addExpense}
              </Button>
            ) : undefined
          }
        />
      </Card>
    );

  return (
    <section aria-label={B.title} className="flex flex-col gap-3" data-testid="budget-payments">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink/80" role="status">
          {open.length === 0 ? (
            B.allPaid
          ) : (
            <Fill text={B.totalOpen} vars={{ amount: <Money value={openTotal} className="font-bold" /> }} />
          )}
        </p>
        <Segmented<Filter>
          label={B.filter.label}
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'open', label: B.filter.open },
            { value: 'all', label: B.filter.all },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-btn bg-subtle px-3.5 py-3 text-[13.5px] text-muted">{B.allPaid}</p>
      ) : (
        <Card asChild>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <PaymentLine
                key={r.payment.id}
                row={r}
                past={past}
                today={view.today}
                onToggle={(paid) => void markPaid(r.payment, paid)}
                onOpen={() => onOpenItem(r.item.id)}
                dueLabel={dueText(ui, view.today, r.payment.dueDate)}
              />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function PaymentLine({
  row,
  past,
  today,
  onToggle,
  onOpen,
  dueLabel,
}: {
  row: PaymentRow;
  past: boolean;
  today: string;
  onToggle: (paid: boolean) => void;
  onOpen: () => void;
  dueLabel: { text: string; tone: DueTone };
}) {
  const { t, fmt, date } = useUi();
  const B = t.planning.budget.board;
  const { payment: p, item, category } = row;
  const paid = p.paidAt !== null;
  const overdue = !past && isOverdue(p, today);
  const where = [
    category ? (category.name ?? (category.key ? t.planning.categories[category.key] : '')) : null,
    p.payer,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="flex items-center gap-1 ps-2 pe-3" data-testid="payment-row">
      <button
        type="button"
        role="checkbox"
        aria-checked={paid}
        aria-label={fmt(paid ? B.markUnpaid : B.markPaid, { label: `${item.title} · ${p.label}` })}
        onClick={() => onToggle(!paid)}
        className="grid size-11 shrink-0 place-items-center rounded-btn"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-6 place-items-center rounded-full border transition-colors motion-reduce:transition-none',
            paid
              ? 'border-success-line bg-success-bg text-success'
              : 'border-line-strong text-transparent hover:text-faint',
          )}
        >
          <Check className="size-3.5" strokeWidth={2.5} />
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={fmt(B.open, { title: item.title })}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-btn px-1.5 py-2 text-start hover:bg-row-hover"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[14px] font-medium',
              paid && 'text-muted line-through decoration-1',
            )}
          >
            {p.label} · {item.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
            {paid ? (
              <span className="text-muted">
                {fmt(B.paidOn, {
                  date: date(p.paidAt!, { day: 'numeric', month: 'short', year: 'numeric' }),
                })}
              </span>
            ) : (
              <span
                className={overdue ? 'font-semibold text-danger' : toneClass[past ? 'later' : dueLabel.tone]}
              >
                {dueLabel.text}
              </span>
            )}
            {overdue ? <Badge variant="warning">{B.overdue}</Badge> : null}
            {p.payOnEventDay ? <Badge variant="info">{B.eventDay}</Badge> : null}
            {where ? <span className="truncate text-muted">{where}</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-[14px] font-semibold">
          <Money value={p.amount} />
        </span>
      </button>
    </li>
  );
}

'use client';

import { Banknote, Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, cn, useToast } from '@/components/app';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import type { EventDayPayment } from '../server/budget';
import { Money } from './Money';
import { Fill } from './budget/Fill';

/**
 * The payments to make at the event itself (a cash balance to the DJ…), under the event day's hall: each with
 * a way to mark it paid, so nothing is forgotten on the night. Rendered by the live page only for the owner,
 * when the plan follows the event day; the rows are the server's (planning_event_day_payments).
 */
export function TodayPayments({ id, initial }: { id: string; initial: EventDayPayment[] }) {
  const { t, fmt } = useUi();
  const D = t.planning.budget.today;
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  if (rows.length === 0) return null;

  const open = rows.filter((r) => r.paidAt === null);
  const left = Math.round(open.reduce((n, r) => n + r.amount, 0) * 100) / 100;

  const mark = async (row: EventDayPayment, paid: boolean) => {
    const before = rows;
    setBusy((b) => new Set(b).add(row.id));
    setRows((list) =>
      list.map((r) => (r.id === row.id ? { ...r, paidAt: paid ? new Date().toISOString() : null } : r)),
    );
    const res = await hostApi<{ payment?: { paidAt: string | null } }>(
      `/api/invitations/${id}/planning/budget`,
      {
        method: 'POST',
        body: { op: 'payment_paid', id: row.id, paid },
      },
    );
    setBusy((b) => {
      const next = new Set(b);
      next.delete(row.id);
      return next;
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) {
      setRows(before);
      toast({ variant: 'danger', title: D.failed });
      return;
    }
    const paidAt = res.body?.payment?.paidAt ?? null;
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, paidAt } : r)));
    if (paid) toast({ variant: 'success', title: D.paidDone });
  };

  return (
    <div className="mx-auto -mt-8 max-w-[1760px] px-4 pb-16 sm:px-6">
      <Card padding="md" data-testid="today-payments">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-deep"
          >
            <Banknote className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] leading-snug font-bold">{D.title}</h2>
            <p className="text-[13px] text-muted">{D.subtitle}</p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-line rounded-btn border border-line">
          {rows.map((r) => {
            const paid = r.paidAt !== null;
            const what = r.vendorName ? `${r.itemTitle} · ${r.vendorName}` : r.itemTitle;
            return (
              <li key={r.id} className="flex items-center gap-1 ps-1.5 pe-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={paid}
                  aria-label={fmt(paid ? D.markUnpaid : D.markPaid, { label: `${r.label} · ${what}` })}
                  disabled={busy.has(r.id)}
                  onClick={() => void mark(r, !paid)}
                  className="grid size-11 shrink-0 place-items-center rounded-btn disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-6 place-items-center rounded-full border transition-colors motion-reduce:transition-none',
                      paid
                        ? 'border-success-line bg-success-bg text-success'
                        : 'border-line-strong text-transparent',
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </span>
                </button>
                <span className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2">
                  <span
                    className={cn(
                      'truncate text-[14px] font-medium',
                      paid && 'text-muted line-through decoration-1',
                    )}
                  >
                    {r.label}
                  </span>
                  <span className="truncate text-[12.5px] text-muted">{what}</span>
                </span>
                <span className={cn('shrink-0 text-[14px] font-semibold', paid && 'text-muted')}>
                  <Money value={r.amount} />
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13.5px]" role="status">
            {open.length === 0 ? (
              D.allPaid
            ) : (
              <Fill text={D.total} vars={{ amount: <Money value={left} className="font-bold" /> }} />
            )}
          </p>
          <Link
            href={`/app/invitations/${id}/plan/budget`}
            className="inline-flex min-h-11 items-center text-[13px] font-semibold text-brand-deep underline underline-offset-2"
          >
            {D.link}
          </Link>
        </div>
      </Card>
    </div>
  );
}

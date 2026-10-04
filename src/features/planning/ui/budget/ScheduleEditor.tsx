'use client';

import { Plus, X } from 'lucide-react';
import { Button, Checkbox, Field, IconButton, Input } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { amountText, parseAmount } from '../../model/budget-view';
import type { PlanPayment } from '../../model/plan';
import { Money } from '../Money';
import { Fill } from './Fill';
import { MoneyField } from './MoneyField';
import type { PaymentDraft } from './useBudget';

/** A payment of the schedule as it is edited: amounts and dates are text until saved. */
export interface ScheduleRow {
  key: string;
  id?: string;
  label: string;
  amount: string;
  dueDate: string;
  payOnEventDay: boolean;
  payer: string;
  paid: boolean;
  paidAt: string | null;
}

export const rowsFromPayments = (payments: readonly PlanPayment[]): ScheduleRow[] =>
  payments.map((p) => ({
    key: p.id,
    id: p.id,
    label: p.label,
    amount: amountText(p.amount),
    dueDate: p.dueDate ?? '',
    payOnEventDay: p.payOnEventDay,
    payer: p.payer ?? '',
    paid: p.paidAt !== null,
    paidAt: p.paidAt,
  }));

/**
 * The rows as payments to save. A row left blank (no label, no amount) is dropped; one with a label but no
 * usable amount is a mistake (its key is in `bad`).
 */
export function draftsFromRows(rows: readonly ScheduleRow[]): { drafts: PaymentDraft[]; bad: Set<string> } {
  const drafts: PaymentDraft[] = [];
  const bad = new Set<string>();
  for (const r of rows) {
    const amount = parseAmount(r.amount);
    if (!r.label.trim() && (amount === null || amount === undefined) && !r.dueDate) continue;
    if (!r.label.trim() || typeof amount !== 'number' || amount <= 0) {
      bad.add(r.key);
      continue;
    }
    drafts.push({
      ...(r.id ? { id: r.id } : {}),
      label: r.label.trim().slice(0, 60),
      amount,
      dueDate: r.dueDate || null,
      paidAt: r.paid ? (r.paidAt ?? new Date().toISOString()) : null,
      payOnEventDay: r.payOnEventDay,
      payer: r.payer.trim() ? r.payer.trim().slice(0, 60) : null,
    });
  }
  return { drafts, bad };
}

/** The payment schedule of an item: a deposit, payments, the balance — each with an amount, a date and who pays. */
export function ScheduleEditor({
  rows,
  onChange,
  total,
  tried,
}: {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  /** what the item costs (what the payments should add up to) */
  total: number;
  /** the host pressed save: rows with a mistake say so */
  tried: boolean;
}) {
  const { t } = useUi();
  const S = t.planning.budget.schedule;
  const sum = Math.round(rows.reduce((n, r) => n + (parseAmount(r.amount) || 0), 0) * 100) / 100;
  const left = Math.round((total - sum) * 100) / 100;
  const { bad } = draftsFromRows(rows);

  const set = (key: string, patch: Partial<ScheduleRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (label: string, amount: number) =>
    onChange([
      ...rows,
      {
        key: crypto.randomUUID(),
        label,
        amount: amount > 0 ? String(amount) : '',
        dueDate: '',
        payOnEventDay: false,
        payer: '',
        paid: false,
        paidAt: null,
      },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? <p className="text-[13px] text-muted">{S.empty}</p> : null}
      <ul className="flex flex-col gap-3">
        {rows.map((r, n) => (
          <li key={r.key} className="rounded-btn border border-line p-3" data-testid="schedule-row">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={S.label}
                error={tried && bad.has(r.key) && !r.label.trim() ? S.invalid : undefined}
              >
                <Input
                  value={r.label}
                  maxLength={60}
                  onChange={(e) => set(r.key, { label: e.target.value })}
                />
              </Field>
              <MoneyField
                label={S.amount}
                value={r.amount}
                onChange={(amount) => set(r.key, { amount })}
                error={tried && bad.has(r.key) && !(parseAmount(r.amount) || 0) ? S.invalid : undefined}
              />
              <Field label={S.due}>
                <Input
                  type="date"
                  dir="ltr"
                  value={r.dueDate}
                  onChange={(e) => set(r.key, { dueDate: e.target.value })}
                />
              </Field>
              <Field label={S.payer}>
                <Input
                  value={r.payer}
                  maxLength={60}
                  onChange={(e) => set(r.key, { payer: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
              <Checkbox
                label={S.paid}
                checked={r.paid}
                onCheckedChange={(paid) =>
                  set(r.key, { paid, paidAt: paid ? (r.paidAt ?? new Date().toISOString()) : null })
                }
                className="min-h-11"
              />
              <Checkbox
                label={S.eventDay}
                checked={r.payOnEventDay}
                onCheckedChange={(payOnEventDay) => set(r.key, { payOnEventDay })}
                className="min-h-11"
              />
              <IconButton
                label={`${S.remove} ${n + 1}`}
                className="ms-auto min-h-11 min-w-11"
                onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
              >
                <X />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus />}
          className="min-h-11"
          onClick={() => add(S.labels.deposit, 0)}
        >
          {S.add.deposit}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus />}
          className="min-h-11"
          onClick={() => add(S.labels.payment, 0)}
        >
          {S.add.payment}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus />}
          className="min-h-11"
          onClick={() => add(S.labels.balance, Math.max(0, left))}
        >
          {S.add.balance}
        </Button>
      </div>
      {rows.length > 0 && total > 0 ? (
        <p className="text-[12.5px] text-muted" aria-live="polite">
          {left === 0 ? (
            S.sumMatch
          ) : left > 0 ? (
            <Fill text={S.sumLeft} vars={{ amount: <Money value={left} /> }} />
          ) : (
            <Fill text={S.sumOver} vars={{ amount: <Money value={-left} /> }} />
          )}
        </p>
      ) : null}
    </div>
  );
}

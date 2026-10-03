'use client';

import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, Field, IconButton, Input, Select, Textarea } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { CATEGORY_KEYS } from '../../model/categories';
import { buildFollowUps } from '../../model/follow-ups';
import { isIsoDate, parsePaymentTerms } from '../../model/payment-terms';
import type { PlanVendor } from '../../model/plan';
import type { ClosePlanInput } from '../../model/schemas-vendors';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { parseAmount } from './helpers';

interface Row {
  id: number;
  label: string;
  amount: string;
  dueDate: string;
  onDay: boolean;
}

/** A sentence with amounts in it: each `{name}` of the template becomes a left-to-right money value. */
function withMoney(template: string, values: Record<string, number>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key && key in values ? (
      <Money key={i} value={values[key]!} />
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}

/** One part of the close: its own switch, and what it will do when it is on. */
function Part({
  checked,
  onChecked,
  title,
  body,
  disabled = false,
  note,
  children,
}: {
  checked: boolean;
  onChecked: (on: boolean) => void;
  title: string;
  body: string;
  disabled?: boolean;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <fieldset className="rounded-card border border-line p-3">
      <label
        className={`flex min-h-11 items-start gap-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChecked(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-ink"
        />
        <span className="min-w-0">
          <span className="block text-[14.5px] font-semibold">{title}</span>
          <span className="block text-[12.5px] text-muted">{body}</span>
        </span>
      </label>
      {note ? <p className="mt-1 ps-7 text-[12.5px] text-muted">{note}</p> : null}
      {checked && !disabled && children ? (
        <div className="mt-3 flex flex-col gap-3 ps-7">{children}</div>
      ) : null}
    </fieldset>
  );
}

/**
 * Closing a vendor in one click: the budget (an item named, in a category, for the amount), the payment
 * schedule (proposed from the vendor's payment terms, every row editable) and the follow-up tasks
 * (checkboxes). Each part is chosen on its own; with none the vendor is only marked as booked. What is
 * chosen is sent as one plan and done together, or not at all.
 */
export function CloseVendorDialog({
  vendor,
  onCancel,
  onConfirm,
}: {
  /** the vendor being closed (null: closed) */
  vendor: PlanVendor | null;
  onCancel: () => void;
  onConfirm: (vendor: PlanVendor, plan: ClosePlanInput, terms: string | null | undefined) => void;
}) {
  return vendor ? <Body key={vendor.id} vendor={vendor} onCancel={onCancel} onConfirm={onConfirm} /> : null;
}

function Body({
  vendor,
  onCancel,
  onConfirm,
}: {
  vendor: PlanVendor;
  onCancel: () => void;
  onConfirm: (vendor: PlanVendor, plan: ClosePlanInput, terms: string | null | undefined) => void;
}) {
  const { t, fmt, locale, date } = useUi();
  const K = t.planning.vendors.close;
  const B = K.budget;
  const P = K.payments;
  const { view } = usePlan();
  const eventDate = view.invitation.date;
  const today = view.today;
  const formId = useId();
  const nextRow = useRef(1);

  // the budget
  const [budgetOn, setBudgetOn] = useState(true);
  const [title, setTitle] = useState(vendor.name);
  const own = view.categories.find((c) => c.key !== null && c.key === (vendor.category ?? 'other'));
  const [category, setCategory] = useState(own ? `id:${own.id}` : `key:${vendor.category ?? 'other'}`);
  const [amount, setAmount] = useState(vendor.quoteAmount === null ? '' : String(vendor.quoteAmount));

  // the payments
  const [paymentsOn, setPaymentsOn] = useState(true);
  const [terms, setTerms] = useState(vendor.paymentTerms ?? '');
  const propose = (amountText: string, termsText: string): Row[] => {
    const total = parseAmount(amountText);
    if (!total) return [];
    return parsePaymentTerms(termsText, total, eventDate, today, locale).map((p) => ({
      id: nextRow.current++,
      label: p.label,
      amount: String(p.amount),
      dueDate: p.dueDate ?? '',
      onDay: p.payOnEventDay,
    }));
  };
  const [rows, setRows] = useState<Row[]>(() => propose(amount, terms));
  // the proposal follows the amount and the terms until the host has edited a row
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) setRows(propose(amount, terms));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- propose only reads the event's date and today
  }, [amount, terms]);
  const changeRows = (next: Row[]) => {
    edited.current = true;
    setRows(next);
  };
  const setRow = (id: number, patch: Partial<Row>) =>
    changeRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // the tasks
  const followUps = buildFollowUps(vendor.category, eventDate, today, locale, vendor.name);
  const [tasksOn, setTasksOn] = useState(true);
  const [chosen, setChosen] = useState(() => new Set(followUps.filter((f) => f.dueDate).map((f) => f.key)));

  const [errors, setErrors] = useState<{ title?: boolean; amount?: boolean; rows?: boolean }>({});

  const total = parseAmount(amount);
  const sum = rows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0);
  const sumOk = total !== null && total !== undefined && Math.round(sum * 100) === Math.round(total * 100);
  const paymentsUsed = budgetOn && paymentsOn;
  const nothing = !budgetOn && (!tasksOn || chosen.size === 0);

  const fresh = CATEGORY_KEYS.filter((k) => !view.categories.some((c) => c.key === k));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const bad: typeof errors = {};
    if (budgetOn && !title.trim()) bad.title = true;
    if (budgetOn && total === undefined) bad.amount = true;
    const payments = paymentsUsed
      ? rows.map((r) => ({
          label: r.label.trim(),
          amount: parseAmount(r.amount),
          dueDate: r.dueDate,
          onDay: r.onDay,
        }))
      : [];
    if (
      payments.some(
        (p) =>
          !p.label ||
          p.label.length > 60 ||
          !p.amount ||
          p.amount <= 0 ||
          (p.dueDate !== '' && !isIsoDate(p.dueDate)),
      )
    )
      bad.rows = true;
    if (bad.title || bad.amount || bad.rows) return setErrors(bad);

    const plan: ClosePlanInput = {};
    if (budgetOn) {
      const [kind, ref] = category.split(/:(.*)/s) as ['id' | 'key', string];
      plan.item = {
        ...(kind === 'id' ? { categoryId: ref } : { categoryKey: ref as (typeof CATEGORY_KEYS)[number] }),
        title: title.trim(),
        amount: total ?? null,
      };
      if (payments.length > 0)
        plan.payments = payments.map((p) => ({
          label: p.label,
          amount: p.amount!,
          dueDate: p.dueDate || null,
          payOnEventDay: p.onDay,
        }));
    }
    const tasks = tasksOn ? followUps.filter((f) => chosen.has(f.key)) : [];
    if (tasks.length > 0)
      plan.tasks = tasks.map((f) => ({ title: f.title, dueDate: f.dueDate, category: f.category }));
    const termsText = terms.trim() || null;
    onConfirm(vendor, plan, termsText !== vendor.paymentTerms ? termsText : undefined);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={K.title}
      description={fmt(K.description, { name: vendor.name })}
      closeLabel={t.planning.common.close}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {K.cancel}
          </Button>
          <Button type="submit" form={formId}>
            {K.submit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Part checked={budgetOn} onChecked={setBudgetOn} title={B.title} body={B.body}>
          <Field
            label={B.itemTitle}
            required
            error={errors.title ? t.planning.vendors.drawer.errors.name : undefined}
          >
            <Input
              value={title}
              maxLength={120}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((x) => ({ ...x, title: false }));
              }}
            />
          </Field>
          <Field label={B.category}>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {view.categories.length > 0 ? (
                <optgroup label={B.existingCategory}>
                  {view.categories.map((c) => (
                    <option key={c.id} value={`id:${c.id}`}>
                      {c.name ?? (c.key ? t.planning.categories[c.key] : '')}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label={B.newCategory}>
                {fresh.map((k) => (
                  <option key={k} value={`key:${k}`}>
                    {t.planning.categories[k]}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <Field
            label={B.amount}
            help={B.amountHint}
            error={errors.amount ? t.planning.vendors.drawer.errors.amount : undefined}
          >
            <Input
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors((x) => ({ ...x, amount: false }));
              }}
              autoComplete="off"
            />
          </Field>
        </Part>

        <Part
          checked={paymentsUsed}
          onChecked={setPaymentsOn}
          disabled={!budgetOn}
          title={P.title}
          body={P.body}
          note={budgetOn ? undefined : P.needsBudget}
        >
          <Field label={P.terms}>
            <Textarea
              value={terms}
              rows={2}
              maxLength={500}
              placeholder={P.termsPlaceholder}
              onChange={(e) => setTerms(e.target.value)}
            />
          </Field>
          {total === null || total === undefined || total <= 0 ? (
            <p className="text-[13px] text-muted">{P.needAmount}</p>
          ) : (
            <Button
              variant="secondary"
              icon={<RefreshCw />}
              className="min-h-11 self-start"
              onClick={() => {
                edited.current = false;
                setRows(propose(amount, terms));
              }}
            >
              {P.recompute}
            </Button>
          )}
          {rows.length === 0 ? (
            <p className="text-[13px] text-muted">{P.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r, i) => (
                <li key={r.id} className="rounded-card border border-line p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-muted">{fmt(P.row, { n: i + 1 })}</span>
                    <IconButton
                      label={fmt(P.remove, { n: i + 1 })}
                      onClick={() => changeRows(rows.filter((x) => x.id !== r.id))}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={P.label}>
                      <Input
                        value={r.label}
                        maxLength={60}
                        onChange={(e) => setRow(r.id, { label: e.target.value })}
                      />
                    </Field>
                    <Field label={P.amount}>
                      <Input
                        inputMode="decimal"
                        dir="ltr"
                        value={r.amount}
                        onChange={(e) => setRow(r.id, { amount: e.target.value })}
                      />
                    </Field>
                    <Field label={P.date}>
                      <Input
                        type="date"
                        dir="ltr"
                        value={r.dueDate}
                        onChange={(e) => setRow(r.id, { dueDate: e.target.value })}
                      />
                    </Field>
                    <label className="flex min-h-11 cursor-pointer items-end gap-2 pb-2.5 text-[13px]">
                      <input
                        type="checkbox"
                        checked={r.onDay}
                        onChange={(e) => setRow(r.id, { onDay: e.target.checked })}
                        className="size-4 shrink-0 accent-ink"
                      />
                      {P.onDay}
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="ghost"
            icon={<Plus />}
            className="min-h-11 self-start"
            onClick={() =>
              changeRows([
                ...rows,
                { id: nextRow.current++, label: '', amount: '', dueDate: '', onDay: false },
              ])
            }
          >
            {P.add}
          </Button>
          {rows.length > 0 && total ? (
            <p role="status" className={`text-[13px] ${sumOk ? 'text-success' : 'text-warning'}`}>
              {sumOk ? P.sumOk : withMoney(P.sum, { sum, total })}
            </p>
          ) : null}
          {errors.rows ? (
            <p role="alert" className="text-[13px] text-danger">
              {P.invalid}
            </p>
          ) : null}
        </Part>

        {followUps.length > 0 ? (
          <Part checked={tasksOn} onChecked={setTasksOn} title={K.tasks.title} body={K.tasks.body}>
            <ul className="flex flex-col">
              {followUps.map((f) => (
                <li key={f.key}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={chosen.has(f.key)}
                      onChange={(e) =>
                        setChosen((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(f.key);
                          else next.delete(f.key);
                          return next;
                        })
                      }
                      className="mt-0.5 size-4 shrink-0 accent-ink"
                    />
                    <span className="min-w-0 text-[13.5px]">
                      {f.title}
                      <span className="block text-[12.5px] text-muted">
                        {f.dueDate
                          ? fmt(K.tasks.due, {
                              date: date(f.dueDate, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
                            })
                          : K.tasks.noDate}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Part>
        ) : null}

        {nothing ? <p className="text-[13px] text-muted">{K.statusOnly}</p> : null}
      </form>
    </Dialog>
  );
}

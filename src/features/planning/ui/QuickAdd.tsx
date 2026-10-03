'use client';

import { CircleDollarSign, ClipboardPlus, Lightbulb, ListChecks, Store } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog, Field, Input, Menu, Select, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { CATEGORY_KEYS, isCategoryKey } from '../model/categories';
import { usePlan } from './PlanProvider';
import { useTaskActions } from './tasks/useTaskActions';

type Kind = 'task' | 'expense' | 'vendor' | 'idea';

const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

/**
 * The quick-add button — a phone's floating "+": a task, an expense, a vendor or an idea in one small
 * form each, wherever the host is in the plan. It sits above the support assistant's button.
 */
export function QuickAdd() {
  const { t } = useUi();
  const P = t.planning;
  const Q = P.quick;
  const { toast } = useToast();
  const plan = usePlan();
  const actions = useTaskActions();
  const [kind, setKind] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');

  const open = (k: Kind) => {
    setText('');
    setDate('');
    setAmount('');
    setPhone('');
    setCategory(k === 'expense' ? (plan.view.categories[0]?.id ?? '') : '');
    setKind(k);
  };
  const close = () => setKind(null);
  const done = () => {
    toast({ title: Q.added, variant: 'success' });
    close();
  };
  const failed = () => toast({ title: P.common.failed, variant: 'danger' });

  const submit = async () => {
    const value = text.trim();
    if (!kind || !value) return;
    setBusy(true);
    try {
      if (kind === 'task') {
        if (await actions.add(value, date ? { dueDate: date } : {})) done();
      } else if (kind === 'expense') {
        const n = Number.parseFloat(amount.replace(/,/g, ''));
        if (!category || !Number.isFinite(n) || n <= 0) return;
        const res = await plan.call('/budget', {
          op: 'item_save',
          item: { categoryId: category, title: value, estimate: n },
        });
        if (!res.ok) return void failed();
        void plan.refresh();
        done();
      } else if (kind === 'vendor') {
        const res = await plan.call('/vendors', {
          op: 'save',
          vendor: {
            name: value,
            ...(isCategoryKey(category) ? { category } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          },
        });
        if (!res.ok) return void failed();
        void plan.refresh();
        done();
      } else {
        const res = await plan.call('/ideas', {
          op: 'save',
          idea: isUrl(value) ? { type: 'link', url: value.trim() } : { type: 'note', body: value },
        });
        if (!res.ok) return void failed();
        void plan.refresh();
        done();
      }
    } finally {
      setBusy(false);
    }
  };

  const title = kind ? Q[kind].title : '';
  const noCategories = kind === 'expense' && plan.view.categories.length === 0;
  const label = (c: { key: string | null; name: string | null }) =>
    c.name ?? (c.key && isCategoryKey(c.key) ? P.categories[c.key] : '');

  return (
    <>
      <div className="fixed end-4 bottom-[88px] z-50 sm:hidden">
        <Menu
          align="end"
          trigger={
            <button
              type="button"
              data-testid="plan-quick-add"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary ps-4 pe-5 text-[14px] font-semibold text-primary-ink shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ClipboardPlus aria-hidden className="size-5" />
              {P.common.quickAdd}
            </button>
          }
          items={[
            { label: P.common.quickAddTask, icon: <ListChecks />, onSelect: () => open('task') },
            { label: P.common.quickAddExpense, icon: <CircleDollarSign />, onSelect: () => open('expense') },
            { label: P.common.quickAddVendor, icon: <Store />, onSelect: () => open('vendor') },
            { label: P.common.quickAddIdea, icon: <Lightbulb />, onSelect: () => open('idea') },
          ]}
        />
      </div>
      <Dialog
        open={kind !== null}
        onOpenChange={(o) => !o && close()}
        title={title}
        closeLabel={P.common.close}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {P.common.cancel}
            </Button>
            <Button loading={busy} disabled={!text.trim() || noCategories} onClick={() => void submit()}>
              {Q.add}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={kind === 'idea' ? Q.idea.text : kind ? (Q[kind] as { name: string }).name : ''}>
            <Input
              autoFocus
              value={text}
              maxLength={kind === 'idea' ? 1000 : 160}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          {kind === 'task' ? (
            <Field label={Q.task.date} help={P.common.optional}>
              <Input
                type="date"
                dir="ltr"
                textAlign="start"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          ) : null}
          {kind === 'expense' ? (
            noCategories ? (
              <p className="text-[13.5px] text-muted">{Q.expense.none}</p>
            ) : (
              <>
                <Field label={Q.expense.amount}>
                  <Input
                    inputMode="decimal"
                    dir="ltr"
                    textAlign="start"
                    placeholder="₪"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, '').slice(0, 12))}
                  />
                </Field>
                <Field label={Q.expense.category}>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {plan.view.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {label(c)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )
          ) : null}
          {kind === 'vendor' ? (
            <>
              <Field label={Q.vendor.category} help={P.common.optional}>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">—</option>
                  {CATEGORY_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {P.categories[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={Q.vendor.phone} help={P.common.optional}>
                <Input
                  type="tel"
                  dir="ltr"
                  textAlign="start"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}

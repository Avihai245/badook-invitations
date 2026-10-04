'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog, Field, Input, Select, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { PlanItem, TaskView } from '../../model/plan';
import { usePlan } from '../PlanProvider';

/**
 * "How much did it cost?" — asked once a task with a cost is done (when the plan follows its tasks): the
 * amount goes into the budget as a booked item in the task's category and the task keeps the link.
 * Skipping is one tap.
 */
export function CostPrompt({
  task,
  title,
  onClose,
}: {
  task: TaskView | null;
  title: string;
  onClose: () => void;
}) {
  const { t } = useUi();
  const P = t.planning;
  const C = P.tasks.cost;
  const { toast } = useToast();
  const plan = usePlan();
  const cats = plan.view.categories;
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    setAmount('');
    const match = cats.find((c) => c.key === task.category) ?? cats[0];
    setCategory(match?.id ?? '');
    // reset when another task is asked about
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;
  const value = Number.parseFloat(amount.replace(/,/g, ''));
  const valid = Number.isFinite(value) && value > 0 && category !== '';

  const add = async () => {
    if (!valid) return;
    setBusy(true);
    const made = await plan.call<{ item?: PlanItem }>('/budget', {
      op: 'item_save',
      item: { categoryId: category, title: title.slice(0, 120), final: value, status: 'booked' },
    });
    if (!made.ok || !made.body?.item) {
      setBusy(false);
      return void toast({ title: P.common.failed, variant: 'danger' });
    }
    // the task keeps the link to what it cost
    await plan.call('/tasks', { op: 'save', task: { id: task.id, budgetItemId: made.body.item.id } });
    setBusy(false);
    toast({ title: C.added, variant: 'success' });
    onClose();
    void plan.refresh();
  };

  const label = (c: (typeof cats)[number]) => c.name ?? (c.key ? P.categories[c.key] : '');

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={C.title}
      description={`${title} · ${C.body}`}
      closeLabel={P.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {C.skip}
          </Button>
          <Button loading={busy} disabled={!valid} onClick={() => void add()}>
            {C.add}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Field label={C.amount}>
          <Input
            autoFocus
            inputMode="decimal"
            dir="ltr"
            textAlign="start"
            placeholder="₪"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, '').slice(0, 12))}
          />
        </Field>
        <Field label={C.category}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}

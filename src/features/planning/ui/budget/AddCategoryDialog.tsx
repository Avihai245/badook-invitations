'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog, Field, Input, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { parseAmount } from '../../model/budget-view';
import { CATEGORY_KEYS, type CategoryKey } from '../../model/categories';
import { usePlan } from '../PlanProvider';
import { MoneyField } from './MoneyField';
import { useBudget } from './useBudget';

/** "הוספת קטגוריה": a standard category that isn't in the budget yet (one tap), or one of the host's own. */
export function AddCategoryDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the new category's id, to open it */
  onAdded: (id: string) => void;
}) {
  const { t } = useUi();
  const T = t.planning.budget;
  const D = T.addDialog;
  const { toast } = useToast();
  const { view } = usePlan();
  const { saveCategory } = useBudget();
  const [name, setName] = useState('');
  const [planned, setPlanned] = useState('');
  const [tried, setTried] = useState(false);

  const used = new Set(view.categories.map((c) => c.key).filter(Boolean));
  const free = CATEGORY_KEYS.filter((k) => !used.has(k));
  const plannedValue = parseAmount(planned);

  const finish = (id: string) => {
    toast({ title: D.added, variant: 'success' });
    onAdded(id);
  };
  const addStandard = async (key: CategoryKey) => {
    const id = crypto.randomUUID();
    onOpenChange(false);
    if (await saveCategory({ id, key })) finish(id);
  };
  const addCustom = async () => {
    setTried(true);
    if (!name.trim() || plannedValue === undefined) return;
    const id = crypto.randomUUID();
    const draft = { id, name: name.trim(), plannedAmount: plannedValue ?? 0 };
    onOpenChange(false);
    setName('');
    setPlanned('');
    setTried(false);
    if (await saveCategory(draft)) finish(id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={D.title}
      description={D.body}
      closeLabel={t.planning.common.close}
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t.planning.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <section aria-label={D.standard} className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-semibold">{D.standard}</h3>
          {free.length === 0 ? (
            <p className="text-[13px] text-muted">{D.none}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {free.map((key) => (
                <li key={key}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-11"
                    icon={<Plus />}
                    onClick={() => void addStandard(key)}
                  >
                    {t.planning.categories[key]}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void addCustom();
          }}
          className="flex flex-col gap-3 border-t border-line pt-4"
        >
          <h3 className="text-[13px] font-semibold">{D.custom}</h3>
          <Field label={D.name} error={tried && !name.trim() ? D.nameMissing : undefined}>
            <Input
              value={name}
              maxLength={80}
              placeholder={D.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <MoneyField
            label={D.planned}
            value={planned}
            onChange={setPlanned}
            error={tried && plannedValue === undefined ? T.item.invalidAmount : undefined}
          />
          <div className="flex justify-end">
            <Button type="submit" icon={<Plus />}>
              {D.add}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

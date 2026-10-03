'use client';

import { useState } from 'react';
import { Button, Field, Select } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { categoryPlanned } from '../../model/budget';
import { parseAmount, amountText } from '../../model/budget-view';
import { COST_BASES, type CostBasis } from '../../model/categories';
import { readIntegrations } from '../../model/integrations';
import type { PlanCategory } from '../../model/plan';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { Fill } from './Fill';
import { MoneyField } from './MoneyField';
import { useBudget } from './useBudget';

/**
 * How a category's cost is set: a fixed amount, or a price per adult (with a price for each child), per
 * child, per guest or per table — and the guest numbers that price follows, so the host sees both. The
 * amount in force for a priced category is the server's (`view.totals.byCategory[].planned`); the preview
 * here is the same formula on what is typed.
 */
export function BasisEditor({
  category,
  planned,
  onDone,
}: {
  category: PlanCategory;
  /** the planned amount the server works out now */
  planned: number;
  onDone: () => void;
}) {
  const { t, plural, number } = useUi();
  const T = t.planning.budget;
  const E = T.basisEditor;
  const { view } = usePlan();
  const { saveCategory } = useBudget();
  const integrations = readIntegrations(view.settings?.integrations);
  const h = view.headcount;

  const [basis, setBasis] = useState<CostBasis>(category.costBasis);
  const [amount, setAmount] = useState(amountText(category.plannedAmount));
  const [unit, setUnit] = useState(amountText(category.unitPrice));
  const [child, setChild] = useState(amountText(category.childPrice));
  const [tried, setTried] = useState(false);

  const amountValue = parseAmount(amount);
  const unitValue = parseAmount(unit);
  const childValue = parseAmount(child);
  const perHead = basis !== 'fixed';
  const bad =
    (!perHead && typeof amountValue !== 'number') ||
    (perHead && (unitValue === undefined || (basis === 'per_adult' && childValue === undefined)));

  const preview = categoryPlanned(
    {
      costBasis: basis,
      plannedAmount: typeof amountValue === 'number' ? amountValue : category.plannedAmount,
      unitPrice: perHead && typeof unitValue === 'number' ? unitValue : null,
      childPrice: basis === 'per_adult' && typeof childValue === 'number' ? childValue : null,
    },
    h,
  );
  const dirty =
    basis !== category.costBasis ||
    (!perHead ? amountValue !== category.plannedAmount : unitValue !== category.unitPrice) ||
    (basis === 'per_adult' && (childValue ?? null) !== category.childPrice);

  const follows =
    basis === 'per_adult'
      ? `${plural(T.guests.adultsN, h.adults, { n: number(h.adults) })} · ${plural(T.guests.childrenN, h.children, { n: number(h.children) })}`
      : basis === 'per_child'
        ? plural(T.guests.childrenN, h.children, { n: number(h.children) })
        : basis === 'per_guest'
          ? plural(T.guests.guestsN, h.guests, { n: number(h.guests) })
          : plural(T.guests.tablesN, h.tables, { n: number(h.tables) });
  const notFollowing = basis === 'per_table' ? !integrations.seating : perHead && !integrations.guests;

  const save = () => {
    setTried(true);
    if (bad) return;
    void saveCategory({
      id: category.id,
      costBasis: basis,
      ...(perHead
        ? {
            unitPrice: typeof unitValue === 'number' ? unitValue : null,
            childPrice: basis === 'per_adult' && typeof childValue === 'number' ? childValue : null,
          }
        : { plannedAmount: typeof amountValue === 'number' ? amountValue : 0 }),
    });
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
      className="flex flex-col gap-3 rounded-btn bg-subtle p-3.5"
      aria-label={E.title}
    >
      <Field label={E.title}>
        <Select value={basis} onChange={(e) => setBasis(e.target.value as CostBasis)}>
          {COST_BASES.map((b) => (
            <option key={b} value={b}>
              {E.basis[b]}
            </option>
          ))}
        </Select>
      </Field>
      {!perHead ? (
        <MoneyField
          label={E.planned}
          value={amount}
          onChange={setAmount}
          error={tried && typeof amountValue !== 'number' ? E.invalid : undefined}
        />
      ) : (
        <>
          <div className={basis === 'per_adult' ? 'grid grid-cols-2 gap-3' : ''}>
            <MoneyField
              label={E.unit[basis]}
              value={unit}
              onChange={setUnit}
              error={tried && unitValue === undefined ? E.invalid : undefined}
            />
            {basis === 'per_adult' ? (
              <MoneyField
                label={E.childPrice}
                value={child}
                onChange={setChild}
                error={tried && childValue === undefined ? E.invalid : undefined}
              />
            ) : null}
          </div>
          <p className="text-[12.5px] text-muted">
            <Fill
              text={E.follows}
              vars={{ numbers: <strong className="font-semibold text-ink">{follows}</strong> }}
            />
          </p>
          {notFollowing ? (
            <p className="text-[12.5px] text-muted">
              {basis === 'per_table' ? E.notFollowingSeating : E.notFollowingGuests}
            </p>
          ) : null}
          {perHead && unitValue === null ? <p className="text-[12.5px] text-muted">{E.noPrice}</p> : null}
        </>
      )}
      <p className="text-[13px]" aria-live="polite">
        <Fill
          text={E.result}
          vars={{ amount: <Money value={dirty ? preview : planned} className="font-bold" /> }}
        />
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t.planning.common.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={!dirty}>
          {t.planning.common.save}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { ChevronDown, FlaskConical, RotateCcw } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button, Card, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { categoryPlanned, plannedTotal } from '../../model/budget';
import type { PlanCategory } from '../../model/plan';
import { BudgetGauge } from '../BudgetGauge';
import { Money } from '../Money';
import { usePlan } from '../PlanProvider';
import { Fill } from './Fill';

const PER_HEAD = new Set(['per_adult', 'per_guest', 'per_child']);

/** The category whose price of a plate the slider moves: the catering, else the first one priced per head. */
function plateCategory(cats: readonly PlanCategory[]): PlanCategory | null {
  const priced = cats.filter((c) => PER_HEAD.has(c.costBasis) && c.unitPrice !== null);
  return priced.find((c) => c.key === 'catering') ?? priced[0] ?? null;
}

/**
 * "What if": two sliders — the number of guests and the price of a plate — and what they would do to the planned
 * cost, with the same formula the database uses (model/budget categoryPlanned). Nothing is saved.
 */
export function WhatIf() {
  const { t, plural, number, fmt } = useUi();
  const T = t.planning.budget;
  const W = T.whatIf;
  const { view } = usePlan();
  const id = useId();
  const [open, setOpen] = useState(false);
  const h = view.headcount;
  const plate = useMemo(() => plateCategory(view.categories), [view.categories]);
  const [guests, setGuests] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);

  const baseGuests = h.guests;
  const nowGuests = guests ?? baseGuests;
  const basePrice = plate?.unitPrice ?? 0;
  const nowPrice = price ?? basePrice;
  const touched = nowGuests !== baseGuests || nowPrice !== basePrice;

  const name = (c: PlanCategory) => c.name ?? (c.key ? t.planning.categories[c.key] : '');
  const counts = {
    adults: Math.max(0, nowGuests - h.children),
    children: Math.min(h.children, nowGuests),
    tables: h.tables,
  };
  const before = useMemo(
    () =>
      view.categories.map((c) => ({
        c,
        planned: categoryPlanned(c, { adults: h.adults, children: h.children, tables: h.tables }),
      })),
    [view.categories, h.adults, h.children, h.tables],
  );
  const moved = view.categories.map((c) => (plate && c.id === plate.id ? { ...c, unitPrice: nowPrice } : c));
  const ifTotal = plannedTotal(moved, counts);
  const nowTotal = plannedTotal(view.categories, h);
  const diff = Math.round((ifTotal - nowTotal) * 100) / 100;
  const total = view.settings?.totalBudget ?? null;
  const against = total === null ? null : Math.round((total - ifTotal) * 100) / 100;
  const changed = moved
    .map((c) => ({
      c,
      was: before.find((n) => n.c.id === c.id)?.planned ?? 0,
      is: categoryPlanned(c, counts),
    }))
    .filter((r) => r.was !== r.is)
    .slice(0, 6);

  const reset = () => {
    setGuests(null);
    setPrice(null);
  };
  const guestMax = Math.max(50, Math.ceil((baseGuests * 2) / 10) * 10);
  const priceMax = Math.max(1000, Math.ceil((basePrice * 3) / 50) * 50);

  return (
    <Card data-testid="budget-whatif">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 rounded-card px-4 py-3 text-start"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-deep"
        >
          <FlaskConical className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{W.title}</span>
          <span className="block truncate text-[12.5px] text-muted">{W.hint}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-5 border-t border-line p-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-guests`}
              className="flex items-baseline justify-between gap-2 text-[13px] font-semibold"
            >
              {W.guests}
              <span className="font-bold tabular-nums">
                {plural(T.guests.guestsN, nowGuests, { n: number(nowGuests) })}
              </span>
            </label>
            <input
              id={`${id}-guests`}
              type="range"
              min={0}
              max={guestMax}
              step={1}
              value={nowGuests}
              onChange={(e) => setGuests(Number(e.target.value))}
              aria-valuetext={plural(T.guests.guestsN, nowGuests, { n: number(nowGuests) })}
              className="h-11 w-full accent-ink"
            />
          </div>
          {plate ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${id}-plate`}
                className="flex items-baseline justify-between gap-2 text-[13px] font-semibold"
              >
                <span>{fmt(W.plate, { category: name(plate) })}</span>
                <Money value={nowPrice} className="font-bold" />
              </label>
              <input
                id={`${id}-plate`}
                type="range"
                min={0}
                max={priceMax}
                step={5}
                value={nowPrice}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="h-11 w-full accent-ink"
              />
            </div>
          ) : (
            <p className="text-[12.5px] text-muted">{W.noPlate}</p>
          )}

          {/* the plan "if so" on the speedometer, moving with the sliders (the dashed needle: today's plan) */}
          {total !== null && total > 0 ? (
            <div className="flex flex-col items-center gap-1" data-testid="budget-whatif-gauge">
              <BudgetGauge size="md" total={total} committed={ifTotal} paid={0} planned={nowTotal} />
              <p className="text-center text-[12px] text-muted">{W.gaugeCaption}</p>
            </div>
          ) : null}
          <dl className="grid grid-cols-3 gap-3 rounded-btn bg-subtle p-3 text-[13px]">
            <div>
              <dt className="text-muted">{W.now}</dt>
              <dd className="mt-0.5 font-bold">
                <Money value={nowTotal} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">{W.ifLabel}</dt>
              <dd className="mt-0.5 font-bold">
                <Money value={ifTotal} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">{W.difference}</dt>
              <dd className="mt-0.5 font-bold">
                {diff > 0 ? '+' : ''}
                <Money value={diff} />
              </dd>
            </div>
          </dl>
          {touched && against !== null ? (
            <p
              className={cn(
                'rounded-btn px-3 py-2 text-[13px]',
                against < 0 ? 'bg-warning-bg text-warning' : 'bg-subtle text-ink/80',
              )}
              role="status"
            >
              <Fill
                text={against < 0 ? W.overTotal : W.underTotal}
                vars={{ amount: <Money value={Math.abs(against)} className="font-semibold" /> }}
              />
            </p>
          ) : null}
          {changed.length > 0 ? (
            <div>
              <h3 className="mb-1.5 text-[12.5px] font-semibold text-muted">{W.changed}</h3>
              <ul className="flex flex-col gap-1 text-[13px]">
                {changed.map(({ c, was, is }) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{name(c)}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      <Money value={was} /> → <Money value={is} className="font-semibold text-ink" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-muted">{W.nothingSaved}</p>
            <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={reset} disabled={!touched}>
              {W.reset}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

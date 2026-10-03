'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { parseAmount } from '../../model/budget-view';
import { readIntegrations } from '../../model/integrations';
import { usePlan } from '../PlanProvider';
import { CountField, MoneyField, parseCount } from './MoneyField';
import { useBudget } from './useBudget';

/**
 * "Setup in 30 seconds": the total budget and the guest numbers on one card, with one button. The guest
 * numbers are asked only when the budget doesn't follow the guest list (then they are the host's own).
 */
export function BudgetSetup({ onSkip }: { onSkip: () => void }) {
  const { t, plural, number } = useUi();
  const T = t.planning.budget;
  const { view } = usePlan();
  const { saveSettings } = useBudget();
  const settings = view.settings!;
  const integrations = readIntegrations(settings.integrations);
  const follows = integrations.guests && settings.guestBasis !== 'manual';
  const [total, setTotal] = useState('');
  const [adults, setAdults] = useState(String(view.headcount.adults));
  const [children, setChildren] = useState(String(view.headcount.children));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const totalValue = parseAmount(total);
  const adultsValue = parseCount(adults, 100_000);
  const childrenValue = parseCount(children, 100_000);
  const totalOk = typeof totalValue === 'number';
  const guestsOk = follows || (adultsValue !== undefined && childrenValue !== undefined);

  const submit = async () => {
    setTried(true);
    if (!totalOk || !guestsOk) return;
    setBusy(true);
    await saveSettings({
      totalBudget: totalValue,
      ...(follows ? {} : { manualAdults: adultsValue ?? 0, manualChildren: childrenValue ?? 0 }),
    });
    setBusy(false);
  };

  return (
    <Card padding="lg" className="mx-auto w-full max-w-[560px]" data-testid="budget-setup">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        <div>
          <h2 className="text-[18px] leading-snug font-bold">{T.setup.title}</h2>
          <p className="mt-1 text-[14px] text-muted">{T.setup.body}</p>
        </div>
        <MoneyField
          label={T.setup.total}
          value={total}
          onChange={setTotal}
          placeholder="50000"
          error={tried && !totalOk ? T.setup.totalInvalid : undefined}
          help={T.setup.totalHint}
        />
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-semibold">{T.setup.guests}</h3>
          {follows ? (
            <p className="rounded-btn bg-subtle px-3 py-2.5 text-[13.5px]">
              {T.setup.following}{' '}
              <strong className="font-semibold">
                {plural(T.guests.guestsN, view.headcount.guests, { n: number(view.headcount.guests) })}
              </strong>
            </p>
          ) : (
            <>
              {!integrations.guests ? (
                <p className="text-[12.5px] text-muted">{T.setup.notFollowing}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <CountField
                  label={T.guests.adults}
                  value={adults}
                  onChange={setAdults}
                  error={tried && adultsValue === undefined ? T.guests.invalid : undefined}
                />
                <CountField
                  label={T.guests.children}
                  value={children}
                  onChange={setChildren}
                  error={tried && childrenValue === undefined ? T.guests.invalid : undefined}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" fullWidth loading={busy}>
            {T.setup.cta}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-11 rounded-btn text-[13px] font-medium text-muted underline underline-offset-2 hover:text-ink"
          >
            {T.setup.skip}
          </button>
        </div>
      </form>
    </Card>
  );
}

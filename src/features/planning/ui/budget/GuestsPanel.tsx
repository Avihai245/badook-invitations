'use client';

import { ChevronDown, Users } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Card, Segmented, Switch, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { parseAmount } from '../../model/budget-view';
import { GUEST_BASES, VAT_MODES, type GuestBasis, type VatMode } from '../../model/categories';
import { readIntegrations } from '../../model/integrations';
import { usePlan } from '../PlanProvider';
import { CountField, MoneyField, parseCount } from './MoneyField';
import { useBudget } from './useBudget';

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/**
 * The numbers the costs follow, and the VAT: where the guest numbers come from (the list, the replies, or the
 * host's own), their own numbers when manual, how many tables, and how amounts were entered. Closed by default
 * with the numbers in its title; when the budget doesn't follow the guest list it says so, with the switch.
 */
export function GuestsPanel() {
  const { t, plural, number, fmt } = useUi();
  const T = t.planning.budget;
  const G = T.guests;
  const { view } = usePlan();
  const { saveSettings } = useBudget();
  const settings = view.settings!;
  const integrations = readIntegrations(settings.integrations);
  const h = view.headcount;
  const [open, setOpen] = useState(false);
  const id = useId();

  const [adults, setAdults] = useState(text(settings.manualAdults));
  const [children, setChildren] = useState(text(settings.manualChildren));
  const [tables, setTables] = useState(text(settings.manualTables));
  const [vatPct, setVatPct] = useState(text(settings.vatPct));
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  // what the server holds is what the fields show again after a save
  useEffect(() => setAdults(text(settings.manualAdults)), [settings.manualAdults]);
  useEffect(() => setChildren(text(settings.manualChildren)), [settings.manualChildren]);
  useEffect(() => setTables(text(settings.manualTables)), [settings.manualTables]);
  useEffect(() => setVatPct(text(settings.vatPct)), [settings.vatPct]);

  const basis: GuestBasis = integrations.guests ? settings.guestBasis : 'manual';
  const manual = h.basis === 'manual';

  const commitCount = (
    key: 'manualAdults' | 'manualChildren' | 'manualTables',
    value: string,
    max: number,
    current: number | null,
  ) => {
    const n = parseCount(value, max);
    setInvalid((x) => ({ ...x, [key]: n === undefined }));
    if (n === undefined || n === current) return;
    void saveSettings({ [key]: n });
  };
  const commitVat = () => {
    const n = parseAmount(vatPct);
    const bad = typeof n !== 'number' || n > 100;
    setInvalid((x) => ({ ...x, vatPct: bad }));
    if (!bad && n !== settings.vatPct) void saveSettings({ vatPct: n });
  };

  const summary = [
    plural(G.adultsN, h.adults, { n: number(h.adults) }),
    plural(G.childrenN, h.children, { n: number(h.children) }),
    plural(G.tablesN, h.tables, { n: number(h.tables) }),
  ].join(' · ');
  const source = !integrations.guests ? G.sourceManual : G.basis[basis];

  return (
    <Card data-testid="budget-guests">
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
          <Users className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{G.title}</span>
          <span className="block truncate text-[12.5px] text-muted">
            {fmt(G.summary, { numbers: summary, source })}
          </span>
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
          {!integrations.guests ? (
            <div className="rounded-btn bg-subtle px-3.5 py-3" role="note">
              <p className="text-[13.5px] font-semibold">{G.offTitle}</p>
              <p className="mt-0.5 text-[13px] text-muted">{G.offBody}</p>
            </div>
          ) : null}

          <section className="flex flex-col gap-2.5" aria-label={G.basisLabel}>
            <h3 className="text-[13px] font-semibold">{G.basisLabel}</h3>
            <Segmented
              label={G.basisLabel}
              value={basis}
              disabled={!integrations.guests}
              onValueChange={(next) => void saveSettings({ guestBasis: next })}
              options={GUEST_BASES.map((b) => ({ value: b, label: G.basis[b] }))}
              fullWidth
            />
            <p className="text-[12.5px] text-muted">{G.basisHelp[basis]}</p>
            {manual ? (
              <div className="grid grid-cols-2 gap-3">
                <CountField
                  label={G.adults}
                  value={adults}
                  onChange={setAdults}
                  onBlur={() => commitCount('manualAdults', adults, 100_000, settings.manualAdults)}
                  error={invalid.manualAdults ? G.invalid : undefined}
                />
                <CountField
                  label={G.children}
                  value={children}
                  onChange={setChildren}
                  onBlur={() => commitCount('manualChildren', children, 100_000, settings.manualChildren)}
                  error={invalid.manualChildren ? G.invalid : undefined}
                />
              </div>
            ) : (
              <p className="text-[13px]">
                {plural(G.adultsN, h.adults, { n: number(h.adults) })} ·{' '}
                {plural(G.childrenN, h.children, { n: number(h.children) })}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px]">{G.followGuests}</span>
              <Switch
                label={G.followGuests}
                checked={integrations.guests}
                onCheckedChange={(on) => void saveSettings({ integrations: { guests: on } })}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-line pt-4" aria-label={G.tables}>
            <h3 className="text-[13px] font-semibold">{G.tables}</h3>
            {integrations.seating ? (
              <p className="text-[13px]">
                {plural(G.tablesN, h.tables, { n: number(h.tables) })}{' '}
                <span className="text-muted">{G.tablesFollow}</span>
              </p>
            ) : (
              <>
                <p className="text-[12.5px] text-muted">{G.offSeating}</p>
                <CountField
                  label={G.tables}
                  value={tables}
                  onChange={setTables}
                  onBlur={() => commitCount('manualTables', tables, 10_000, settings.manualTables)}
                  error={invalid.manualTables ? G.invalid : undefined}
                  className="max-w-[200px]"
                />
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px]">{G.followSeating}</span>
              <Switch
                label={G.followSeating}
                checked={integrations.seating}
                onCheckedChange={(on) => void saveSettings({ integrations: { seating: on } })}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-line pt-4" aria-label={T.vat.title}>
            <h3 className="text-[13px] font-semibold">{T.vat.title}</h3>
            <Segmented<VatMode>
              label={T.vat.mode}
              value={settings.vatMode}
              onValueChange={(vatMode) => void saveSettings({ vatMode })}
              options={VAT_MODES.map((m) => ({ value: m, label: T.vat.modes[m] }))}
              fullWidth
            />
            <p className="text-[12.5px] text-muted">{T.vat.help[settings.vatMode]}</p>
            {settings.vatMode !== 'none' ? (
              <MoneyField
                label={T.vat.pct}
                value={vatPct}
                onChange={setVatPct}
                onBlur={commitVat}
                error={invalid.vatPct ? T.vat.pctInvalid : undefined}
                className="max-w-[200px]"
                placeholder="18"
                unit="%"
              />
            ) : null}
          </section>
        </div>
      ) : null}
    </Card>
  );
}

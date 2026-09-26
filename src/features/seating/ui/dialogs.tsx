'use client';

import { Accessibility, Check, Link2, Search, Trash2, Unlink2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Dialog, Field, IconButton, Input, Segmented, Select, Switch, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { sortKey } from '../export';
import {
  PREF_ZONES,
  unitCategory,
  unitSettings,
  type Plan,
  type Pref,
  type SeatingRule,
  type SeatingTable,
  type UnitInfo,
  type UnitSettings,
} from '../model';
import { samePair } from '../plan';

/** "Where do they sit?" — the tables with their free seats; one that is too small can't be picked. */
export function SeatPicker({
  unit,
  tables,
  occupancy,
  current,
  onPick,
  onClose,
}: {
  unit: UnitInfo;
  tables: readonly SeatingTable[];
  occupancy: ReadonlyMap<string, number>;
  current: string | null;
  onPick(tableId: string): void;
  onClose(): void;
}) {
  const { t, fmt, plural } = useUi();
  const p = t.seating.picker;
  const sorted = [...tables].sort((a, b) => a.number - b.number);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fmt(p.seatTitle, { name: unit.name })}
      description={plural(p.seatSubtitle, unit.seats)}
      closeLabel={t.common.close}
    >
      {sorted.length === 0 ? (
        <p className="text-[13px] text-muted">{p.noTables}</p>
      ) : (
        <ul
          className="grid max-h-[55dvh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
          data-testid="seat-picker"
        >
          {sorted.map((table) => {
            const here = table.id === current;
            const free = table.capacity - (occupancy.get(table.id) ?? 0);
            const fits = here || unit.seats <= free;
            return (
              <li key={table.id}>
                <button
                  type="button"
                  disabled={!fits}
                  aria-current={here || undefined}
                  onClick={() => onPick(table.id)}
                  data-table-choice={table.number}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-card border px-3 py-2.5 text-start transition-colors',
                    here
                      ? 'border-ink bg-subtle'
                      : fits
                        ? 'border-line bg-surface hover:border-ink/40 hover:bg-subtle'
                        : 'cursor-not-allowed border-line bg-canvas opacity-55',
                  )}
                >
                  <span className="text-[14px] font-bold">
                    {fmt(t.seating.print.table, { number: table.number })}
                    {table.label ? <span className="font-normal text-muted"> · {table.label}</span> : null}
                  </span>
                  <span className="text-[12px] text-muted">
                    {here ? p.here : free <= 0 ? p.freeNone : plural(p.free, free)}
                    {!fits ? ` · ${p.noRoom}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

/** "Who sits at table N?" — families without a seat; those that fit can be added one after another. */
export function AddGuestsPicker({
  table,
  seated,
  candidates,
  plan,
  onAdd,
  onClose,
}: {
  table: SeatingTable;
  seated: number;
  candidates: readonly UnitInfo[];
  plan: Plan;
  onAdd(unitId: string): void;
  onClose(): void;
}) {
  const { t, fmt, plural, locale } = useUi();
  const p = t.seating.picker;
  const [query, setQuery] = useState('');
  const free = table.capacity - seated;
  const collator = useMemo(() => new Intl.Collator(locale, { sensitivity: 'base' }), [locale]);
  const q = query.trim().toLowerCase();
  const list = candidates
    .filter((u) => !q || [u.name, ...u.people].some((x) => x.toLowerCase().includes(q)))
    .sort(
      (a, b) =>
        Number(b.seats <= free) - Number(a.seats <= free) ||
        collator.compare(sortKey(a.name), sortKey(b.name)),
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fmt(p.addTitle, { number: table.number })}
      description={free <= 0 ? p.addSubtitleFull : plural(p.addSubtitle, free)}
      closeLabel={t.common.close}
      footer={<Button onClick={onClose}>{t.seating.unit.done}</Button>}
    >
      <Input
        type="search"
        icon={<Search />}
        placeholder={t.seating.guests.search}
        aria-label={t.seating.guests.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {candidates.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">{p.nobodyLeft}</p>
      ) : (
        <ul
          className="mt-3 flex max-h-[45dvh] flex-col divide-y divide-line overflow-y-auto"
          data-testid="add-picker"
        >
          {list.map((u) => {
            const fits = u.seats <= free;
            const c = unitCategory(plan, u);
            return (
              <li key={u.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    <bdi>{u.name}</bdi>
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {plural(t.seating.guests.people, u.seats)}
                    {c ? ` · ${c}` : ''}
                    {!fits ? ` · ${p.tooMany}` : ''}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={fits ? 'secondary' : 'ghost'}
                  disabled={!fits}
                  onClick={() => onAdd(u.id)}
                  aria-label={`${t.seating.guests.seat}: ${u.name}`}
                >
                  {t.seating.guests.seat}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

/** A family's settings: its category, wishes about the stage / dance floor / exit, accessibility — and
 * its rules with other families. */
export function UnitDialog({
  unit,
  plan,
  units,
  onSettings,
  onAddRule,
  onRemoveRule,
  onClose,
}: {
  unit: UnitInfo;
  plan: Plan;
  units: readonly UnitInfo[];
  onSettings(patch: Partial<UnitSettings>): void;
  onAddRule(rule: Omit<SeatingRule, 'id'>): void;
  onRemoveRule(id: string): void;
  onClose(): void;
}) {
  const { t, fmt, plural, locale } = useUi();
  const u = t.seating.unit;
  const settings = unitSettings(plan, unit.id);
  const [kind, setKind] = useState<SeatingRule['kind']>('together');
  const [hard, setHard] = useState(true);
  const [other, setOther] = useState('');
  const names = useMemo(() => new Map(units.map((x) => [x.id, x.name])), [units]);
  const rules = plan.rules.filter((r) => r.a === unit.id || r.b === unit.id);
  const collator = useMemo(() => new Intl.Collator(locale, { sensitivity: 'base' }), [locale]);
  const others = units
    .filter((x) => x.id !== unit.id && x.status !== 'declined')
    .sort((a, b) => collator.compare(sortKey(a.name), sortKey(b.name)));
  const categories = [...new Set(units.map((x) => unitCategory(plan, x)).filter((c): c is string => !!c))];
  const setPref = (zone: (typeof PREF_ZONES)[number], v: Pref) =>
    onSettings({ prefs: { ...settings.prefs, [zone]: v } });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={unit.name}
      description={plural(t.seating.guests.people, unit.seats)}
      closeLabel={t.common.close}
      footer={<Button onClick={onClose}>{u.done}</Button>}
    >
      <div className="flex flex-col gap-4" data-testid="unit-dialog">
        <section>
          <h3 className="mb-1 text-[13px] font-bold">{u.peopleTitle}</h3>
          {unit.people.length ? (
            <p className="text-[13px] text-ink/80">{unit.people.join(' · ')}</p>
          ) : (
            <p className="text-[12.5px] text-muted">{fmt(u.noPeople, { seats: unit.seats })}</p>
          )}
        </section>

        <Field
          label={u.category}
          help={unit.group ? fmt(u.categoryHint, { group: unit.group }) : u.categoryHintNone}
        >
          <Input
            defaultValue={settings.category ?? ''}
            placeholder={unit.group ?? u.categoryPlaceholder}
            list="seating-categories"
            maxLength={60}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== settings.category) onSettings({ category: v });
            }}
          />
        </Field>
        <datalist id="seating-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <fieldset>
          <legend className="text-[13px] font-bold">{u.prefs}</legend>
          <p className="mb-2 text-[12px] text-muted">{u.prefsHint}</p>
          <div className="flex flex-col gap-2">
            {PREF_ZONES.map((zone) => (
              <div key={zone} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px]">{u.zones[zone]}</span>
                <Segmented
                  label={u.zones[zone]}
                  value={String(settings.prefs[zone])}
                  onValueChange={(v) => setPref(zone, Number(v) as Pref)}
                  options={[
                    { value: '1', label: u.near },
                    { value: '0', label: u.either },
                    { value: '-1', label: u.far },
                  ]}
                />
              </div>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px]">
            <Switch
              label={u.accessible}
              checked={settings.accessible}
              onCheckedChange={(accessible) => onSettings({ accessible })}
            />
            <Accessibility aria-hidden className="size-4 text-[#2563eb]" />
            {u.accessible}
          </label>
        </fieldset>

        <section>
          <h3 className="text-[13px] font-bold">{u.rulesTitle}</h3>
          {rules.length ? (
            <ul className="mt-1.5 flex flex-col divide-y divide-line">
              {rules.map((r) => {
                const otherId = r.a === unit.id ? r.b : r.a;
                return (
                  <li key={r.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                    {r.kind === 'together' ? (
                      <Link2 aria-hidden className="size-4 text-success" />
                    ) : (
                      <Unlink2 aria-hidden className="size-4 text-danger" />
                    )}
                    <span className="min-w-0 flex-1">
                      {r.kind === 'together' ? u.together : u.apart}{' '}
                      <bdi className="font-semibold">{names.get(otherId)}</bdi>{' '}
                      <span className="text-muted">({r.hard ? u.hard : u.soft})</span>
                    </span>
                    <IconButton label={u.remove} size="sm" onClick={() => onRemoveRule(r.id)}>
                      <Trash2 />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-muted">{u.noRules}</p>
          )}
          <div className="mt-2 flex flex-col gap-2 rounded-card border border-line bg-canvas p-2.5">
            <Segmented
              label={u.addRule}
              value={kind}
              onValueChange={setKind}
              options={[
                { value: 'together', label: u.together },
                { value: 'apart', label: u.apart },
              ]}
              fullWidth
            />
            <Select
              aria-label={u.other}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              data-testid="rule-other"
            >
              <option value="">{u.choose}</option>
              {others.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
            <div className="flex items-center justify-between gap-2">
              <Segmented
                label={u.hardHint}
                value={hard ? 'hard' : 'soft'}
                onValueChange={(v) => setHard(v === 'hard')}
                options={[
                  { value: 'hard', label: u.hard },
                  { value: 'soft', label: u.soft },
                ]}
              />
              <Button
                size="sm"
                icon={<Check />}
                disabled={!other}
                onClick={() => {
                  onAddRule({ kind, a: unit.id, b: other, hard });
                  setOther('');
                }}
              >
                {u.add}
              </Button>
            </div>
            <p className="text-[11.5px] text-muted">{u.hardHint}</p>
          </div>
        </section>
      </div>
    </Dialog>
  );
}

/** Every rule of the event, with a way to remove it. */
export function RulesDialog({
  rules,
  units,
  onRemove,
  onClose,
}: {
  rules: readonly SeatingRule[];
  units: readonly UnitInfo[];
  onRemove(id: string): void;
  onClose(): void;
}) {
  const { t, fmt } = useUi();
  const r = t.seating.rules;
  const names = new Map(units.map((u) => [u.id, u.name]));
  const shown = rules.filter((x, i) => rules.findIndex((y) => samePair(x, y)) === i);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={r.title}
      description={r.subtitle}
      closeLabel={t.common.close}
    >
      {shown.length ? (
        <ul
          className="flex max-h-[55dvh] flex-col divide-y divide-line overflow-y-auto"
          data-testid="rules-list"
        >
          {shown.map((x) => (
            <li key={x.id} className="flex items-center gap-2 py-2 text-[13px]">
              {x.kind === 'together' ? (
                <Link2 aria-hidden className="size-4 shrink-0 text-success" />
              ) : (
                <Unlink2 aria-hidden className="size-4 shrink-0 text-danger" />
              )}
              <span className="min-w-0 flex-1">
                {fmt(x.kind === 'together' ? r.together : r.apart, {
                  a: names.get(x.a) ?? '?',
                  b: names.get(x.b) ?? '?',
                })}{' '}
                <span className="text-muted">({x.hard ? r.hard : r.soft})</span>
              </span>
              <IconButton label={r.remove} size="sm" onClick={() => onRemove(x.id)}>
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">{r.empty}</p>
      )}
    </Dialog>
  );
}

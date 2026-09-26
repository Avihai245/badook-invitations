'use client';

import { Copy, Lock, LockOpen, Minus, Plus, RotateCcw, RotateCw, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Hint, IconButton, Input, Segmented, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import {
  LIMITS,
  TABLE_SHAPES,
  ZONES,
  type Landmark,
  type SeatingTable,
  type UnitInfo,
  type Zone,
} from '../model';
import type { TablePatch } from '../plan';

/** A number field that commits on Enter or when it loses focus (never a half-typed value). */
function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
  testId,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit(v: number): void;
  testId?: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n) && n >= min && n <= max && n !== value) onCommit(n);
    else setText(String(value));
  };
  return (
    <label className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <Input
        inputMode="decimal"
        dir="ltr"
        value={text}
        min={min}
        max={max}
        step={step}
        data-testid={testId}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        className="h-9 tabular-nums"
      />
    </label>
  );
}

function Panel({
  title,
  onClose,
  children,
  testId,
}: {
  title: ReactNode;
  onClose(): void;
  children: ReactNode;
  testId: string;
}) {
  const { t } = useUi();
  // The site's accessibility button floats at the middle of the screen's left edge: on a phone the panel
  // stays in the lower half (its close button would land right under that button), and on a tablet in
  // English (the panel on the left) it starts to the button's right. On a phone the support button
  // floats over the panel's bottom corner: the panel's end scrolls clear of it.
  return (
    <section
      aria-label={typeof title === 'string' ? title : undefined}
      data-testid={testId}
      className="absolute inset-x-2 bottom-2 z-10 max-h-[min(58%,calc(50dvh-40px))] overflow-y-auto overscroll-contain rounded-card border border-line bg-surface p-3 shadow-lg max-sm:pb-16 sm:inset-x-auto sm:start-3 sm:bottom-3 sm:max-h-[calc(100%-24px)] sm:w-[330px] sm:max-lg:ltr:start-[76px]"
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</h3>
        <IconButton label={t.seating.inspector.close} size="sm" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      {children}
    </section>
  );
}

/** The selected table: number, name, shape, seats, angle, what's near it, lock — and who sits there. */
export function TableInspector({
  table,
  seated,
  people,
  error,
  onPatch,
  onDuplicate,
  onRemove,
  onAddGuests,
  onUnseat,
  onClose,
}: {
  table: SeatingTable;
  seated: number;
  people: UnitInfo[];
  error: string | null;
  onPatch(patch: TablePatch): void;
  onDuplicate(): void;
  onRemove(): void;
  onAddGuests(): void;
  onUnseat(unitId: string): void;
  onClose(): void;
}) {
  const { t, fmt, plural } = useUi();
  const s = t.seating;
  const i = s.inspector;
  const toggleZone = (z: Zone) =>
    onPatch({ zones: table.zones.includes(z) ? table.zones.filter((x) => x !== z) : [...table.zones, z] });
  return (
    <Panel title={fmt(i.tableTitle, { number: table.number })} onClose={onClose} testId="table-inspector">
      <div className="grid grid-cols-[88px_1fr] gap-2">
        <NumberField
          label={i.number}
          value={table.number}
          min={1}
          max={LIMITS.number}
          onCommit={(n) => onPatch({ number: Math.round(n) })}
          testId="table-number"
        />
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold text-muted">{i.label}</span>
          <Input
            defaultValue={table.label ?? ''}
            key={`${table.id}-${table.label ?? ''}`}
            maxLength={LIMITS.label}
            placeholder={i.labelPlaceholder}
            onBlur={(e) =>
              e.target.value.trim() !== (table.label ?? '') && onPatch({ label: e.target.value })
            }
            className="h-9"
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-muted">{i.shape}</span>
        <Segmented
          label={i.shape}
          value={table.shape}
          onValueChange={(shape) => onPatch({ shape })}
          options={TABLE_SHAPES.map((v) => ({ value: v, label: s.toolbar.shapes[v] }))}
          fullWidth
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-muted" id={`cap-${table.id}`}>
            {i.capacity}
          </span>
          <div className="flex items-center gap-1" role="group" aria-labelledby={`cap-${table.id}`}>
            <IconButton
              label={i.fewer}
              size="sm"
              disabled={table.capacity <= Math.max(1, seated)}
              onClick={() => onPatch({ capacity: table.capacity - 1 })}
              className="border border-line"
            >
              <Minus />
            </IconButton>
            <span
              className="min-w-8 text-center text-[15px] font-bold tabular-nums"
              data-testid="table-capacity"
            >
              {table.capacity}
            </span>
            <IconButton
              label={i.more}
              size="sm"
              disabled={table.capacity >= LIMITS.capacity}
              onClick={() => onPatch({ capacity: table.capacity + 1 })}
              className="border border-line"
            >
              <Plus />
            </IconButton>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-muted" id={`rot-${table.id}`}>
            {i.rotation}
          </span>
          <div className="flex items-center gap-1" role="group" aria-labelledby={`rot-${table.id}`}>
            <IconButton
              label={i.rotateBack}
              size="sm"
              onClick={() => onPatch({ rotation: table.rotation - 15 })}
              className="border border-line"
            >
              <RotateCcw />
            </IconButton>
            <span className="min-w-10 text-center text-[13px] font-semibold tabular-nums" dir="ltr">
              {table.rotation}°
            </span>
            <IconButton
              label={i.rotateForward}
              size="sm"
              onClick={() => onPatch({ rotation: table.rotation + 15 })}
              className="border border-line"
            >
              <RotateCw />
            </IconButton>
          </div>
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1 text-[12px] font-semibold text-muted">{i.zonesLabel}</legend>
        <div className="flex flex-wrap gap-1.5">
          {ZONES.map((z) => (
            <Hint key={z} text={i.zonesHint}>
              <button
                type="button"
                aria-pressed={table.zones.includes(z)}
                onClick={() => toggleZone(z)}
                className="h-8 rounded-full border border-line bg-surface px-3 text-[12.5px] font-medium text-ink/80 hover:bg-subtle aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
              >
                {i.zones[z]}
              </button>
            </Hint>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Hint text={i.lockHint}>
          <Button
            size="sm"
            variant={table.locked ? 'primary' : 'secondary'}
            icon={table.locked ? <Lock /> : <LockOpen />}
            aria-pressed={table.locked}
            onClick={() => onPatch({ locked: !table.locked })}
            data-testid="lock-table"
          >
            {table.locked ? i.unlock : i.lock}
          </Button>
        </Hint>
        <Hint text={i.duplicateHint}>
          <Button size="sm" variant="ghost" icon={<Copy />} onClick={onDuplicate}>
            {i.duplicate}
          </Button>
        </Hint>
        <Hint text={i.removeHint}>
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 />}
            onClick={onRemove}
            className="text-danger hover:text-danger"
          >
            {i.remove}
          </Button>
        </Hint>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h4 className="text-[13px] font-bold">
            {i.seatedTitle}{' '}
            <span className="font-normal text-muted tabular-nums">
              ({seated}/{table.capacity})
            </span>
          </h4>
          <Button size="sm" icon={<UserPlus />} onClick={onAddGuests} data-testid="add-guests">
            {i.addGuests}
          </Button>
        </div>
        {people.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {people.map((u) => (
              <li key={u.id} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  <bdi>{u.name}</bdi>
                  <span className="ms-1.5 text-muted">· {plural(s.guests.people, u.seats)}</span>
                </span>
                <IconButton label={`${i.unseat}: ${u.name}`} size="sm" onClick={() => onUnseat(u.id)}>
                  <X />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-muted">{i.nobody}</p>
        )}
      </div>
    </Panel>
  );
}

/** The selected landmark: its text, size and angle. */
export function LandmarkInspector({
  landmark,
  onPatch,
  onRemove,
  onClose,
}: {
  landmark: Landmark;
  onPatch(patch: Partial<Omit<Landmark, 'id'>>): void;
  onRemove(): void;
  onClose(): void;
}) {
  const { t, fmt } = useUi();
  const s = t.seating;
  const i = s.inspector;
  const name = landmark.label || s.landmarks[landmark.kind];
  return (
    <Panel title={fmt(i.landmarkTitle, { label: name })} onClose={onClose} testId="landmark-inspector">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold text-muted">{i.landmarkLabel}</span>
        <Input
          defaultValue={landmark.label ?? ''}
          key={`${landmark.id}-${landmark.label ?? ''}`}
          maxLength={LIMITS.label}
          placeholder={s.landmarks[landmark.kind]}
          onBlur={(e) =>
            e.target.value.trim() !== (landmark.label ?? '') &&
            onPatch({ label: e.target.value.trim() || null })
          }
          className="h-9"
        />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumberField
          label={i.width}
          value={landmark.w}
          min={0.2}
          max={500}
          step={0.5}
          onCommit={(w) => onPatch({ w })}
        />
        <NumberField
          label={i.depth}
          value={landmark.h}
          min={0.2}
          max={500}
          step={0.5}
          onCommit={(h) => onPatch({ h })}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <IconButton
          label={i.rotateBack}
          size="sm"
          onClick={() => onPatch({ rotation: landmark.rotation - 15 })}
          className="border border-line"
        >
          <RotateCcw />
        </IconButton>
        <span className="min-w-10 text-center text-[13px] font-semibold tabular-nums" dir="ltr">
          {landmark.rotation}°
        </span>
        <IconButton
          label={i.rotateForward}
          size="sm"
          onClick={() => onPatch({ rotation: landmark.rotation + 15 })}
          className="border border-line"
        >
          <RotateCw />
        </IconButton>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 />}
          onClick={onRemove}
          className="ms-auto text-danger hover:text-danger"
        >
          {i.removeLandmark}
        </Button>
      </div>
    </Panel>
  );
}

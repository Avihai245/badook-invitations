'use client';

import { ArrowLeftRight, Combine, Minus, Plus, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, Checkbox, Dialog, Field, IconButton, Input, cn } from '@/components/app';
import { loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import { EVENT_DAY } from '../../config';
import { fits, liveSeats, type TableFill } from '../../live';
import type { Party, Told } from '../../model';
import { dayApi, type ReseatAnswer } from '../host-api';

/** What a family's move or a table's merge needs from the screen around it. */
export interface ReseatContext {
  id: string;
  fills: readonly TableFill[];
  released: boolean;
  told: Readonly<Record<string, Told>>;
  /** the event can tell guests their table (seating_guide) */
  canNotify: boolean;
  /** …from the system's number */
  notifyReady: boolean;
}

/** How many people a family checks in now: the rest of its seats (at least one), up to 99. */
export function ArriveDialog({
  party,
  onClose,
  onConfirm,
}: {
  party: Party;
  onClose(): void;
  onConfirm(count: number): Promise<boolean>;
}) {
  const { t, fmt, plural, number } = useUi();
  const a = t.eventDay.arrive;
  const [count, setCount] = useState(() =>
    Math.max(1, Math.min(EVENT_DAY.maxCount, party.seats - party.arrived)),
  );
  const [busy, setBusy] = useState(false);
  const set = (n: number) => setCount(Math.max(1, Math.min(EVENT_DAY.maxCount, n)));
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fmt(a.title, { name: party.name })}
      description={
        party.seats
          ? fmt(t.eventDay.sheet.arrived, { arrived: number(party.arrived), seats: number(party.seats) })
          : undefined
      }
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            icon={<UserCheck />}
            loading={busy}
            data-testid="arrive-confirm"
            onClick={async () => {
              setBusy(true);
              const done = await onConfirm(count);
              setBusy(false);
              if (done) onClose();
            }}
          >
            {plural(a.confirm, count, { n: number(count) })}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-[13px] font-semibold">{a.count}</p>
      <div className="flex items-center gap-3" role="group" aria-label={a.count}>
        <IconButton
          label={a.less}
          onClick={() => set(count - 1)}
          disabled={count <= 1}
          className="border border-line"
        >
          <Minus />
        </IconButton>
        <output className="min-w-[3ch] text-center text-[28px] font-bold tabular-nums" aria-live="polite">
          {number(count)}
        </output>
        <IconButton
          label={a.more}
          onClick={() => set(count + 1)}
          disabled={count >= EVENT_DAY.maxCount}
          className="border border-line"
        >
          <Plus />
        </IconButton>
      </div>
    </Dialog>
  );
}

/** The tables to pick from, each with its live seats out of its seats (too full: amber, still pickable). */
function TablePicker({
  fills,
  current,
  exclude,
  need,
  value,
  onChange,
}: {
  fills: readonly TableFill[];
  current: string | null;
  exclude?: string;
  need: number;
  value: string | null;
  onChange(id: string): void;
}) {
  const { t, fmt, number } = useUi();
  const list = fills.filter((f) => f.table.id !== exclude);
  if (!list.length) return <p className="text-[13px] text-muted">{t.eventDay.heat.noTables}</p>;
  return (
    <ul
      role="radiogroup"
      aria-label={t.eventDay.merge.pick}
      className="grid max-h-[40dvh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3"
      data-testid="live-table-picker"
    >
      {list.map((f) => {
        const here = f.table.id === current;
        const room = fits(f, need);
        const picked = value === f.table.id;
        return (
          <li key={f.table.id}>
            <button
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={here}
              onClick={() => onChange(f.table.id)}
              data-table-choice={f.table.number}
              className={cn(
                'flex w-full flex-col items-start gap-0.5 rounded-card border px-3 py-2 text-start transition-colors',
                here
                  ? 'cursor-not-allowed border-line bg-canvas opacity-60'
                  : picked
                    ? 'border-ink bg-subtle shadow-[inset_0_0_0_1px_var(--color-ink)]'
                    : 'border-line bg-surface hover:border-ink/40 hover:bg-subtle',
              )}
            >
              <span className="text-[14px] font-bold">
                {fmt(t.eventDay.tables.row, { number: f.table.number })}
                {f.table.label ? <span className="font-normal text-muted"> · {f.table.label}</span> : null}
              </span>
              <span
                className={cn(
                  'text-[12px] tabular-nums',
                  room || here ? 'text-muted' : 'font-semibold text-warning',
                )}
              >
                {here
                  ? t.eventDay.move.current
                  : fmt(t.eventDay.move.load, { load: number(f.load), capacity: number(f.table.capacity) })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type Full = { table: number; capacity: number; load: number; need: number };

/** The shared end of a move and a merge: why (optional), tell the families, "the table is full". */
function ReseatFields({
  ctx,
  reason,
  setReason,
  notify,
  setNotify,
  full,
}: {
  ctx: ReseatContext;
  reason: string;
  setReason(v: string): void;
  notify: boolean;
  setNotify(v: boolean): void;
  full: Full | null;
}) {
  const { t, fmt, number } = useUi();
  const m = t.eventDay.move;
  return (
    <>
      <Field label={m.reason} className="mt-4">
        <Input
          value={reason}
          maxLength={EVENT_DAY.reasonLength}
          placeholder={m.reasonPlaceholder}
          onChange={(e) => setReason(e.target.value)}
          data-testid="reseat-reason"
        />
      </Field>
      {ctx.canNotify ? (
        <div className="mt-3">
          <Checkbox checked={notify} onCheckedChange={setNotify} label={m.notify} />
          <p className="ms-6 text-[12px] text-muted">
            {ctx.notifyReady ? fmt(m.notifyWhatsapp, { brand: t.brand }) : m.notifyOwn}
          </p>
        </div>
      ) : null}
      {full ? (
        <p role="alert" className="mt-3 rounded-input bg-warning-bg px-3 py-2 text-[13px] text-warning">
          {fmt(m.full, {
            number: full.table,
            load: number(full.load),
            capacity: number(full.capacity),
            need: number(full.need),
          })}
        </p>
      ) : null}
    </>
  );
}

/** Runs a move or a merge: "full" comes back to be forced, other refusals as a message. */
function useReseat(onDone: (answer: ReseatAnswer, notify: boolean) => void) {
  const { t } = useUi();
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState<Full | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (call: () => ReturnType<typeof dayApi.move>, notify: boolean) => {
    setBusy(true);
    setError(null);
    const res = await call();
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    const body = res.body;
    if (res.ok && body?.change) return onDone(body, notify);
    if (body?.code === 'full')
      return setFull({
        table: body.table ?? 0,
        capacity: body.capacity ?? 0,
        load: body.load ?? 0,
        need: body.need ?? 0,
      });
    setError(t.eventDay.errors.failed);
  };
  return { busy, full, error, run, clearFull: () => setFull(null) };
}

/** Move a family to another table now (or seat one that has none). */
export function MoveDialog({
  ctx,
  party,
  onClose,
  onDone,
}: {
  ctx: ReseatContext;
  party: Party;
  onClose(): void;
  onDone(answer: ReseatAnswer, notify: boolean): void;
}) {
  const { t, fmt } = useUi();
  const m = t.eventDay.move;
  const [tableId, setTableId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(() => !!ctx.told[party.unitId]);
  const r = useReseat(onDone);
  const need = liveSeats(party.status === 'declined' ? 0 : party.seats, party.arrived, ctx.released);
  const go = (force: boolean) =>
    tableId &&
    void r.run(
      () =>
        dayApi.move(ctx.id, {
          unitId: party.unitId,
          tableId,
          reason: reason.trim() || undefined,
          force,
          notify: ctx.canNotify && notify,
        }),
      ctx.canNotify && notify,
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fmt(m.title, { name: party.name })}
      description={m.body}
      closeLabel={t.common.close}
      className="max-w-[620px]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {r.full ? (
            <Button variant="danger" loading={r.busy} onClick={() => go(true)} data-testid="reseat-force">
              {m.force}
            </Button>
          ) : (
            <Button
              icon={<ArrowLeftRight />}
              loading={r.busy}
              disabled={!tableId}
              onClick={() => go(false)}
              data-testid="move-confirm"
            >
              {m.confirm}
            </Button>
          )}
        </>
      }
    >
      <TablePicker
        fills={ctx.fills}
        current={party.table?.id ?? null}
        need={need}
        value={tableId}
        onChange={(v) => {
          setTableId(v);
          r.clearFull();
        }}
      />
      <ReseatFields
        ctx={ctx}
        reason={reason}
        setReason={setReason}
        notify={notify}
        setNotify={setNotify}
        full={r.full}
      />
      {r.error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {r.error}
        </p>
      ) : null}
    </Dialog>
  );
}

/** Merge a table into another: every family at it moves there. */
export function MergeDialog({
  ctx,
  from,
  into: initialInto = null,
  parties,
  onClose,
  onDone,
}: {
  ctx: ReseatContext;
  from: TableFill;
  into?: string | null;
  /** the families at `from` */
  parties: readonly Party[];
  onClose(): void;
  onDone(answer: ReseatAnswer, notify: boolean): void;
}) {
  const { t, fmt, plural, number } = useUi();
  const g = t.eventDay.merge;
  const [into, setInto] = useState<string | null>(initialInto);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(() => parties.some((p) => ctx.told[p.unitId]));
  const r = useReseat(onDone);
  const target = ctx.fills.find((f) => f.table.id === into) ?? null;
  const families = parties.filter((p) => p.seats > 0 || p.arrived > 0).length;
  const go = (force: boolean) =>
    into &&
    void r.run(
      () =>
        dayApi.merge(ctx.id, {
          from: from.table.id,
          into,
          reason: reason.trim() || undefined,
          force,
          notify: ctx.canNotify && notify,
        }),
      ctx.canNotify && notify,
    );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        target
          ? fmt(g.title, { from: from.table.number, into: target.table.number })
          : t.eventDay.sheet.mergeInto
      }
      description={
        target
          ? plural(g.body, families, {
              n: number(families),
              from: from.table.number,
              into: target.table.number,
            })
          : t.eventDay.sheet.mergeIntoHint
      }
      closeLabel={t.common.close}
      className="max-w-[620px]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {r.full ? (
            <Button variant="danger" loading={r.busy} onClick={() => go(true)} data-testid="reseat-force">
              {t.eventDay.move.force}
            </Button>
          ) : (
            <Button
              icon={<Combine />}
              loading={r.busy}
              disabled={!into}
              onClick={() => go(false)}
              data-testid="merge-confirm"
            >
              {g.confirm}
            </Button>
          )}
        </>
      }
    >
      <p className="mb-2 text-[13px] font-semibold">{g.pick}</p>
      <TablePicker
        fills={ctx.fills}
        current={null}
        exclude={from.table.id}
        need={from.load}
        value={into}
        onChange={(v) => {
          setInto(v);
          r.clearFull();
        }}
      />
      <ReseatFields
        ctx={ctx}
        reason={reason}
        setReason={setReason}
        notify={notify}
        setNotify={setNotify}
        full={r.full}
      />
      {r.error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {r.error}
        </p>
      ) : null}
    </Dialog>
  );
}

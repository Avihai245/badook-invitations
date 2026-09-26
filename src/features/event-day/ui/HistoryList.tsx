'use client';

import { ArrowLeftRight, Combine, Hash, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Checkbox, Dialog, Hint, useToast } from '@/components/app';
import { loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';
import type { SeatingChange, Told } from '../model';
import type { NotifyOutcome } from '../server/host-api';
import { dayApi } from './host-api';
import { movedIds } from './useNotifyOutcome';

type Ui = ReturnType<typeof useUi>;

/** A change in words: its headline, and a line per family or table when there is more than one. */
export function describeChange(
  c: SeatingChange,
  { t, fmt, plural, number }: Ui,
): { head: string; lines: string[] } {
  const h = t.eventDay.history;
  const moved = c.units.filter((u) => (u.from?.id ?? null) !== (u.to?.id ?? null));
  const unitLine = (u: SeatingChange['units'][number]) =>
    !u.to
      ? fmt(h.unseated, { name: u.name, from: u.from?.number ?? '' })
      : !u.from
        ? fmt(h.seated, { name: u.name, to: u.to.number })
        : plural(h.move, 1, { name: u.name, from: u.from.number, to: u.to.number });
  const lines = [
    ...moved.map(unitLine),
    ...c.tables.map((tb) => fmt(h.renumber, { from: tb.from, to: tb.to })),
  ];
  if (c.kind === 'merge' && !c.undoOf && moved[0]?.from && moved[0].to)
    return {
      head: fmt(h.merge, { from: moved[0].from.number, to: moved[0].to.number }),
      lines: moved.map(unitLine),
    };
  if (moved.length > 1) return { head: plural(h.move, moved.length, { n: number(moved.length) }), lines };
  return { head: lines[0] ?? '', lines: lines.slice(1) };
}

const ICON = { move: ArrowLeftRight, merge: Combine, renumber: Hash } as const;

/**
 * The seating's audit trail — every move and merge on the event day, and every change to families
 * already told their table — newest first, each with who-when-why and "undo" (asked first; the moved
 * families can get their table again). The live hall and the seating screen share it.
 */
export function HistoryList({
  id,
  changes,
  told,
  canNotify,
  notifyReady,
  onUndone,
  limit,
}: {
  id: string;
  changes: readonly SeatingChange[];
  told: Readonly<Record<string, Told>>;
  /** the event can tell guests their table (seating_guide) */
  canNotify: boolean;
  /** …from the system's number */
  notifyReady: boolean;
  onUndone(change: SeatingChange, notified: NotifyOutcome | null): void;
  /** show this many (a "show all" button for the rest) */
  limit?: number;
}) {
  const ui = useUi();
  const { t, fmt, date } = ui;
  const h = t.eventDay.history;
  const [all, setAll] = useState(false);
  const [undoing, setUndoing] = useState<SeatingChange | null>(null);
  if (!changes.length) return <p className="py-2 text-[13px] text-muted">{h.empty}</p>;
  const shown = limit && !all ? changes.slice(0, limit) : changes;
  const when = (at: string) =>
    date(at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <ol className="flex flex-col" data-testid="seating-history">
        {shown.map((c) => {
          const { head, lines } = describeChange(c, ui);
          const Icon = c.undoOf ? Undo2 : ICON[c.kind];
          const undoable = !c.undoneAt && !c.undoOf;
          return (
            <li
              key={c.id}
              className="flex items-start gap-3 border-b border-line py-3 last:border-b-0"
              data-change={c.kind}
              data-undone={c.undoneAt ? '' : undefined}
            >
              <span
                aria-hidden
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] bg-subtle text-ink [&_svg]:size-[15px]"
              >
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[13.5px] font-semibold ${c.undoneAt ? 'text-muted line-through' : ''}`}>
                  {head}
                </p>
                {lines.length ? (
                  <ul className="mt-1 grid gap-0.5 text-[12.5px] text-muted">
                    {lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                  <span>{when(c.at)}</span>
                  <span aria-hidden>·</span>
                  <span>{c.source === 'live' ? h.live : h.seating}</span>
                  {c.undoOf ? <Badge variant="neutral">{h.undoOf}</Badge> : null}
                  {c.undoneAt ? <Badge variant="draft">{h.undone}</Badge> : null}
                </p>
                {c.reason ? (
                  <p className="mt-1 text-[12.5px]">{fmt(h.reason, { reason: c.reason })}</p>
                ) : null}
              </div>
              {undoable ? (
                <Hint text={h.undoHint}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Undo2 className="icon-dir" />}
                    onClick={() => setUndoing(c)}
                    data-undo-change={c.id}
                  >
                    {h.undo}
                  </Button>
                </Hint>
              ) : null}
            </li>
          );
        })}
      </ol>
      {limit && changes.length > limit ? (
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => setAll((v) => !v)}>
          {all ? t.eventDay.history.showLess : fmt(t.eventDay.history.showAll, { n: changes.length })}
        </Button>
      ) : null}
      {undoing ? (
        <UndoDialog
          id={id}
          change={undoing}
          head={describeChange(undoing, ui).head}
          told={told}
          canNotify={canNotify}
          notifyReady={notifyReady}
          onClose={() => setUndoing(null)}
          onDone={(change, notified) => {
            setUndoing(null);
            onUndone(change, notified);
          }}
        />
      ) : null}
    </>
  );
}

function UndoDialog({
  id,
  change,
  head,
  told,
  canNotify,
  notifyReady,
  onClose,
  onDone,
}: {
  id: string;
  change: SeatingChange;
  head: string;
  told: Readonly<Record<string, Told>>;
  canNotify: boolean;
  notifyReady: boolean;
  onClose(): void;
  onDone(change: SeatingChange, notified: NotifyOutcome | null): void;
}) {
  const { t, fmt } = useUi();
  const h = t.eventDay.history;
  const { toast } = useToast();
  const moved = movedIds(change);
  // back where they were: the families moved by it that were told a number get it again
  const offerNotify = canNotify && change.units.length > 0;
  const [notify, setNotify] = useState(() => offerNotify && moved.some((u) => told[u]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; table?: number } | null>(null);

  const run = async (force: boolean) => {
    setBusy(true);
    const res = await dayApi.undoChange(id, change.id, { force, notify: offerNotify && notify });
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    const body = res.body;
    if (!res.ok || !body?.change) {
      const code = body?.code ?? 'failed';
      setError({ code, table: body?.table });
      return;
    }
    toast({ variant: 'success', title: h.undid });
    onDone(body.change, body.notified ?? null);
  };

  const message = error
    ? error.code === 'full'
      ? fmt(h.errors.full, { table: error.table ?? '' })
      : error.code === 'stale' || error.code === 'number_taken' || error.code === 'already'
        ? h.errors[error.code]
        : h.errors.failed
    : null;

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={h.confirmTitle}
      description={h.confirmBody}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {error?.code === 'full' ? (
            <Button variant="danger" loading={busy} onClick={() => void run(true)} data-testid="undo-force">
              {h.force}
            </Button>
          ) : (
            <Button
              icon={<Undo2 className="icon-dir" />}
              loading={busy}
              disabled={!!error && error.code !== 'failed'}
              onClick={() => void run(false)}
              data-testid="undo-confirm"
            >
              {h.undo}
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-3">
        <p className="rounded-input bg-subtle px-3 py-2 text-[13.5px] font-semibold">{head}</p>
        {offerNotify ? (
          <div>
            <Checkbox checked={notify} onCheckedChange={setNotify} label={h.notify} />
            <p className="ms-6 text-[12px] text-muted">
              {notifyReady
                ? fmt(t.eventDay.move.notifyWhatsapp, { brand: t.brand })
                : t.eventDay.move.notifyOwn}
            </p>
          </div>
        ) : null}
        {message ? (
          <p role="alert" className="rounded-input bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {message}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

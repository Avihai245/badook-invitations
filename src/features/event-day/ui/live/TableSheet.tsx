'use client';

import { ArrowLeftRight, Combine, UserCheck } from 'lucide-react';
import { Badge, Button, Drawer, Hint } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { TableFill } from '../../live';
import type { Party, Told } from '../../model';

/** A family on the live screen: who, how many arrived of its seats, what it was told; check in, move. */
export function PartyRow({
  party,
  told,
  showTable = false,
  onArrive,
  onMove,
}: {
  party: Party;
  told: Told | undefined;
  /** its table next to its name (the search's results) */
  showTable?: boolean;
  onArrive(): void;
  onMove(): void;
}) {
  const { t, fmt, number } = useUi();
  const s = t.eventDay.sheet;
  const declined = party.status === 'declined';
  const done = party.seats > 0 && party.arrived >= party.seats;
  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 last:border-b-0"
      data-party={party.name}
      data-arrived={party.arrived}
    >
      <div className="min-w-0 flex-1 basis-[180px]">
        <p className="truncate text-[14.5px] font-semibold">
          <bdi>{party.name}</bdi>
          {showTable ? (
            <span className="ms-2 text-[12.5px] font-normal text-muted">
              {party.table
                ? fmt(t.eventDay.tables.row, { number: party.table.number })
                : t.eventDay.tables.noTable}
            </span>
          ) : null}
        </p>
        {party.people.filter(Boolean).length ? (
          <p className="truncate text-[12px] text-muted">{party.people.filter(Boolean).join(', ')}</p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
          {declined && !party.arrived ? (
            <Badge variant="draft">{s.declined}</Badge>
          ) : party.arrived ? (
            <Badge variant={done ? 'live' : 'warning'}>
              {fmt(s.arrived, { arrived: number(party.arrived), seats: number(party.seats) })}
            </Badge>
          ) : (
            <Badge variant="neutral">
              {s.notYet}
              {party.seats ? ` · ${number(party.seats)}` : ''}
            </Badge>
          )}
          {told ? <span className="text-muted">{fmt(s.told, { number: told.number })}</span> : null}
          {party.phoneTail ? (
            <span className="text-muted" dir="ltr">
              {fmt(s.phone, { tail: party.phoneTail })}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Hint text={s.markArrivedHint}>
          <Button
            variant={done ? 'ghost' : 'secondary'}
            size="sm"
            icon={<UserCheck />}
            onClick={onArrive}
            data-arrive=""
          >
            {s.markArrived}
          </Button>
        </Hint>
        <Hint text={s.moveHint}>
          <Button variant="ghost" size="sm" icon={<ArrowLeftRight />} onClick={onMove} data-move="">
            {s.move}
          </Button>
        </Hint>
      </div>
    </li>
  );
}

/**
 * A table's sheet (tapped on the map or the list): its families, who arrived, check one in, move one,
 * or merge the whole table into another. `fill` null: the families coming without a table.
 */
export function TableSheet({
  fill,
  parties,
  told,
  onClose,
  onArrive,
  onMove,
  onMerge,
}: {
  fill: TableFill | null;
  parties: readonly Party[];
  told: Readonly<Record<string, Told>>;
  onClose(): void;
  onArrive(party: Party): void;
  onMove(party: Party): void;
  onMerge(fill: TableFill): void;
}) {
  const { t, fmt, number } = useUi();
  const s = t.eventDay.sheet;
  const list = [...parties].sort(
    (a, b) =>
      Number(a.status === 'declined') - Number(b.status === 'declined') || a.name.localeCompare(b.name),
  );
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      title={fill ? fmt(s.title, { number: fill.table.number }) : s.noTableTitle}
      description={
        fill
          ? (fill.table.label ? `${fill.table.label} · ` : '') +
            fmt(s.summary, {
              arrived: number(fill.arrived),
              expected: number(fill.expected),
              capacity: number(fill.table.capacity),
            })
          : s.noTableBody
      }
      closeLabel={s.close}
      footer={
        fill && list.length ? (
          <Hint text={s.mergeIntoHint}>
            <Button
              variant="secondary"
              icon={<Combine />}
              onClick={() => onMerge(fill)}
              data-testid="sheet-merge"
            >
              {s.mergeInto}
            </Button>
          </Hint>
        ) : undefined
      }
    >
      {list.length ? (
        <ul className="-mt-3" data-testid="table-sheet">
          {list.map((p) => (
            <PartyRow
              key={p.unitId}
              party={p}
              told={told[p.unitId]}
              onArrive={() => onArrive(p)}
              onMove={() => onMove(p)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted">{s.empty}</p>
      )}
    </Drawer>
  );
}

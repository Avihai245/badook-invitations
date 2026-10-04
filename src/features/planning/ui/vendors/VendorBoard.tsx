'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge, cn, type BadgeVariant } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { VendorStatus } from '../../model/categories';
import type { PlanVendor } from '../../model/plan';
import { STATUSES } from './helpers';
import { VendorCard } from './VendorCard';

export type StatusFilter = 'all' | VendorStatus;

interface BoardProps {
  vendors: PlanVendor[];
  filter: StatusFilter;
  selected: readonly string[];
  onToggleCompare: (id: string) => void;
  onOpen: (vendor: PlanVendor) => void;
  onMove: (vendor: PlanVendor, status: VendorStatus) => void;
  onClose: (vendor: PlanVendor) => void;
  onDelete: (vendor: PlanVendor) => void;
}

const TONE: Record<VendorStatus, BadgeVariant> = {
  idea: 'draft',
  contacted: 'info',
  quote: 'warning',
  booked: 'live',
  rejected: 'neutral',
};

const isStatus = (v: unknown): v is VendorStatus => STATUSES.includes(v as VendorStatus);

/** A column is where the pointer is; for the keyboard (no pointer) the column the dragged card overlaps most. */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : rectIntersection(args);
};

/**
 * The vendors by status. From a desktop's width: columns, a card moves between them by dragging its grip
 * (pointer or keyboard, with announcements for a screen reader) or by its menu; on a phone: a list grouped
 * by status, the same menu on each card.
 */
export function VendorBoard(props: BoardProps) {
  return (
    <>
      <div data-testid="vendors-columns" className="hidden lg:block">
        <Columns {...props} />
      </div>
      <div data-testid="vendors-groups" className="lg:hidden">
        <Groups {...props} />
      </div>
    </>
  );
}

function Columns({
  vendors,
  filter,
  selected,
  onToggleCompare,
  onOpen,
  onMove,
  onClose,
  onDelete,
}: BoardProps) {
  const { t, fmt, plural, number } = useUi();
  const V = t.planning.vendors;
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [active, setActive] = useState<string | null>(null);
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const nameOf = (id: string | number) => byId.get(String(id))?.name ?? '';
  const columnOf = (id: string | number) => (isStatus(id) ? V.statuses[id] : '');
  const dragged = active ? (byId.get(active) ?? null) : null;

  const announcements: Announcements = {
    onDragStart: ({ active }) => fmt(V.dnd.picked, { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? fmt(V.dnd.over, { name: nameOf(active.id), column: columnOf(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? fmt(V.dnd.dropped, { name: nameOf(active.id), column: columnOf(over.id) }) : undefined,
    onDragCancel: ({ active }) => fmt(V.dnd.cancelled, { name: nameOf(active.id) }),
  };
  const onDragStart = ({ active }: DragStartEvent) => setActive(String(active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    const vendor = byId.get(String(active.id));
    if (vendor && over && isStatus(over.id)) onMove(vendor, over.id);
  };

  const columns = filter === 'all' ? STATUSES : [filter];
  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: V.dnd.instructions },
        // its live region beside the page, not inside the columns
        container: typeof document === 'undefined' ? undefined : document.body,
      }}
    >
      <div
        role="group"
        aria-label={V.board.label}
        className={cn(
          'grid items-start gap-3',
          filter === 'all'
            ? 'lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,0.8fr)]'
            : 'max-w-[520px] lg:grid-cols-1',
        )}
      >
        {columns.map((status) => {
          const list = vendors.filter((v) => v.status === status);
          return (
            <Column
              key={status}
              status={status}
              label={V.statuses[status]}
              count={list.length}
              title={plural(V.board.column, list.length, {
                status: V.statuses[status],
                n: number(list.length),
              })}
            >
              {list.map((vendor) => (
                <DraggableCard
                  key={vendor.id}
                  vendor={vendor}
                  selected={selected.includes(vendor.id)}
                  dragging={active === vendor.id}
                  onToggleCompare={() => onToggleCompare(vendor.id)}
                  onOpen={() => onOpen(vendor)}
                  onMove={(s) => onMove(vendor, s)}
                  onClose={() => onClose(vendor)}
                  onDelete={() => onDelete(vendor)}
                />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged ? (
          <ul className="list-none">
            <VendorCard
              overlay
              vendor={dragged}
              selected={false}
              onToggleCompare={() => {}}
              onOpen={() => {}}
              onMove={() => {}}
              onClose={() => {}}
              onDelete={() => {}}
            />
          </ul>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  count,
  title,
  children,
}: {
  status: VendorStatus;
  label: string;
  count: number;
  title: string;
  children: React.ReactNode;
}) {
  const { t, number } = useUi();
  const B = t.planning.vendors.board;
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section aria-label={title} className="flex min-w-0 flex-col rounded-card bg-subtle p-2">
      <header className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
        <Badge variant={TONE[status]}>{label}</Badge>
        <span className="text-[13px] font-semibold text-muted tabular-nums">{number(count)}</span>
      </header>
      <ul
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-col gap-2 rounded-card p-1 transition-colors motion-reduce:transition-none',
          isOver && 'bg-brand-soft',
        )}
      >
        {count === 0 ? (
          <li className="grid min-h-20 place-items-center rounded-card border border-dashed border-line-strong px-3 text-center text-[13px] text-muted">
            {isOver ? B.emptyDrop : B.empty}
          </li>
        ) : (
          children
        )}
      </ul>
    </section>
  );
}

function DraggableCard({
  vendor,
  dragging,
  ...rest
}: Omit<Parameters<typeof VendorCard>[0], 'handle' | 'liRef' | 'overlay'>) {
  const { t, fmt } = useUi();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useDraggable({ id: vendor.id });
  return (
    <VendorCard
      vendor={vendor}
      dragging={dragging}
      liRef={setNodeRef}
      handle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={fmt(t.planning.vendors.card.drag, { name: vendor.name })}
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center self-center rounded-btn text-faint hover:bg-subtle hover:text-muted focus-visible:outline-2 focus-visible:outline-focus active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
      }
      {...rest}
    />
  );
}

/** The phone's version: one list per status, the statuses that have vendors (or the one being filtered). */
function Groups({
  vendors,
  filter,
  selected,
  onToggleCompare,
  onOpen,
  onMove,
  onClose,
  onDelete,
}: BoardProps) {
  const { t, plural, number } = useUi();
  const V = t.planning.vendors;
  const statuses = filter === 'all' ? STATUSES : [filter];
  return (
    <div role="group" aria-label={V.board.label} className="flex flex-col gap-5">
      {statuses.map((status) => {
        const list = vendors.filter((v) => v.status === status);
        if (list.length === 0 && filter === 'all') return null;
        return (
          <section
            key={status}
            aria-label={plural(V.board.column, list.length, {
              status: V.statuses[status],
              n: number(list.length),
            })}
          >
            <h2 className="mb-2 flex items-center gap-2 px-1">
              <Badge variant={TONE[status]}>{V.statuses[status]}</Badge>
              <span className="text-[13px] font-semibold text-muted tabular-nums">{number(list.length)}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {list.length === 0 ? (
                <li className="rounded-card border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-muted">
                  {V.board.empty}
                </li>
              ) : (
                list.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    selected={selected.includes(vendor.id)}
                    onToggleCompare={() => onToggleCompare(vendor.id)}
                    onOpen={() => onOpen(vendor)}
                    onMove={(s) => onMove(vendor, s)}
                    onClose={() => onClose(vendor)}
                    onDelete={() => onDelete(vendor)}
                  />
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

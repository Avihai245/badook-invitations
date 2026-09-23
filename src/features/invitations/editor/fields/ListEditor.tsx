'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { IconButton, Menu, cn } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { getAt, insertAt, moveAt, removeAt, uniqueId } from '../paths';
import { useEditor } from '../state/EditorProvider';

/**
 * A list inside a section form (venues, timeline, FAQ, gift links, RSVP questions…) — §9B.3-D:
 * collapsible cards with a grip (drag, or ⋯ → move up/down from the keyboard), a summary line and a
 * ⋯ menu (duplicate / delete); "+ add" at the bottom.
 */
export function ListEditor<T extends { id: string }>({
  path,
  summary,
  render,
  create,
  addLabel,
  max,
  min = 0,
  idBase = 'item',
  emptyText,
  hideAdd = false,
}: {
  /** document path of the array */
  path: string;
  summary: (item: T, index: number) => ReactNode;
  render: (item: T, index: number, itemPath: string) => ReactNode;
  create: (ids: string[]) => T;
  addLabel: string;
  max?: number;
  min?: number;
  idBase?: string;
  emptyText?: string;
  /** items are added elsewhere (e.g. gallery uploads) */
  hideAdd?: boolean;
}) {
  const { doc, apply, focusRequest } = useEditor();
  const { t } = useUi();
  const l = t.editor.list;
  const items = (getAt(doc, path) as T[] | undefined) ?? [];
  const [open, setOpen] = useState<Set<string>>(() => new Set(items.length === 1 ? [items[0]!.id] : []));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // a stable id: dnd-kit's own counter differs between the server render and hydration
  const dndId = useId();

  // A focus request inside an item (preview click, publish issue) opens that item.
  useEffect(() => {
    if (!focusRequest?.path.startsWith(`${path}.`)) return;
    const index = Number(focusRequest.path.slice(path.length + 1).split('.')[0]);
    const item = items[index];
    if (item) setOpen((s) => (s.has(item.id) ? s : new Set(s).add(item.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new request arrives
  }, [focusRequest]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const add = () => {
    const item = create(items.map((i) => i.id));
    apply((d) => insertAt(d, path, item), null);
    setOpen((s) => new Set(s).add(item.id));
  };
  const duplicate = (index: number) => {
    const source = items[index]!;
    const copy = {
      ...structuredClone(source),
      id: uniqueId(
        idBase,
        items.map((i) => i.id),
      ),
    };
    apply((d) => insertAt(d, path, copy, index + 1), null);
    setOpen((s) => new Set(s).add(copy.id));
  };
  const move = (from: number, to: number) => apply((d) => moveAt(d, path, from, to), null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  };
  const full = max !== undefined && items.length >= max;

  return (
    <div className="flex flex-col gap-2">
      {items.length ? (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {items.map((item, index) => (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  summary={summary(item, index) || fmt(l.item, { n: index + 1 })}
                  open={open.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  menu={[
                    ...(index > 0
                      ? [{ label: l.moveUp, icon: <ArrowUp />, onSelect: () => move(index, index - 1) }]
                      : []),
                    ...(index < items.length - 1
                      ? [{ label: l.moveDown, icon: <ArrowDown />, onSelect: () => move(index, index + 1) }]
                      : []),
                    ...(full
                      ? []
                      : [{ label: l.duplicate, icon: <Copy />, onSelect: () => duplicate(index) }]),
                    ...(items.length > min
                      ? [
                          { type: 'separator' as const },
                          {
                            label: l.delete,
                            icon: <Trash2 />,
                            danger: true,
                            onSelect: () => apply((d) => removeAt(d, `${path}.${index}`), null),
                          },
                        ]
                      : []),
                  ]}
                >
                  {render(item, index, `${path}.${index}`)}
                </SortableItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="rounded-card border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">
          {emptyText ?? l.empty}
        </p>
      )}
      {hideAdd ? null : (
        <button
          type="button"
          onClick={add}
          disabled={full}
          className="flex h-9 items-center justify-center gap-1.5 rounded-btn border border-dashed border-line-strong text-[13px] font-semibold text-muted hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden size={15} strokeWidth={1.75} />
          {full ? fmt(l.max, { max: max! }) : addLabel}
        </button>
      )}
    </div>
  );
}

function SortableItem({
  id,
  summary,
  open,
  onToggle,
  menu,
  children,
}: {
  id: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  menu: Parameters<typeof Menu>[0]['items'];
  children: ReactNode;
}) {
  const { t } = useUi();
  const l = t.editor.list;
  const bodyId = useId();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('rounded-card border border-line bg-surface', isDragging && 'relative z-10 shadow-lg')}
    >
      <div className="flex h-11 items-center gap-1.5 ps-1.5 pe-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={l.drag}
          className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-[6px] text-faint hover:bg-subtle hover:text-muted active:cursor-grabbing"
        >
          <GripVertical aria-hidden size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-start text-[14px] font-medium"
        >
          <span className="min-w-0 flex-1 truncate">{summary}</span>
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
          />
        </button>
        <Menu
          trigger={
            <IconButton label={l.menu} size="sm">
              <MoreHorizontal />
            </IconButton>
          }
          items={menu}
        />
      </div>
      <div id={bodyId} hidden={!open} className="border-t border-line px-3 pt-3 pb-4">
        {open ? <div className="flex flex-col gap-3.5">{children}</div> : null}
      </div>
    </li>
  );
}

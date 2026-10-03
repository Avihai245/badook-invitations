'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CircleDollarSign,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Sparkles,
  Star,
  Store,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, cn, IconButton, Menu, type MenuItem } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { dueText, toneClass } from '../format';
import type { TaskView } from '../../model/plan';
import { SYSTEM_HREF } from '../../model/system-tasks';
import { isDone } from '../../model/week';

export interface RowProps {
  task: TaskView;
  /** the name to show: the task's own, its template's, or the system task's */
  title: string;
  notes: string | null;
  today: string;
  invitationId: string;
  /** the name of the task's vendor, when it has one */
  vendor: string | null;
  sortable: boolean;
  /** this row can move up / down within its group */
  canUp: boolean;
  canDown: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onHide: () => void;
  onUnhide: () => void;
  onDelete: () => void;
  onMove: (by: -1 | 1) => void;
  googleHref: string | null;
}

/**
 * One task: a round tick (44px to hit), its name (opens the details), when it is due, the few things
 * worth saying about it, the system task's "Do it" button, and the ⋯ menu. A task the app ticked by itself
 * can't be ticked by hand; a hidden one offers to come back.
 */
export function TaskRow(p: RowProps) {
  const { t, plural, number, date } = useUi();
  const R = t.planning.tasks.row;
  const { task } = p;
  const done = isDone(task);
  const hidden = task.status === 'skipped';
  const auto = task.derived === true;
  const due = dueText({ t, plural, number, date } as never, p.today, task.dueDate);
  const system = task.systemKey !== null;
  const href = task.systemKey ? SYSTEM_HREF[task.systemKey] : null;

  const sortable = useSortable({ id: task.id, disabled: !p.sortable });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  const items: MenuItem[] = [
    { label: R.details, icon: <Pencil />, onSelect: p.onOpen },
    ...(p.canUp ? [{ label: R.moveUp, icon: <ArrowUp />, onSelect: () => p.onMove(-1) }] : []),
    ...(p.canDown ? [{ label: R.moveDown, icon: <ArrowDown />, onSelect: () => p.onMove(1) }] : []),
    ...(p.googleHref
      ? [{ label: R.calendar, icon: <Calendar />, href: p.googleHref, external: true } satisfies MenuItem]
      : []),
    { type: 'separator' },
    hidden
      ? { label: R.unhide, icon: <RotateCcw />, onSelect: p.onUnhide }
      : { label: R.hide, icon: <EyeOff />, onSelect: p.onHide },
    ...(system
      ? []
      : [{ label: R.delete, icon: <Trash2 />, danger: true, onSelect: p.onDelete } satisfies MenuItem]),
  ];

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      data-task={task.id}
      data-done={done ? '' : undefined}
      className={cn(
        'group flex items-start gap-1 rounded-card border border-line bg-surface px-1.5 py-1 sm:gap-2 sm:px-2',
        sortable.isDragging && 'relative z-10 shadow-md',
        hidden && 'opacity-70',
      )}
    >
      {p.sortable ? (
        <button
          type="button"
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={R.drag}
          title={R.drag}
          className="mt-1.5 grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-btn text-faint hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-brand active:cursor-grabbing max-sm:hidden"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : null}

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? R.reopen : R.complete}
        disabled={auto || hidden}
        onClick={p.onToggle}
        className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-6 place-items-center rounded-full border-2 transition-colors motion-reduce:transition-none',
            done
              ? 'border-success bg-success text-white dark:text-success-bg'
              : 'border-line-strong bg-surface group-hover:border-brand',
          )}
        >
          {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      </button>

      <div className="min-w-0 flex-1 py-2">
        <button
          type="button"
          onClick={p.onOpen}
          className={cn(
            'block max-w-full text-start text-[15px] leading-snug font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-brand',
            done && 'text-muted line-through decoration-1',
          )}
        >
          <bdi>{p.title}</bdi>
        </button>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px]">
          {task.dueDate ? (
            <span className={cn('font-medium', done ? 'text-muted' : toneClass[due.tone])}>
              {due.tone === 'later' ? R.due.replace('{date}', due.text) : due.text}
            </span>
          ) : null}
          {task.priority === 1 && !done ? (
            <Badge variant="warning" icon={<Star aria-hidden />}>
              {R.important}
            </Badge>
          ) : null}
          {system ? (
            <Badge variant="info" icon={<Sparkles aria-hidden />}>
              {auto ? R.autoDone : R.auto}
            </Badge>
          ) : null}
          {task.budgetItemId ? (
            <span className="inline-flex items-center gap-1 text-muted">
              <CircleDollarSign aria-hidden className="size-3.5" />
              {R.cost}
            </span>
          ) : null}
          {p.vendor ? (
            <span className="inline-flex items-center gap-1 text-muted">
              <Store aria-hidden className="size-3.5" />
              <bdi>{p.vendor}</bdi>
            </span>
          ) : null}
          {task.assignee ? (
            <span className="text-muted">
              {R.assignedTo.replace('{name}', task.assignee === 'me' ? t.planning.tasks.me : task.assignee)}
            </span>
          ) : null}
        </p>
        {p.notes && !done ? <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{p.notes}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1 py-1.5">
        {system && href && !done && !hidden ? (
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/app/invitations/${p.invitationId}${href}`}>{R.doIt}</Link>
          </Button>
        ) : null}
        <Menu
          trigger={
            <IconButton label={R.actions} size="md">
              <MoreHorizontal />
            </IconButton>
          }
          items={items}
        />
      </div>
    </li>
  );
}

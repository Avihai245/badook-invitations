'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CalendarPlus, ChevronDown, EyeOff, ListChecks, Plus, Sparkles, Calendar, List } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Button, cn, EmptyState, Input, Menu, Segmented } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { googleTaskUrl } from '../model/calendar';
import type { TaskView } from '../model/plan';
import { readIntegrations } from '../model/integrations';
import { systemText } from '../model/system-text';
import { taskNotes, taskTitle } from '../model/task-text';
import {
  CHIPS,
  filterTasks,
  flatList,
  groupByCategory,
  groupTimeline,
  isSuggested,
  moveId,
  type Chip,
} from '../model/tasks-view';
import { isDone } from '../model/week';
import { PlanFrame, ToolHelp } from './PlanFrame';
import { usePlan } from './PlanProvider';
import { CostPrompt } from './tasks/CostPrompt';
import { SuggestPanel } from './tasks/SuggestPanel';
import { TaskDrawer } from './tasks/TaskDrawer';
import { TaskRow } from './tasks/TaskRow';
import { useTaskActions } from './tasks/useTaskActions';

type Mode = 'timeline' | 'category' | 'list';

interface Group {
  key: string;
  label: string;
  tasks: TaskView[];
  /** done tasks: not draggable */
  done?: boolean;
  /** the timeline's far end (later, done): collapsed until asked for, with its count */
  collapsible?: boolean;
}

/**
 * The tasks tool: the plan's tasks as a timeline (overdue, this week, this month, later), by category or
 * as a list; chips to focus on what needs attention now, mine, those with a cost, and the hidden ones; a
 * line to add a task with Enter; ticking with Undo; dragging to reorder; details in a drawer; and the
 * plan's system tasks, which the invitation ticks by itself and which have a "Do it" button.
 */
export function TasksScreen() {
  const { t, fmt, number, locale } = useUi();
  const P = t.planning;
  const T = P.tasks;
  const plan = usePlan();
  const { view } = plan;
  const actions = useTaskActions();
  const [mode, setMode] = useState<Mode>('timeline');
  const [chips, setChips] = useState<ReadonlySet<Chip>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [costFor, setCostFor] = useState<TaskView | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const confirmed = useMemo(
    () => ({ adults: view.headcount.confirmedAdults, children: view.headcount.confirmedChildren }),
    [view.headcount.confirmedAdults, view.headcount.confirmedChildren],
  );
  const nameOf = useCallback(
    (task: TaskView) =>
      taskTitle(task, view.settings, locale) ??
      (task.systemKey ? systemText(t, task.systemKey, confirmed).title : ''),
    [view.settings, locale, t, confirmed],
  );
  const notesOf = useCallback(
    (task: TaskView) =>
      taskNotes(task, view.settings, locale) ??
      (task.systemKey ? systemText(t, task.systemKey, confirmed).body : null),
    [view.settings, locale, t, confirmed],
  );

  const integrations = readIntegrations(view.settings?.integrations);
  const suggested = view.tasks.filter(isSuggested);
  const filtered = useMemo(() => filterTasks(view.tasks, chips, view.today), [view.tasks, chips, view.today]);
  const filtering = chips.size > 0;

  const groups: Group[] = useMemo(() => {
    if (mode === 'timeline')
      return groupTimeline(filtered, view.today).map((g) => ({
        key: g.key,
        label: T.groups[g.key],
        tasks: g.tasks,
        done: g.key === 'done',
        // a year-long plan is mostly "later": it waits behind its count
        collapsible: g.key === 'done' || g.key === 'later',
      }));
    if (mode === 'category')
      return groupByCategory(filtered).map((g) => ({
        key: g.key ?? 'none',
        label: g.key ? P.categories[g.key] : T.groups.noCategory,
        tasks: g.tasks,
      }));
    return filtered.length ? [{ key: 'all', label: '', tasks: flatList(filtered) }] : [];
  }, [mode, filtered, view.today, T.groups, P.categories]);

  const sortable = !chips.has('hidden');
  const vendorName = (task: TaskView) =>
    task.vendorId ? (view.vendors.find((v) => v.id === task.vendorId)?.name ?? null) : null;
  const open = view.tasks.find((x) => x.id === openId) ?? null;

  const toggle = async (task: TaskView) => {
    if (isDone(task)) return void actions.reopen(task);
    const ok = await actions.complete(task);
    // a task with a cost, when the plan follows its tasks: how much was it?
    if (
      ok &&
      integrations.tasks &&
      view.categories.length > 0 &&
      !task.systemKey &&
      task.category &&
      !task.budgetItemId
    )
      setCostFor(task);
  };

  const onDragEnd = (group: Group) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = group.tasks.map((x) => x.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from >= 0 && to >= 0) void actions.reorder(ids, arrayMove(ids, from, to));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft;
    setDraft('');
    if (!(await actions.add(title))) setDraft(title);
    input.current?.focus();
  };

  const toggleChip = (chip: Chip) =>
    setChips((s) => {
      const next = new Set(s);
      if (!next.delete(chip)) next.add(chip);
      return next;
    });

  const hasDates = view.tasks.some((x) => x.dueDate && !isDone(x) && x.status !== 'skipped');
  const help = (
    <ToolHelp
      title={T.help.title}
      items={[
        { icon: <List />, label: T.help.items.views.label, text: T.help.items.views.text },
        { icon: <Sparkles />, label: T.help.items.auto.label, text: T.help.items.auto.text },
        { icon: <Calendar />, label: T.help.items.dates.label, text: T.help.items.dates.text },
        { icon: <EyeOff />, label: T.help.items.hide.label, text: T.help.items.hide.text },
        { icon: <CalendarPlus />, label: T.help.items.calendar.label, text: T.help.items.calendar.text },
      ]}
    />
  );

  return (
    <PlanFrame
      tool="tasks"
      title={T.title}
      description={T.subtitle}
      help={help}
      actions={
        <>
          <Menu
            trigger={
              <Button variant="secondary" icon={<CalendarPlus />}>
                {T.calendar.button}
              </Button>
            }
            items={[
              hasDates
                ? {
                    label: T.calendar.download,
                    icon: <CalendarPlus />,
                    href: `/api/invitations/${plan.id}/planning/calendar`,
                    external: true,
                  }
                : { label: T.calendar.nothing, disabled: true },
            ]}
          />
          <Button icon={<Plus />} onClick={() => input.current?.focus()} className="max-sm:hidden">
            {T.add.label}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="flex gap-2">
        <Input
          ref={input}
          value={draft}
          maxLength={200}
          placeholder={T.add.placeholder}
          aria-label={T.add.label}
          onChange={(e) => setDraft(e.target.value)}
          enterKeyHint="done"
        />
        <Button type="submit" icon={<Plus />} disabled={!draft.trim()}>
          {T.add.button}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented
          label={T.views.label}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'timeline', label: T.views.timeline },
            { value: 'category', label: T.views.category },
            { value: 'list', label: T.views.list },
          ]}
        />
        <div role="group" aria-label={T.chips.label} className="flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              aria-pressed={chips.has(chip)}
              onClick={() => toggleChip(chip)}
              className={cn(
                'min-h-11 rounded-full px-3.5 text-[13.5px] font-semibold ring-1 transition-colors motion-reduce:transition-none',
                chips.has(chip)
                  ? 'bg-inverse text-white ring-inverse'
                  : 'bg-surface text-ink/75 ring-line hover:bg-subtle hover:text-ink',
              )}
            >
              {T.chips[chip]}
            </button>
          ))}
        </div>
      </div>

      {!chips.has('hidden') ? (
        <SuggestPanel
          tasks={suggested}
          nameOf={nameOf}
          onHide={(task) => void actions.hide(task)}
          onKeep={(task) => void actions.update(task, { suggestHide: false })}
          onHideAll={() => void actions.hideMany(suggested.map((x) => x.id))}
        />
      ) : null}

      {view.tasks.length === 0 ? (
        <EmptyState
          illustration={<ListChecks aria-hidden className="size-10 text-muted" />}
          title={T.empty.title}
          description={T.empty.body}
          action={
            <Button icon={<Plus />} onClick={() => input.current?.focus()}>
              {T.add.label}
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title={T.empty.filtered}
          action={
            filtering ? (
              <Button variant="secondary" onClick={() => setChips(new Set())}>
                {T.empty.clear}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => {
            // a filter asks to see what matches: nothing stays folded
            const collapsed = !!group.collapsible && !expanded.has(group.key) && !filtering;
            const ids = group.tasks.map((x) => x.id);
            return (
              <section key={group.key} aria-label={group.label || T.views.list} data-group={group.key}>
                {group.label ? (
                  group.collapsible ? (
                    <h2 className="mb-2">
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        onClick={() =>
                          setExpanded((s) => {
                            const next = new Set(s);
                            if (!next.delete(group.key)) next.add(group.key);
                            return next;
                          })
                        }
                        className="flex min-h-11 items-center gap-2 text-[14.5px] font-bold"
                      >
                        <ChevronDown
                          aria-hidden
                          className={cn(
                            'size-4 transition-transform motion-reduce:transition-none',
                            collapsed && '-rotate-90 rtl:rotate-90',
                          )}
                        />
                        {group.label}
                        <span className="rounded-full bg-subtle px-2 text-[12px] leading-5 text-muted tabular-nums">
                          {number(group.tasks.length)}
                        </span>
                      </button>
                    </h2>
                  ) : (
                    <h2 className="mb-2 flex items-center gap-2 text-[14.5px] font-bold">
                      <bdi>{group.label}</bdi>
                      <span className="rounded-full bg-subtle px-2 text-[12px] leading-5 font-semibold text-muted tabular-nums">
                        {number(group.tasks.length)}
                      </span>
                    </h2>
                  )
                ) : null}
                {collapsed ? null : (
                  <DndContext
                    id={`${dndId}-${group.key}`}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd(group)}
                  >
                    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                      <ul className="flex flex-col gap-2">
                        {group.tasks.map((task, i) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            title={nameOf(task)}
                            notes={notesOf(task)}
                            today={view.today}
                            invitationId={plan.id}
                            vendor={vendorName(task)}
                            sortable={sortable && !group.done}
                            canUp={i > 0}
                            canDown={i < group.tasks.length - 1}
                            onToggle={() => void toggle(task)}
                            onOpen={() => setOpenId(task.id)}
                            onHide={() => void actions.hide(task)}
                            onUnhide={() => void actions.unhide(task)}
                            onDelete={() => void actions.remove(task)}
                            onMove={(by) => void actions.reorder(ids, moveId(ids, task.id, by))}
                            googleHref={
                              task.dueDate && !isDone(task)
                                ? googleTaskUrl({
                                    title: nameOf(task),
                                    notes: notesOf(task),
                                    dueDate: task.dueDate,
                                  })
                                : null
                            }
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </section>
            );
          })}
        </div>
      )}

      <TaskDrawer
        open={open !== null}
        task={open}
        title={open ? nameOf(open) : ''}
        onClose={() => setOpenId(null)}
        onSave={(task, change) => actions.update(task, change)}
        onDelete={(task) => void actions.remove(task)}
      />
      <CostPrompt task={costFor} title={costFor ? nameOf(costFor) : ''} onClose={() => setCostFor(null)} />
      <p className="sr-only" aria-live="polite">
        {fmt(P.overview.tasks.progress, {
          done: number(view.tasks.filter(isDone).length),
          total: number(view.tasks.filter((x) => x.status !== 'skipped').length),
        })}
      </p>
    </PlanFrame>
  );
}

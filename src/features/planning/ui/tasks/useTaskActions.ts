'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { PlanTask, TaskView } from '../../model/plan';
import { reorderWithin } from '../../model/tasks-view';
import { usePlan } from '../PlanProvider';

/** The fields a save may carry (the route's TaskPatch). */
export type TaskChange = Partial<
  Pick<
    PlanTask,
    | 'title'
    | 'notes'
    | 'dueDate'
    | 'status'
    | 'category'
    | 'priority'
    | 'assignee'
    | 'budgetItemId'
    | 'vendorId'
    | 'suggestHide'
    | 'sort'
  >
>;

/**
 * Every change to the tasks, optimistic: the screen changes at once, the server follows, a failure puts
 * the task back and says so, and the changes worth taking back come with an Undo.
 */
export function useTaskActions() {
  const plan = usePlan();
  const { toast } = useToast();
  const { t } = useUi();
  const P = t.planning;
  const T = P.tasks;

  const failed = useCallback(
    () => toast({ title: P.common.failed, variant: 'danger' }),
    [toast, P.common.failed],
  );

  const setTask = useCallback(
    (id: string, patch: Partial<TaskView>) =>
      plan.patch((v) => ({ ...v, tasks: v.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    [plan],
  );

  /** Saves a change to one task. True when it went through. */
  const update = useCallback(
    async (task: TaskView, change: TaskChange): Promise<boolean> => {
      setTask(task.id, change);
      const res = await plan.call<{ task?: PlanTask }>('/tasks', {
        op: 'save',
        task: { id: task.id, ...change },
      });
      if (!res.ok || !res.body?.task) {
        setTask(task.id, task);
        failed();
        return false;
      }
      // the server's word on what it stored (the time it was done, the dates it kept)
      setTask(task.id, res.body.task);
      return true;
    },
    [plan, setTask, failed],
  );

  const undoable = useCallback(
    (title: string, undo: () => void) =>
      toast({
        title,
        variant: 'success',
        action: { label: P.common.undo, altText: P.common.undo, onClick: undo },
      }),
    [toast, P.common.undo],
  );

  const complete = useCallback(
    async (task: TaskView) => {
      const before = task.status;
      if (!(await update(task, { status: 'done' }))) return false;
      undoable(T.toast.done, () => void update({ ...task, status: 'done' }, { status: before }));
      return true;
    },
    [update, undoable, T.toast.done],
  );

  const reopen = useCallback(
    async (task: TaskView) => {
      if (await update(task, { status: 'todo' })) toast({ title: T.toast.reopened });
    },
    [update, toast, T.toast.reopened],
  );

  const hide = useCallback(
    async (task: TaskView) => {
      const before = task.status;
      if (!(await update(task, { status: 'skipped', suggestHide: false }))) return;
      undoable(
        T.toast.hidden,
        () => void update({ ...task, status: 'skipped' }, { status: before, suggestHide: task.suggestHide }),
      );
    },
    [update, undoable, T.toast.hidden],
  );

  const unhide = useCallback(
    async (task: TaskView) => {
      if (await update(task, { status: 'todo' })) toast({ title: T.toast.unhidden });
    },
    [update, toast, T.toast.unhidden],
  );

  const add = useCallback(
    async (title: string, extra: TaskChange = {}) => {
      const clean = title.trim();
      if (!clean) return false;
      const id = crypto.randomUUID();
      const sort = Math.max(0, ...plan.view.tasks.map((x) => x.sort)) + 10;
      const draft: TaskView = {
        id,
        title: clean,
        notes: null,
        dueDate: null,
        dueIsManual: extra.dueDate ? true : false,
        offsetDays: null,
        status: 'todo',
        category: null,
        priority: 0,
        assignee: null,
        budgetItemId: null,
        vendorId: null,
        systemKey: null,
        tplKey: null,
        suggestHide: false,
        completedAt: null,
        sort,
        derived: null,
        ...extra,
      };
      plan.patch((v) => ({ ...v, tasks: [...v.tasks, draft] }));
      const res = await plan.call<{ task?: PlanTask }>('/tasks', {
        op: 'save',
        task: { id, title: clean, sort, ...extra },
      });
      if (!res.ok || !res.body?.task) {
        plan.patch((v) => ({ ...v, tasks: v.tasks.filter((x) => x.id !== id) }));
        failed();
        return false;
      }
      setTask(id, res.body.task);
      return true;
    },
    [plan, setTask, failed],
  );

  const remove = useCallback(
    async (task: TaskView) => {
      plan.patch((v) => ({ ...v, tasks: v.tasks.filter((x) => x.id !== task.id) }));
      const res = await plan.call('/tasks', { op: 'delete', ids: [task.id] });
      if (!res.ok) {
        plan.patch((v) => ({ ...v, tasks: [...v.tasks, task] }));
        failed();
        return;
      }
      undoable(T.toast.deleted, () => {
        plan.patch((v) => ({ ...v, tasks: [...v.tasks, task] }));
        void plan
          .call<{ task?: PlanTask }>('/tasks', {
            op: 'save',
            task: {
              id: task.id,
              title: task.title ?? undefined,
              notes: task.notes,
              dueDate: task.dueDate,
              dueIsManual: task.dueIsManual,
              status: task.status,
              category: task.category,
              priority: task.priority,
              assignee: task.assignee,
              vendorId: task.vendorId,
              budgetItemId: task.budgetItemId,
              sort: task.sort,
            },
          })
          .then((r) => {
            if (!r.ok) {
              plan.patch((v) => ({ ...v, tasks: v.tasks.filter((x) => x.id !== task.id) }));
              failed();
            } else toast({ title: T.toast.restored });
          });
      });
    },
    [plan, failed, undoable, toast, T.toast.deleted, T.toast.restored],
  );

  /** After a drag: `moved` is the group's new order; the whole list keeps every other task where it was. */
  const reorder = useCallback(
    async (group: readonly string[], moved: readonly string[]) => {
      const order = reorderWithin(plan.view.tasks, group, moved);
      const pos = new Map(order.map((id, i) => [id, (i + 1) * 10]));
      plan.patch((v) => ({ ...v, tasks: v.tasks.map((x) => ({ ...x, sort: pos.get(x.id) ?? x.sort })) }));
      const res = await plan.call('/tasks', { op: 'reorder', ids: order });
      if (!res.ok) {
        failed();
        void plan.refresh();
      }
    },
    [plan, failed],
  );

  const hideMany = useCallback(
    async (ids: string[]) => {
      const set = new Set(ids);
      plan.patch((v) => ({
        ...v,
        tasks: v.tasks.map((x) => (set.has(x.id) ? { ...x, status: 'skipped', suggestHide: false } : x)),
      }));
      const res = await plan.call('/tasks', {
        op: 'bulk',
        ids,
        patch: { status: 'skipped', suggestHide: false },
      });
      if (!res.ok) {
        failed();
        void plan.refresh();
        return;
      }
      toast({ title: T.suggest.hiddenAll, variant: 'success' });
    },
    [plan, failed, toast, T.suggest.hiddenAll],
  );

  return { update, complete, reopen, hide, unhide, add, remove, reorder, hideMany, setTask };
}

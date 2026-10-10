'use client';

import { EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { TaskView } from '../../model/plan';

/**
 * Tasks the plan offers to hide — with the time that is left they may no longer apply. One line above
 * the list, never in its way: how many, why, "go over them" (a dialog: each one to hide or keep) and
 * "hide them all".
 */
export function SuggestPanel({
  tasks,
  nameOf,
  onHide,
  onKeep,
  onHideAll,
}: {
  tasks: TaskView[];
  nameOf: (task: TaskView) => string;
  onHide: (task: TaskView) => void;
  onKeep: (task: TaskView) => void;
  onHideAll: () => void;
}) {
  const { t, fmt, plural, number } = useUi();
  const S = t.planning.tasks.suggest;
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;
  return (
    <>
      <div
        data-testid="suggest-banner"
        className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-surface px-4 py-3"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-muted"
        >
          <EyeOff className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-[13.5px]">
          <span className="font-bold">{plural(S.banner, tasks.length, { n: number(tasks.length) })}</span>{' '}
          <span className="text-muted">{S.body}</span>
        </p>
        <span className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog">
            {S.review}
          </Button>
          {tasks.length > 1 ? (
            <Button size="sm" variant="ghost" onClick={onHideAll}>
              {fmt(S.hideAll, { n: number(tasks.length) })}
            </Button>
          ) : null}
        </span>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={S.chip}
        description={S.body}
        closeLabel={t.common.close}
        footer={
          tasks.length > 1 ? (
            <Button
              variant="secondary"
              onClick={() => {
                onHideAll();
                setOpen(false);
              }}
            >
              {fmt(S.hideAll, { n: number(tasks.length) })}
            </Button>
          ) : undefined
        }
      >
        <ul className="flex max-h-[55dvh] flex-col gap-1.5 overflow-y-auto">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-subtle px-3 py-2"
            >
              <bdi className="min-w-0 flex-1 text-[14px] font-medium">{nameOf(task)}</bdi>
              <span className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onHide(task)}>
                  {S.hide}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onKeep(task)}>
                  {S.keep}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

'use client';

import { Button, Card } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { TaskView } from '../../model/plan';

/**
 * Tasks the plan offers to hide — with the time that is left they may no longer apply. Each is one tap
 * to hide or keep; one more hides them all. They wait here rather than in the list so the list stays
 * the host's own.
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
  const { t, fmt, number } = useUi();
  const S = t.planning.tasks.suggest;
  if (tasks.length === 0) return null;
  return (
    <Card tone="info" padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14.5px] font-bold">{S.chip}</h2>
          <p className="text-[13px] text-muted">{S.body}</p>
        </div>
        {tasks.length > 1 ? (
          <Button size="sm" variant="secondary" onClick={onHideAll}>
            {fmt(S.hideAll, { n: number(tasks.length) })}
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-surface px-3 py-2"
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
    </Card>
  );
}

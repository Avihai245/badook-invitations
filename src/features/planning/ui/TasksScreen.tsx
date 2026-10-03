'use client';

import { useUi } from '@/lib/i18n/client';
import { PlanFrame } from './PlanFrame';

/** PLACEHOLDER — the Tasks screen, replaced by its tool. */
export function TasksScreen() {
  const { t } = useUi();
  const T = t.planning.tasks;
  return (
    <PlanFrame tool="tasks" title={T.title} description={T.subtitle}>
      <p className="text-muted">…</p>
    </PlanFrame>
  );
}

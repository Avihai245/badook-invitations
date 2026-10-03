'use client';

import { useUi } from '@/lib/i18n/client';
import { PlanFrame } from './PlanFrame';

/** PLACEHOLDER — the Budget screen, replaced by its tool. */
export function BudgetScreen() {
  const { t } = useUi();
  const T = t.planning.budget;
  return (
    <PlanFrame tool="budget" title={T.title} description={T.subtitle}>
      <p className="text-muted">…</p>
    </PlanFrame>
  );
}

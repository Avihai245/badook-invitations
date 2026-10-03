'use client';

import { useUi } from '@/lib/i18n/client';
import { PlanFrame } from './PlanFrame';

/** PLACEHOLDER — the PlanOverview screen, replaced by its tool. */
export function PlanOverviewScreen() {
  const { t } = useUi();
  const T = t.planning;
  return (
    <PlanFrame tool="overview" title={T.title} description={T.subtitle}>
      <p className="text-muted">…</p>
    </PlanFrame>
  );
}

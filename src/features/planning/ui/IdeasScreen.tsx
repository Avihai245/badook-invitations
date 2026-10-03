'use client';

import { useUi } from '@/lib/i18n/client';
import { PlanFrame } from './PlanFrame';

/** PLACEHOLDER — the Ideas screen, replaced by its tool. */
export function IdeasScreen() {
  const { t } = useUi();
  const T = t.planning.ideas;
  return (
    <PlanFrame tool="ideas" title={T.title} description={T.subtitle}>
      <p className="text-muted">…</p>
    </PlanFrame>
  );
}

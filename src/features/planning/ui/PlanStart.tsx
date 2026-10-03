'use client';

import { useUi } from '@/lib/i18n/client';
import { PlanFrame } from './PlanFrame';

/**
 * /plan before the plan exists: the planning's first run (PlanFrame shows the onboarding while there
 * are no settings). Once it is set up, /plan leads to the event's home, where the one next step lives.
 */
export function PlanStart() {
  const { t } = useUi();
  return (
    <PlanFrame tool="overview" title={t.planning.title} description={t.planning.subtitle}>
      {null}
    </PlanFrame>
  );
}

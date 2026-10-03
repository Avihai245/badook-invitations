'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUi } from '@/lib/i18n/client';
import { PlanFrame } from './PlanFrame';
import { usePlan } from './PlanProvider';

/**
 * /plan before the plan exists: the planning's first run (PlanFrame shows the onboarding while there
 * are no settings). Once it is set up — here or meanwhile — the event's home takes over, where the one
 * next step and this week's tasks live.
 */
export function PlanStart() {
  const { t } = useUi();
  const router = useRouter();
  const plan = usePlan();
  const planned = !!plan.view.settings;
  useEffect(() => {
    if (planned) router.replace(`/app/invitations/${plan.id}`);
  }, [planned, plan.id, router]);
  return (
    <PlanFrame tool="overview" title={t.planning.title} description={t.planning.subtitle}>
      {null}
    </PlanFrame>
  );
}

'use client';

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
  const plan = usePlan();
  const planned = !!plan.view.settings;
  useEffect(() => {
    if (!planned) return;
    // a full load, once: the event's frame (kept across its screens by the router) shows the planning
    // only once there is a plan, so it is drawn anew
    window.location.replace(`/app/invitations/${plan.id}`);
  }, [planned, plan.id]);
  return (
    <PlanFrame tool="overview" title={t.planning.title} description={t.planning.subtitle}>
      {null}
    </PlanFrame>
  );
}

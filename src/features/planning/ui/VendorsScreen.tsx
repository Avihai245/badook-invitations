'use client';

import { useUi } from '@/lib/i18n/client';
import { PlanFrame } from './PlanFrame';

/** PLACEHOLDER — the Vendors screen, replaced by its tool. */
export function VendorsScreen() {
  const { t } = useUi();
  const T = t.planning.vendors;
  return (
    <PlanFrame tool="vendors" title={T.title} description={T.subtitle}>
      <p className="text-muted">…</p>
    </PlanFrame>
  );
}

'use client';

import { Download, Lock } from 'lucide-react';
import Link from 'next/link';
import { Button, Card } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { usePlan } from '../PlanProvider';

/** The Excel export: a button when the package has it (Pro), else a soft locked card with the way to Pro. */
export function ExportButton() {
  const { t } = useUi();
  const { id, view } = usePlan();
  if (!view.features.export) return null;
  return (
    <Button asChild variant="secondary" icon={<Download />} data-testid="budget-export">
      <a href={`/api/invitations/${id}/planning/budget/export`} download>
        {t.planning.budget.export.button}
      </a>
    </Button>
  );
}

export function ExportLocked() {
  const { t } = useUi();
  const E = t.planning.budget.export;
  const { view } = usePlan();
  if (view.features.export) return null;
  return (
    <Card tone="info" padding="md" data-testid="budget-export-locked">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface text-info"
        >
          <Lock className="size-4" />
        </span>
        <div className="min-w-0 flex-1 basis-[240px]">
          <p className="text-[14px] font-bold text-info">{E.locked.title}</p>
          <p className="mt-0.5 text-[13px] text-ink/80">{E.locked.body}</p>
        </div>
        <Button asChild variant="secondary" className="max-sm:w-full">
          <Link href="/app/billing?plan=pro">{E.locked.cta}</Link>
        </Button>
      </div>
    </Card>
  );
}

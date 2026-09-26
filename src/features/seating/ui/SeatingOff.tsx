'use client';

import { Armchair, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, EmptyState, useToast } from '@/components/app';
import { hostApi } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';

/**
 * Seating isn't on for this event: the host switched it off (a button switches it back on), or the
 * owner's package doesn't include it (the package that does, and the way to the plans).
 */
export function SeatingOff({
  id,
  reason,
  packageName,
  planName,
}: {
  id: string;
  reason: 'switched_off' | 'plan';
  packageName: string;
  planName: string;
}) {
  const { t, fmt } = useUi();
  const o = t.seating.off;
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (reason === 'plan')
    return (
      <EmptyState
        className="py-16"
        titleAs="h1"
        illustration={<Armchair aria-hidden className="size-14 text-brand" strokeWidth={1.4} />}
        title={o.planTitle}
        description={fmt(o.planBody, { package: packageName, plan: planName })}
        action={
          <Button icon={<Sparkles />} asChild>
            <Link href="/app/billing" data-testid="upgrade-link">
              {o.planCta}
            </Link>
          </Button>
        }
      />
    );
  return (
    <EmptyState
      className="py-16"
      titleAs="h1"
      illustration={<Armchair aria-hidden className="size-14 text-faint" strokeWidth={1.4} />}
      title={o.title}
      description={o.body}
      action={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const res = await hostApi(`/api/invitations/${id}/features`, {
              method: 'PATCH',
              body: { feature: 'seating', off: false },
            });
            if (res.ok) {
              // A full load, not router.refresh(): the page turns into the whole editor and the tab row
              // gains its tab, and an in-place refresh of that streamed page sometimes never landed
              // (the notice stayed on screen). The button keeps spinning until the editor opens.
              window.location.reload();
              return;
            }
            setBusy(false);
            toast({ variant: 'danger', title: t.common.error });
          }}
        >
          {o.turnOn}
        </Button>
      }
    />
  );
}

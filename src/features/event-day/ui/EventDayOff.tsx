'use client';

import { DoorOpen, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, EmptyState, Hint, useToast } from '@/components/app';
import { hostApi } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';

/**
 * The event day isn't on for this event: the owner's package doesn't include it (the package that
 * does, and the way to the plans), or the host switched it off (a button switches it back on).
 */
export function EventDayOff({
  id,
  reason,
  packageName,
  plan,
}: {
  id: string;
  reason: 'switched_off' | 'plan';
  packageName: string;
  plan: string;
}) {
  const { t, fmt } = useUi();
  const o = t.eventDay.off;
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (reason === 'plan')
    return (
      <EmptyState
        className="py-16"
        titleAs="h1"
        illustration={<DoorOpen aria-hidden className="size-14 text-brand" strokeWidth={1.4} />}
        title={fmt(o.title, { package: packageName })}
        description={o.body}
        action={
          <Hint text={o.body}>
            <Button icon={<Sparkles />} asChild>
              <Link href={`/app/billing?plan=${plan}`} data-testid="upgrade-link">
                {o.cta}
              </Link>
            </Button>
          </Hint>
        }
      />
    );
  return (
    <EmptyState
      className="py-16"
      titleAs="h1"
      illustration={<DoorOpen aria-hidden className="size-14 text-faint" strokeWidth={1.4} />}
      title={o.switchedOff}
      description={o.body}
      action={
        <Hint text={o.turnOnHint}>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const res = await hostApi(`/api/invitations/${id}/features`, {
                method: 'PATCH',
                body: { feature: 'checkin', off: false },
              });
              if (res.ok) {
                // a full load: the tab row gains its tab and the page turns into the live hall
                window.location.reload();
                return;
              }
              setBusy(false);
              toast({ variant: 'danger', title: t.common.error });
            }}
          >
            {o.turnOn}
          </Button>
        </Hint>
      }
    />
  );
}

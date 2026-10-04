'use client';

import { ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, EmptyState, useToast } from '@/components/app';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { useUi } from '@/lib/i18n/client';

/** Planning is switched off for the event: a way to switch it back on (nothing was deleted). */
export function PlanOff({ id }: { id: string }) {
  const { t } = useUi();
  const O = t.planning.off;
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const turnOn = async () => {
    setBusy(true);
    const res = await hostApi(`/api/invitations/${id}/features`, {
      method: 'PATCH',
      body: { feature: 'planning', off: false },
    });
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ title: t.common.error, variant: 'danger' });
    toast({ title: O.switchedOn, variant: 'success' });
    router.refresh();
  };
  return (
    <div className="mx-auto max-w-[1760px] px-4 pt-10 pb-16 sm:px-6">
      <EmptyState
        illustration={<ClipboardList aria-hidden className="size-10 text-muted" />}
        title={O.title}
        description={O.body}
        action={
          <Button loading={busy} onClick={() => void turnOn()}>
            {O.turnOn}
          </Button>
        }
      />
    </div>
  );
}

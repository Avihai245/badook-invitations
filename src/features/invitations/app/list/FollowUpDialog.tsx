'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Button, Dialog, Skeleton, cn, rovingKeyDown } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { EventType } from '../../contracts/types';
import type { InvitationSummary } from '../../server/host-db';
import { getTemplate } from '../../templates/registry';
import { hostApi, loginUrl } from '../api';
import { EVENT_ICONS } from '../event-icons';

/** The events a save-the-date can lead to in its template (wedding, engagement…). */
export const followUpTypes = (templateId: string): EventType[] =>
  (getTemplate(templateId)?.manifest.categories ?? []).filter((c) => c !== 'save_the_date');

/**
 * The save-the-date flow (§11 P4): pick the event, and a new draft with the save-the-date's names,
 * date, design and cover opens in the editor. The save-the-date stays as it is.
 */
export function FollowUpDialog({ item, onClose }: { item: InvitationSummary; onClose: () => void }) {
  const { t } = useUi();
  const f = t.list.followUp;
  const router = useRouter();
  const types = followUpTypes(item.templateId);
  const [eventType, setEventType] = useState<EventType | undefined>(types[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();

  async function create() {
    if (!eventType) return;
    setCreating(true);
    setError(null);
    const res = await hostApi<{ id?: string }>(`/api/invitations/${item.id}/follow-up`, {
      method: 'POST',
      body: { eventType },
    });
    if (res.status === 401) return router.push(loginUrl());
    // the skeleton stays up until the editor replaces this page
    if (res.ok && res.body?.id) return router.push(`/app/invitations/${res.body.id}/edit`);
    setCreating(false);
    setError(f.error);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !creating && onClose()}
      title={f.title}
      description={f.description}
      closeLabel={creating ? undefined : t.common.close}
      footer={
        creating ? null : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void create()} disabled={!eventType}>
              {f.create}
            </Button>
          </>
        )
      }
    >
      {creating ? (
        <div role="status" className="flex items-center gap-4 py-2">
          <Skeleton width={72} height={128} radius={14} />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <p className="text-[15px] font-semibold">{f.creating}</p>
            <Skeleton shape="line" width="70%" />
            <Skeleton shape="line" width="45%" />
          </div>
        </div>
      ) : (
        <>
          <h3 id={headingId} className="mb-3 text-[14px] font-semibold">
            {f.typeLabel}
          </h3>
          <div
            role="radiogroup"
            aria-labelledby={headingId}
            onKeyDown={rovingKeyDown}
            className="grid grid-cols-2 gap-2"
          >
            {types.map((type) => {
              const Icon = EVENT_ICONS[type];
              const on = type === eventType;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  data-roving-item=""
                  onClick={() => setEventType(type)}
                  className={cn(
                    'flex h-16 items-center gap-3 rounded-card border px-4 text-start text-[14px] font-semibold',
                    'transition-[background-color,border-color] duration-150 motion-reduce:transition-none',
                    on ? 'border-ink bg-subtle ring-1 ring-ink' : 'border-line bg-surface hover:bg-subtle',
                  )}
                >
                  <Icon aria-hidden strokeWidth={1.75} className="size-[22px] shrink-0 text-muted" />
                  {t.eventTypes[type]}
                </button>
              );
            })}
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-[13px] font-medium text-danger">
              {error}
            </p>
          ) : null}
        </>
      )}
    </Dialog>
  );
}

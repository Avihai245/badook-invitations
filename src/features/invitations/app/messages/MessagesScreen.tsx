'use client';

import { ArrowLeft, ArrowRight, CalendarClock, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, cn, PageTitle, rovingKeyDown } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { HubData } from '@/features/whatsapp/hub';
import { hostApi } from '../api';
import type { GuestsPageData } from '../../server/guests';
import { ManualSend } from './ManualSend';
import { MessageHistory } from './MessageHistory';
import { SmartSchedule } from './SmartSchedule';

export type MessagesTab = 'manual' | 'smart';

/**
 * The guests' WhatsApp section (/app/invitations/[id]/guests/whatsapp): two ways to send the same
 * approved messages to the same guest list, with the same credits and the same history — now
 * (choose a message and guests), or by smart scheduling (a ready sequence the system sends by itself).
 * What was sent, and how it went, under both.
 */
export function MessagesScreen({
  data,
  hub: initial,
  tab: initialTab,
}: {
  data: GuestsPageData;
  hub: HubData;
  tab: MessagesTab;
}) {
  const { t, dir } = useUi();
  const w = t.waMessages;
  const router = useRouter();
  const [tab, setTab] = useState<MessagesTab>(initialTab);
  const [hub, setHub] = useState(initial);
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const select = (next: MessagesTab) => {
    setTab(next);
    // the tab stays in the address (a reload, a link back here)
    const url = new URL(window.location.href);
    if (next === 'smart') url.searchParams.set('tab', 'smart');
    else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url);
  };
  const refresh = async () => {
    const res = await hostApi<{ hub: HubData }>(`/api/invitations/${data.id}/whatsapp/hub`);
    if (res.ok && res.body?.hub) setHub(res.body.hub);
    // the guest list's statuses (server component data)
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 pb-16 sm:px-6">
      <Link
        href={`/app/invitations/${data.id}/guests`}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink"
      >
        <Back aria-hidden className="size-4" />
        {w.back}
      </Link>
      <div className="mt-2 max-w-3xl">
        <PageTitle size="section">{w.title}</PageTitle>
        <p className="mt-1 text-[14px] text-muted">{w.subtitle}</p>
      </div>

      {/* the two ways to send, as two big choices (WAI-ARIA tabs) */}
      <div
        role="tablist"
        aria-label={w.tabs.label}
        onKeyDown={rovingKeyDown}
        className="mt-5 grid gap-3 sm:grid-cols-2"
        data-testid="messages-tabs"
      >
        {(['manual', 'smart'] as const).map((k) => {
          const on = tab === k;
          const Icon = k === 'manual' ? Send : CalendarClock;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              id={`wa-tab-${k}`}
              aria-selected={on}
              aria-controls={`wa-panel-${k}`}
              tabIndex={on ? 0 : -1}
              data-roving-item=""
              onClick={() => select(k)}
              className={cn(
                'flex items-start gap-3 rounded-card border p-4 text-start transition-colors',
                on
                  ? 'border-brand bg-brand-soft/50 ring-1 ring-brand'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-full',
                  on ? 'bg-brand text-white' : 'bg-subtle text-muted',
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                  {w.tabs[k]}
                  {k === 'smart' && hub.schedule?.status === 'active' ? (
                    <Badge variant="live">{w.scheduleOn}</Badge>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted">{w.tabHints[k]}</span>
              </span>
            </button>
          );
        })}
      </div>
      {/* both stay mounted: a sequence being edited survives a look at "send now" */}
      <div
        role="tabpanel"
        id="wa-panel-manual"
        aria-labelledby="wa-tab-manual"
        hidden={tab !== 'manual'}
        className="mt-5"
      >
        <ManualSend data={data} hub={hub} onSent={() => void refresh()} />
      </div>
      <div
        role="tabpanel"
        id="wa-panel-smart"
        aria-labelledby="wa-tab-smart"
        hidden={tab !== 'smart'}
        className="mt-5"
      >
        <SmartSchedule data={data} hub={hub} onChange={setHub} />
      </div>

      <div className="mt-8">
        <MessageHistory rows={hub.history} />
      </div>
    </div>
  );
}

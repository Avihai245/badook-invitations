'use client';

import { Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, Checkbox, cn, Input } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { MessageKind } from '@/features/whatsapp/catalog';
import type { HubData } from '@/features/whatsapp/hub';
import { whatsappReach } from '../../lib/guest-list';
import { matchesGuestSearch, wasSent } from '../../lib/guest-status';
import type { GuestRecord, GuestsPageData } from '../../server/guests';
import { WhatsAppDialog } from '../guests/WhatsAppDialog';
import { SendDialog } from './SendDialog';
import { availability, MessagePreview, PreviewButton, previewLanguages, TemplatePicker } from './shared';

/** The RSVP filters of the recipients' list. */
const FILTERS = ['all', 'not_received', 'unanswered', 'attending', 'declined'] as const;
type Filter = (typeof FILTERS)[number];

function matches(g: GuestRecord, f: Filter): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'not_received':
      return !wasSent(g) && !g.response;
    case 'unanswered':
      return wasSent(g) && !g.response;
    case 'attending':
      return g.response?.attending === true;
    case 'declined':
      return g.response?.attending === false;
  }
}

/** The filter each message suits: who it is meant for. */
const FILTER_OF: Record<MessageKind, Filter> = {
  invitation: 'not_received',
  reminder: 'unanswered',
  event_reminder: 'attending',
  thanks: 'attending',
  album: 'attending',
};

/**
 * "Send now": choose one of the approved messages (any can be previewed as the guest will see it),
 * choose guests — filtered by their RSVP, searched, one by one or all shown — and send. The
 * invitation goes through its own dialog (the guests page's, unchanged: who already has it, resend,
 * languages); the other messages through SendDialog.
 */
export function ManualSend({
  data,
  hub,
  onSent,
}: {
  data: GuestsPageData;
  hub: HubData;
  onSent: () => void;
}) {
  const { t, fmt, plural, number } = useUi();
  const w = t.waMessages;
  const guests = data.guests;
  const [kind, setKind] = useState<MessageKind>('invitation');
  const [filter, setFilter] = useState<Filter>('not_received');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [sending, setSending] = useState(false);

  const counts = useMemo(
    () =>
      Object.fromEntries(FILTERS.map((f) => [f, guests.filter((g) => matches(g, f)).length])) as Record<
        Filter,
        number
      >,
    [guests],
  );
  const shown = useMemo(
    () => guests.filter((g) => matches(g, filter) && matchesGuestSearch(g, query)),
    [guests, filter, query],
  );
  const chosen = guests.filter((g) => selected.has(g.id));
  const pick = (k: MessageKind) => {
    setKind(k);
    // the message's natural audience, and a fresh choice of guests from it
    setFilter(FILTER_OF[k]);
    setSelected(new Set());
  };
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const reachableShown = shown.filter((g) => whatsappReach(g) === 'ok');
  const allShown = reachableShown.length > 0 && reachableShown.every((g) => selected.has(g.id));
  const a = availability(kind, hub);
  const blocked = !data.whatsapp.configured
    ? w.notConfigured
    : !data.published
      ? w.notPublished
      : a !== 'approved'
        ? w.template.unavailable
        : !selected.size
          ? w.manual.pick
          : null;
  const languages = previewLanguages(data);
  const sample = chosen[0]?.name ?? null;

  const statusOf = (g: GuestRecord) =>
    g.response
      ? g.response.attending
        ? w.manual.status.attending
        : w.manual.status.declined
      : wasSent(g)
        ? w.manual.status.unanswered
        : w.manual.status.notSent;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card padding="md">
          <h2 className="mb-3 text-[15px] font-bold">1. {w.manual.step1}</h2>
          <TemplatePicker value={kind} onChange={pick} hub={hub} />
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4">
            <h2 className="text-[15px] font-bold">2. {w.manual.step2}</h2>
            <div
              role="radiogroup"
              aria-label={w.manual.filters.label}
              className="flex flex-wrap gap-1.5"
              data-testid="manual-filters"
            >
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
                    filter === f
                      ? 'border-ink bg-ink text-white dark:text-[#1c1917]'
                      : 'border-line bg-surface text-ink/80 hover:border-line-strong',
                  )}
                >
                  {w.manual.filters[f]}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11.5px] tabular-nums',
                      filter === f ? 'bg-white/20' : 'bg-subtle text-muted',
                    )}
                  >
                    {number(counts[f])}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 basis-[200px]">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={w.manual.search}
                  aria-label={w.manual.search}
                  className="ps-9"
                />
              </div>
              <Checkbox
                checked={allShown}
                disabled={!reachableShown.length}
                onCheckedChange={(on) =>
                  setSelected((s) => {
                    const next = new Set(s);
                    for (const g of reachableShown)
                      if (on) next.add(g.id);
                      else next.delete(g.id);
                    return next;
                  })
                }
                label={fmt(w.manual.selectAll, { n: number(reachableShown.length) })}
              />
            </div>
          </div>
          {!guests.length ? (
            <p className="p-6 text-center text-[13.5px] text-muted">{w.manual.noGuests}</p>
          ) : !shown.length ? (
            <p className="p-6 text-center text-[13.5px] text-muted">{w.manual.empty}</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto" data-testid="manual-guests">
              {shown.map((g) => {
                const reach = whatsappReach(g);
                return (
                  <li
                    key={g.id}
                    className={cn('flex items-center gap-3 px-4 py-2.5', reach !== 'ok' && 'opacity-60')}
                  >
                    <Checkbox
                      checked={selected.has(g.id)}
                      disabled={reach !== 'ok'}
                      onCheckedChange={(on) => toggle(g.id, on)}
                      label={<span className="font-semibold">{g.name}</span>}
                    />
                    <span className="ms-auto shrink-0 text-end text-[12.5px] text-muted">
                      {reach === 'ok' ? statusOf(g) : w.manual.reach[reach]}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas px-4 py-3">
            <p className="text-[13px] font-medium text-muted" data-testid="manual-blocked">
              {blocked ?? plural(w.manual.selected, selected.size, { n: number(selected.size) })}
            </p>
            <div className="flex flex-wrap gap-2">
              <PreviewButton
                title={w.preview.title}
                kind={kind}
                values={hub.values}
                languages={languages}
                sampleName={sample}
              />
              <Button
                variant="whatsapp"
                icon={<Send />}
                disabled={!!blocked}
                onClick={() => setSending(true)}
              >
                {selected.size
                  ? plural(w.manual.send, selected.size, { n: number(selected.size) })
                  : w.manual.sendNone}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-4">
          <p className="mb-2 text-[13px] font-semibold">{w.preview.title}</p>
          <MessagePreview kind={kind} values={hub.values} languages={languages} sampleName={sample} />
        </div>
      </aside>

      {sending && kind === 'invitation' ? (
        <WhatsAppDialog
          data={data}
          guests={guests}
          selected={selected}
          onClose={() => setSending(false)}
          onDone={() => {
            setSelected(new Set());
            onSent();
          }}
        />
      ) : sending && kind !== 'invitation' ? (
        <SendDialog
          data={data}
          kind={kind}
          chosen={chosen}
          onClose={() => setSending(false)}
          onDone={() => {
            setSelected(new Set());
            onSent();
          }}
        />
      ) : null}
    </div>
  );
}

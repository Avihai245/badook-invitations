'use client';

import { CalendarClock, Hand } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, cn, type BadgeVariant } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { MESSAGE_KINDS, type MessageKind } from '@/features/whatsapp/catalog';
import type { HistoryRow } from '@/features/whatsapp/hub';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  queued: 'warning',
  sending: 'warning',
  sent: 'neutral',
  delivered: 'info',
  read: 'live',
  failed: 'danger',
  skipped: 'draft',
};
const PAGE = 30;

/**
 * Every message the system's number sent for the event — the invitation, the reminders, the
 * thank-yous, sent now or by a stage — the newest first, with its status as WhatsApp reported it
 * (queued → sent → delivered → read, or failed) and the totals; filtered by message.
 */
export function MessageHistory({ rows }: { rows: readonly HistoryRow[] }) {
  const { t, fmt, number, date } = useUi();
  const w = t.waMessages;
  const [kind, setKind] = useState<MessageKind | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);
  const present = useMemo(() => MESSAGE_KINDS.filter((k) => rows.some((r) => r.kind === k)), [rows]);
  const shown = kind === 'all' ? rows : rows.filter((r) => r.kind === kind);
  const count = (s: string) => shown.filter((r) => r.status === s).length;
  const delivered = count('delivered') + count('read');
  return (
    <Card padding="none" className="overflow-hidden" data-testid="message-history">
      <div className="flex flex-col gap-2 border-b border-line p-4">
        <h2 className="text-[15px] font-bold">{w.history.title}</h2>
        <p className="text-[13px] text-muted">{w.history.intro}</p>
        {rows.length ? (
          <>
            <p className="text-[13px] font-medium">
              {fmt(w.history.summary, {
                sent: number(
                  shown.filter((r) => !['queued', 'sending', 'failed', 'skipped'].includes(r.status)).length,
                ),
                delivered: number(delivered),
                read: number(count('read')),
                failed: number(count('failed')),
              })}
            </p>
            {present.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {(['all', ...present] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      'h-7 rounded-full border px-2.5 text-[12.5px] font-semibold',
                      kind === k
                        ? 'border-ink bg-ink text-white dark:text-[#1c1917]'
                        : 'border-line bg-surface text-ink/80',
                    )}
                  >
                    {k === 'all' ? w.history.all : w.kinds[k]}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {!rows.length ? (
        <p className="p-6 text-center text-[13.5px] text-muted">{w.history.empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {shown.slice(0, limit).map((r) => (
              <li
                key={`${r.kind}-${r.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
              >
                <span className="min-w-0 flex-1 basis-[140px] truncate font-semibold">{r.name ?? '—'}</span>
                <span className="flex items-center gap-1.5 text-muted">
                  {r.stageId ? (
                    <CalendarClock aria-hidden className="size-3.5" />
                  ) : (
                    <Hand aria-hidden className="size-3.5" />
                  )}
                  <span className="sr-only">{r.stageId ? w.history.scheduled : w.history.manual}</span>
                  {w.kinds[r.kind]}
                </span>
                <span className="text-muted tabular-nums">
                  {date(r.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <Badge variant={STATUS_BADGE[r.status] ?? 'neutral'}>
                  {w.history.status[r.status as keyof typeof w.history.status] ?? r.status}
                </Badge>
              </li>
            ))}
          </ul>
          {shown.length > limit ? (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                {w.history.more}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

'use client';

import { Inbox, MessageCircleQuestion, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, EmptyState, Hint, PageHeader, cn } from '@/components/app';
import { openSupport } from '@/features/support/open';
import { useUi } from '@/lib/i18n/client';
import { useLiveRefresh } from '@/lib/live/client';
import { TICKETS } from '../config';
import type { CustomerTicketSummary } from '../types';
import { TicketStatusBadge } from './StatusBadge';
import { relativeTime } from './when';

/**
 * /app/support: the customer's tickets — the subject, the status in words, the last activity and a
 * mark when the team answered since they last looked — a new ticket, and the assistant for a quick
 * answer. The list checks for news when the page comes back to the front and every minute.
 */
export function TicketList({ tickets }: { tickets: CustomerTicketSummary[] }) {
  const { t, fmt } = useUi();
  const s = t.tickets.list;
  const router = useRouter();
  useLiveRefresh(null, () => router.refresh(), TICKETS.listPollMs);

  const newTicket = (
    <Hint text={s.newTicketHint}>
      <Button asChild icon={<Plus />} data-testid="support-new">
        <Link href="/app/support/new">{s.newTicket}</Link>
      </Button>
    </Hint>
  );

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <PageHeader title={s.title} description={fmt(s.subtitle, { brand: t.brand })} actions={newTicket} />

      {tickets.length ? (
        <ul aria-label={s.label} className="mt-6 flex flex-col gap-3" data-testid="support-tickets">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      ) : (
        <Card className="mt-6">
          <EmptyState
            titleAs="h2"
            illustration={<Inbox strokeWidth={1.25} className="text-brand" />}
            title={s.emptyTitle}
            description={s.emptyBody}
            action={newTicket}
          />
        </Card>
      )}

      <section className="mt-6 flex flex-col items-start gap-3 rounded-card border border-brand-line bg-brand-soft/60 p-5 sm:flex-row sm:items-center">
        <MessageCircleQuestion aria-hidden className="size-6 shrink-0 text-brand-deep" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">{s.quickTitle}</h2>
          <p className="mt-0.5 text-[13.5px] text-pretty text-ink/80">{s.quickBody}</p>
        </div>
        <Hint text={s.askHint}>
          <Button variant="secondary" onClick={() => openSupport()}>
            {s.ask}
          </Button>
        </Hint>
      </section>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: CustomerTicketSummary }) {
  const { t, fmt, locale } = useUi();
  const s = t.tickets;
  return (
    <li>
      <Link
        href={`/app/support/${ticket.id}`}
        data-testid="support-ticket"
        data-ticket={ticket.number}
        data-unread={ticket.unread ? '1' : undefined}
        className={cn(
          'flex flex-col gap-2 rounded-card border bg-surface p-4 shadow-sm transition-colors hover:bg-row-hover sm:flex-row sm:items-center sm:gap-4',
          ticket.unread ? 'border-brand-line' : 'border-line hover:border-line-strong',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {ticket.unread ? <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-brand" /> : null}
            <p
              dir="auto"
              className={cn(
                'min-w-0 truncate text-start text-[15px]',
                ticket.unread ? 'font-bold' : 'font-semibold',
              )}
            >
              {ticket.subject}
            </p>
          </div>
          <p className="mt-1 text-[12.5px] text-muted tabular-nums">
            {fmt(s.list.number, { n: ticket.number })} · {s.categories[ticket.category]} ·{' '}
            <time dateTime={ticket.lastActivityAt} suppressHydrationWarning>
              {fmt(s.list.updated, { when: relativeTime(locale, ticket.lastActivityAt) })}
            </time>
          </p>
          {ticket.invitation ? (
            <p className="mt-0.5 truncate text-[12.5px] text-muted">
              {fmt(s.list.about, { title: ticket.invitation.title ?? ticket.invitation.slug })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ticket.unread ? <Badge variant="warning">{s.list.unread}</Badge> : null}
          <TicketStatusBadge status={ticket.status} />
        </div>
      </Link>
    </li>
  );
}

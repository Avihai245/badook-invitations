'use client';

import { LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/app';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import type { AdminTicketItem } from '../types';
import { AdminStatusBadge, PriorityBadge } from './shared';

/** On a user's page in the console: their support tickets, the latest activity first. */
export function UserTicketsCard({ tickets }: { tickets: AdminTicketItem[] }) {
  const { t, fmt, relative } = useAdminUi();
  const s = t.support;
  return (
    <Card padding="lg" asChild>
      <section aria-labelledby="user-tickets-title" data-testid="user-tickets">
        <h2 id="user-tickets-title" className="flex items-center gap-2 text-[15px] font-bold">
          <LifeBuoy aria-hidden className="size-[18px] text-brand-deep" />
          {s.user.title}
        </h2>
        {tickets.length ? (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/app/admin/support/${ticket.id}`}
                  className="flex flex-col gap-1 py-2.5 transition-colors hover:bg-row-hover sm:flex-row sm:items-center sm:gap-3"
                  data-ticket={ticket.number}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      <bdi>{ticket.subject}</bdi>
                    </span>
                    <span className="block text-[12px] text-muted tabular-nums">
                      {fmt(s.list.number, { n: ticket.number })} · {s.categories[ticket.category]} ·{' '}
                      <time dateTime={ticket.lastActivityAt} suppressHydrationWarning>
                        {relative(ticket.lastActivityAt)}
                      </time>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <AdminStatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-muted">{s.user.empty}</p>
        )}
      </section>
    </Card>
  );
}

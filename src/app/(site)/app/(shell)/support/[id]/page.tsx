import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@/features/support/tickets/config';
import { customerView } from '@/features/support/tickets/server/api';
import { ticketsDb } from '@/features/support/tickets/server/db';
import { TicketScreen } from '@/features/support/tickets/ui/TicketScreen.client';
import { fmt } from '@/lib/i18n/app';
import { getUi } from '@/lib/i18n/server';
import { realtimeInfo } from '@/lib/live/broadcast';
import { requireUser } from '@/lib/supabase/session';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ t }, { id }, user] = await Promise.all([getUi(), params, requireUser('/app/support')]);
  const ticket = isUuid(id) ? await ticketsDb.get(user.id, id, false) : null;
  return { title: ticket ? fmt(t.tickets.ticket.metaTitle, { n: ticket.number }) : t.tickets.list.metaTitle };
}

/**
 * /app/support/:id — one of the customer's tickets (anyone else's: not found). Opening it makes the
 * team's answers no longer new.
 */
export default async function TicketPage({ params }: Params) {
  const { id } = await params;
  const user = await requireUser(`/app/support/${id}`);
  const row = isUuid(id) ? await ticketsDb.get(user.id, id, true) : null;
  if (!row) notFound();
  return <TicketScreen initial={customerView(row, { realtime: realtimeInfo })} />;
}

import type { Metadata } from 'next';
import { ticketsDb } from '@/features/support/tickets/server/db';
import { TicketList } from '@/features/support/tickets/ui/TicketList.client';
import { getUi } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.tickets.list.metaTitle };
}

/** /app/support — the customer's tickets to the team (features/support/tickets). */
export default async function SupportPage() {
  const user = await requireUser('/app/support');
  const tickets = await ticketsDb.list(user.id);
  return <TicketList tickets={tickets} />;
}

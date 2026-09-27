import type { Metadata } from 'next';
import { hostsLine } from '@/features/invitations/lib/text';
import { hostDb } from '@/features/invitations/server/host-db';
import { isTicketCategory, isUuid } from '@/features/support/tickets/config';
import { NewTicket } from '@/features/support/tickets/ui/NewTicket.client';
import { getUi } from '@/lib/i18n/server';
import { requireUser } from '@/lib/supabase/session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return { title: t.tickets.form.metaTitle };
}

type Search = Promise<{ category?: string; invitation?: string }>;

/**
 * /app/support/new — a ticket for the team. ?category= and ?invitation= (one of the customer's) choose
 * them ahead, e.g. from an invitation's page.
 */
export default async function NewTicketPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser('/app/support/new');
  const [{ category, invitation }, list] = await Promise.all([searchParams, hostDb.list(user.id)]);
  const invitations = list
    .filter((i) => i.status !== 'archived')
    .map((i) => ({ id: i.id, title: hostsLine(i.hosts, i.defaultLocale) || i.slug }));
  return (
    <NewTicket
      invitations={invitations}
      defaults={{
        category: isTicketCategory(category) ? category : 'support',
        invitationId: isUuid(invitation) && invitations.some((i) => i.id === invitation) ? invitation : null,
      }}
    />
  );
}

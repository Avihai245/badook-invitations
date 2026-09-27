import { notFound } from 'next/navigation';
import { requireStaff } from '@/features/admin/server/gate';
import { AdminTicketScreen } from '@/features/support/tickets/admin/AdminTicketScreen.client';
import { isUuid } from '@/features/support/tickets/config';
import { adminSupportDb } from '@/features/support/tickets/server/db';

type Params = { params: Promise<{ id: string }> };

/**
 * /app/admin/support/:id — one ticket (support.view to read; the actions need support.reply, checked
 * again by the server and the database). The console's live channel refreshes it.
 */
export default async function AdminTicketPage({ params }: Params) {
  const { id } = await params;
  const staff = await requireStaff('support.view', `/app/admin/support/${id}`);
  const ticket = isUuid(id) ? await adminSupportDb.get(staff.userId, id) : null;
  if (!ticket) notFound();
  return <AdminTicketScreen ticket={ticket} />;
}

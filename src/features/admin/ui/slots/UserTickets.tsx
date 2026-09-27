import { can } from '@/features/admin/permissions';
import type { Staff } from '@/features/admin/server/gate';
import { UserTicketsCard } from '@/features/support/tickets/admin/UserTicketsCard.client';
import { adminSupportDb } from '@/features/support/tickets/server/db';

/**
 * On a user's page in the console: their support tickets (for roles with support.view; nothing for
 * the others, or when they couldn't be read).
 */
export async function UserTickets({ staff, userId }: { staff: Staff; userId: string }) {
  if (!can(staff.role, 'support.view')) return null;
  const tickets = await adminSupportDb
    .userTickets(staff.userId, userId)
    .catch((err) => (console.error('[admin] user tickets', err), null));
  if (!tickets) return null;
  return <UserTicketsCard tickets={tickets} />;
}

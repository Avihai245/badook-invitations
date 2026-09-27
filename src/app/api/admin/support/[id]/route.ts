import { adminRoute } from '@/features/admin/server/gate';
import { adminUpdate } from '@/features/support/tickets/server/admin-api';
import { adminTicketDeps } from '@/features/support/tickets/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/support/:id { status } | { priority } | { assignee } — support.reply: one change to
 * a ticket (the database checks the role again and records it).
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'support.reply', (staff, body) =>
    adminUpdate(staff, id, body, adminTicketDeps()),
  );
}

import { adminRoute } from '@/features/admin/server/gate';
import { adminDelete } from '@/features/support/tickets/server/admin-api';
import { adminTicketDeps } from '@/features/support/tickets/server/deps';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/support/:id/delete { reason } — support.reply: spam or abuse, gone from every list. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'support.reply', (staff, body) =>
    adminDelete(staff, id, body, adminTicketDeps()),
  );
}

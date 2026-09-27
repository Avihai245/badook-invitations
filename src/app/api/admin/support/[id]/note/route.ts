import { adminRoute } from '@/features/admin/server/gate';
import { adminNote } from '@/features/support/tickets/server/admin-api';
import { adminTicketDeps } from '@/features/support/tickets/server/deps';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/support/:id/note { body } — support.reply: a note for the team only. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'support.reply', (staff, body) => adminNote(staff, id, body, adminTicketDeps()));
}

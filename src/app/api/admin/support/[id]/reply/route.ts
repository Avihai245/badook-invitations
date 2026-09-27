import { adminRoute } from '@/features/admin/server/gate';
import { adminReply } from '@/features/support/tickets/server/admin-api';
import { adminTicketDeps } from '@/features/support/tickets/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/support/:id/reply { body, close } — support.reply: the team's answer to the customer
 * (in the app and by email), and closing it with the answer when asked.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'support.reply', (staff, body) =>
    adminReply(staff, id, body, adminTicketDeps()),
  );
}

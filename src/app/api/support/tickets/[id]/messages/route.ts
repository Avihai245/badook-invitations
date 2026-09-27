import { hostRoute } from '@/features/invitations/server/host-route';
import { replyTicket } from '@/features/support/tickets/server/api';
import { ticketDeps } from '@/features/support/tickets/server/deps';

type Params = { params: Promise<{ id: string }> };

/** POST /api/support/tickets/:id/messages { body } — the customer answers (a closed ticket opens again). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => replyTicket(userId, id, body, ticketDeps()));
}

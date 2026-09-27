import { hostRoute } from '@/features/invitations/server/host-route';
import { closeTicket } from '@/features/support/tickets/server/api';
import { ticketDeps } from '@/features/support/tickets/server/deps';

type Params = { params: Promise<{ id: string }> };

/** POST /api/support/tickets/:id/close — the customer closes their ticket (writing again opens it). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => closeTicket(userId, id, ticketDeps()));
}

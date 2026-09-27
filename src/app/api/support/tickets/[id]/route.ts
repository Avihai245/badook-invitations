import { hostRoute } from '@/features/invitations/server/host-route';
import { getTicket } from '@/features/support/tickets/server/api';
import { ticketDeps } from '@/features/support/tickets/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/support/tickets/:id[?seen=0] — one of the customer's tickets with its conversation (the
 * page's live refresh); the team's answers are no longer new unless ?seen=0 (a page in the background).
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const seen = new URL(request.url).searchParams.get('seen') !== '0';
  return hostRoute(request, (userId) => getTicket(userId, id, seen, ticketDeps()));
}

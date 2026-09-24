import { markGuestsSent } from '@/features/invitations/server/guests';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/guests/sent — { ids, sent }: the host sent (or not) the links themselves. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => markGuestsSent(userId, id, body));
}

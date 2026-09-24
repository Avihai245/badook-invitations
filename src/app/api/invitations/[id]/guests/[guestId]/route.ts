import { updateGuest } from '@/features/invitations/server/guests';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; guestId: string }> };

/** PATCH /api/invitations/:id/guests/:guestId — { name, phone, email, partySize, group }. */
export async function PATCH(request: Request, { params }: Params) {
  const { id, guestId } = await params;
  return hostRoute(request, (userId, body) => updateGuest(userId, id, guestId, body));
}

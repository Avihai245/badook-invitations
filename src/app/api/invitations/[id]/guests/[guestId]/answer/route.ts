import { setGuestAnswer } from '@/features/invitations/server/guests';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; guestId: string }> };

/**
 * PUT /api/invitations/:id/guests/:guestId/answer — { kind: 'answer', attending, count } (the host sets
 * the guest's answer) or { kind: 'extra', approve } (their request to bring more).
 */
export async function PUT(request: Request, { params }: Params) {
  const { id, guestId } = await params;
  return hostRoute(request, (userId, body) => setGuestAnswer(userId, id, guestId, body));
}

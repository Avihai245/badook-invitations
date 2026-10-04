import { nudgeIfOk } from '@/features/admin/server/nudge';
import { deleteResponse, linkResponse } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; responseId: string }> };

/** DELETE /api/invitations/:id/responses/:responseId — a guest's reply, from the dashboard (§9B.3-G). */
export async function DELETE(request: Request, { params }: Params) {
  const { id, responseId } = await params;
  const res = await hostRoute(request, (userId, _body, deps) => deleteResponse(userId, id, responseId, deps));
  // the admin console's numbers
  return nudgeIfOk(res, 'rsvp');
}

/** PATCH /api/invitations/:id/responses/:responseId { guestId } — match a general-link reply to a guest. */
export async function PATCH(request: Request, { params }: Params) {
  const { id, responseId } = await params;
  return hostRoute(request, (userId, body, deps) => linkResponse(userId, id, responseId, body, deps));
}

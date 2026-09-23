import { deleteResponse } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; responseId: string }> };

/** DELETE /api/invitations/:id/responses/:responseId — a guest's reply, from the dashboard (§9B.3-G). */
export async function DELETE(request: Request, { params }: Params) {
  const { id, responseId } = await params;
  return hostRoute(request, (userId, _body, deps) => deleteResponse(userId, id, responseId, deps));
}

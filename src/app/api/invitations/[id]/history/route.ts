import { listHistory } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/history — every publish and the draft's saves, newest first. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, _body, deps) => listHistory(userId, id, deps));
}

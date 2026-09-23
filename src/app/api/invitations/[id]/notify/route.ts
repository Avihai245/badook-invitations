import { setNotify } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/invitations/:id/notify { mode: 'each' | 'digest' | 'off' } — reply notifications by email. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => setNotify(userId, id, body, deps));
}

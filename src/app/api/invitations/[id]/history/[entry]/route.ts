import { getEntry } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; entry: string }> };

/** GET /api/invitations/:id/history/:entry — one publish or save with its document. */
export async function GET(request: Request, { params }: Params) {
  const { id, entry } = await params;
  return hostRoute(request, (userId, _body, deps) => getEntry(userId, id, Number(entry), deps));
}

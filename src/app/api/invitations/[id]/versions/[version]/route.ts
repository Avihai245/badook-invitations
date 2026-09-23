import { getVersion } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; version: string }> };

/** GET /api/invitations/:id/versions/:version — one published version's document (preview). */
export async function GET(request: Request, { params }: Params) {
  const { id, version } = await params;
  return hostRoute(request, (userId, _body, deps) => getVersion(userId, id, Number(version), deps));
}

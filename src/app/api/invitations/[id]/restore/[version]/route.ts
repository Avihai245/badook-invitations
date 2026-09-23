import { restoreVersion } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string; version: string }> };

/** POST /api/invitations/:id/restore/:version — copies a published version back into the draft (§4). */
export async function POST(request: Request, { params }: Params) {
  const { id, version } = await params;
  return hostRoute(request, (userId, _body, deps) => restoreVersion(userId, id, Number(version), deps));
}

import { eraseFaces, getFaces, postFaces } from '@/features/faces/server/api';
import { faceHostDeps } from '@/features/faces/server/deps';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/gallery/faces — where face search stands, and the next photos to look at. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => getFaces(userId, id, faceHostDeps()));
}

/**
 * POST /api/invitations/:id/gallery/faces { results: [{ id, faces }] } — what the host's browser found
 * ("prepare face search"); answers with the next photos.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => postFaces(userId, id, body, faceHostDeps()));
}

/** DELETE /api/invitations/:id/gallery/faces — every piece of the event's face data, now. */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => eraseFaces(userId, id, faceHostDeps()));
}

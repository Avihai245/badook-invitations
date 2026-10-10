import { aiHostDeps } from '@/features/ai-photos/server/deps';
import { deletePhotos, listPhotos } from '@/features/ai-photos/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/ai-photos/photos?before= — the photos the guests made, newest first. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const before = new URL(request.url).searchParams.get('before');
  return hostRoute(request, (userId) => listPhotos(userId, id, before, aiHostDeps()));
}

/** POST /api/invitations/:id/ai-photos/photos { action: 'delete', ids } — deletes photos and their files. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => deletePhotos(userId, id, body, aiHostDeps()));
}

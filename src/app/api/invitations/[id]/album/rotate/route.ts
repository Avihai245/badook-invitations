import { albumDeps } from '@/features/album/server/deps';
import { rotateAlbum } from '@/features/album/server/api';
import { hostRoute } from '@/features/invitations/server/host-route';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/album/rotate — a new link for the album; the old one stops at once. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => rotateAlbum(userId, id, base, albumDeps()));
}

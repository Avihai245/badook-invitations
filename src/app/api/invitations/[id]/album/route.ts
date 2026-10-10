import { albumDeps } from '@/features/album/server/deps';
import { getAlbum, updateAlbum } from '@/features/album/server/api';
import { hostRoute } from '@/features/invitations/server/host-route';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/album — the album's state, link and QR code (made once the gallery exists). */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => getAlbum(userId, id, base, albumDeps()));
}

/**
 * PATCH /api/invitations/:id/album { enabled?, opensAt?, title?, message?, coverItemId?, hiddenItems?,
 * showVideos?, chapters? } — the hosts' settings (feature album).
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId, body) => updateAlbum(userId, id, body, base, albumDeps()));
}

import { albumDeps } from '@/features/album/server/deps';
import { albumStudio } from '@/features/album/server/api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/invitations/:id/album/items — the album's studio: every published photo and video (signed
 * URLs) with whether it is left out, and the layout the album makes of them now.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => albumStudio(userId, id, albumDeps()));
}

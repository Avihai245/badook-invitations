import { hostRoute } from '@/features/invitations/server/host-route';
import { hostGalleryDeps } from '@/features/live-gallery/server/deps';
import { originalsPage } from '@/features/live-gallery/server/host-api';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/gallery/originals { scope, after? } — the next 100 files for "download
 * everything", with signed URLs; the host's browser fetches them and writes the zip itself.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => originalsPage(userId, id, body, hostGalleryDeps()));
}

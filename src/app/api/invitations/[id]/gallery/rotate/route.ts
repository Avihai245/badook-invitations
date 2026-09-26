import { hostRoute } from '@/features/invitations/server/host-route';
import { hostGalleryDeps } from '@/features/live-gallery/server/deps';
import { rotateLink } from '@/features/live-gallery/server/host-api';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/gallery/rotate { which: upload | projector } — a new link; the old one stops working. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId, body) => rotateLink(userId, id, body, base, hostGalleryDeps()));
}

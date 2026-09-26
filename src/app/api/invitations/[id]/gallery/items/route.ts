import { hostRoute } from '@/features/invitations/server/host-route';
import { hostGalleryDeps } from '@/features/live-gallery/server/deps';
import { listItems, moderateItems } from '@/features/live-gallery/server/host-api';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/gallery/items?status=&beforeAt=&beforeId= — the host's items, newest first. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return hostRoute(request, (userId) => listItems(userId, id, query, hostGalleryDeps()));
}

/** POST /api/invitations/:id/gallery/items { action: publish | hide | reject | delete, ids } */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => moderateItems(userId, id, body, hostGalleryDeps()));
}

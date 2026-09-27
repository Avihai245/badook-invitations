import { nudgeIfOk } from '@/features/admin/server/nudge';
import { hostRoute } from '@/features/invitations/server/host-route';
import { galleryNotifyDeps } from '@/features/live-gallery/server/deps';
import { galleryNoticesState, sendGalleryNotices } from '@/features/live-gallery/server/notices-api';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/invitations/:id/gallery/notices — every guest with their own gallery link and what they got
 * already (feature live_gallery, the gallery on).
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => galleryNoticesState(userId, id, base, galleryNotifyDeps()));
}

/**
 * POST /api/invitations/:id/gallery/notices — { action: 'send', guestIds } from the system's WhatsApp
 * number (a credit each), { action: 'mark', guestIds } sent from the host's own WhatsApp,
 * { action: 'continue' } the next batch of what is queued.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const res = await hostRoute(request, (userId, body) =>
    sendGalleryNotices(userId, id, body, galleryNotifyDeps()),
  );
  // the admin console's numbers, queues and feed
  return nudgeIfOk(res, 'message');
}

import { guestDeps } from '@/features/live-gallery/server/deps';
import { guestComplete } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/complete { t, code?, uploader, id, originalDone, metrics? } — an upload's files
 * are in storage: they are checked, the moderation decides (feed, the host's queue, or out) and the
 * open pages hear about it. Later calls record that the original arrived.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => guestComplete(body, ip, guestDeps()));
}

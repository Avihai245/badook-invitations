import { guestDeps } from '@/features/live-gallery/server/deps';
import { guestFeed } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/feed { t, code?, uploader?, before? | since?, mine? } — the gallery's published
 * photos and videos (a page, or what changed since the last answer) with short-lived URLs, and this
 * device's own uploads with where they stand.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => guestFeed(body, ip, guestDeps()));
}

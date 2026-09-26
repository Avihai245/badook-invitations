import { guestDeps } from '@/features/live-gallery/server/deps';
import { guestResign } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/resign { t, code?, uploader, id, parts } — fresh upload URLs for an item this
 * device reserved (a queue that waited past their two hours); a part already stored comes back done.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => guestResign(body, ip, guestDeps()));
}

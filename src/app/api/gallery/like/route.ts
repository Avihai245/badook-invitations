import { guestDeps } from '@/features/live-gallery/server/deps';
import { guestLike } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/like { t, code?, uploader, post, on } — this phone likes a post of the feed (or
 * takes its like back); the answer has the post's likes.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => guestLike(body, ip, guestDeps()));
}

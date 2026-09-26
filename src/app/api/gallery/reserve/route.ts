import { guestDeps } from '@/features/live-gallery/server/deps';
import { guestReserve } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/reserve { t, code?, uploader, name?, g?, items } — ids and signed upload URLs for
 * up to 10 photos or videos, after their types and sizes are checked; the browser then sends the files
 * straight to storage.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => guestReserve(body, ip, guestDeps()));
}

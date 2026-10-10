import { aiGuestDeps } from '@/features/ai-photos/server/deps';
import { aiDelete } from '@/features/ai-photos/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/ai/delete { t, code?, uploader, id } — deletes one of this phone's AI photos.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => aiDelete(body, ip, aiGuestDeps()));
}

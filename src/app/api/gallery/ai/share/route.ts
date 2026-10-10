import { aiGuestDeps } from '@/features/ai-photos/server/deps';
import { aiShare } from '@/features/ai-photos/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/ai/share { t, code?, uploader, id } — a finished AI photo into the event's gallery.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => aiShare(body, ip, aiGuestDeps()));
}

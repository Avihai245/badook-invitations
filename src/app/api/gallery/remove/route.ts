import { guestDeps } from '@/features/live-gallery/server/deps';
import { guestRemove } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/** POST /api/gallery/remove { t, code?, uploader, id } — a guest deletes their own upload (from that device). */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => guestRemove(body, ip, guestDeps()));
}

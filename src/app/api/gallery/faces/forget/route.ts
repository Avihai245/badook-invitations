import { forget } from '@/features/faces/server/api';
import { faceGuestDeps } from '@/features/faces/server/deps';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/faces/forget { t, code?, descriptor } — "forget me": the faces that match the guest
 * are erased at once (and a request of theirs to be left out); nothing about them stays.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => forget(body, ip, faceGuestDeps()));
}

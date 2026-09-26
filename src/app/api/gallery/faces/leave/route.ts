import { leaveOut } from '@/features/faces/server/api';
import { faceGuestDeps } from '@/features/faces/server/deps';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/faces/leave { t, code?, descriptor } — the guest asks to be left out of everyone's
 * searches: the faces that match them are excluded now, and photos added later leave them out too.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => leaveOut(body, ip, faceGuestDeps()));
}

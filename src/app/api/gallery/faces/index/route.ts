import { indexUpload } from '@/features/faces/server/api';
import { faceGuestDeps } from '@/features/faces/server/deps';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/faces/index { t, code?, uploader, id, faces } — the phone that uploaded a photo
 * sends the faces it found in it (boxes and descriptors — no crops, no names), when the event has face
 * search (feature face_albums).
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => indexUpload(body, ip, faceGuestDeps()));
}

import { searchFaces } from '@/features/faces/server/api';
import { faceGuestDeps } from '@/features/faces/server/deps';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/faces/search { t, code?, descriptor } — "the photos I'm in" (feature face_albums):
 * the published photos with a face matching the descriptor the guest's phone made from their selfie.
 * The descriptor is only compared — never stored, never logged; the selfie never leaves the phone.
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => searchFaces(body, ip, faceGuestDeps()));
}

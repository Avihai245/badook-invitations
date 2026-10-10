import { aiGuestDeps } from '@/features/ai-photos/server/deps';
import { aiStatus } from '@/features/ai-photos/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

// the photo is made after the answer, in this request's time where the host allows it (Amplify cuts at
// ~30 s: the background transport, INVITES_AI_IMAGE_TRANSPORT, then keeps each request short)
export const maxDuration = 300;

/**
 * POST /api/gallery/ai/status { t, code?, uploader, id } — how one of this phone's AI photos is doing (and
 * its links when done).
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => aiStatus(body, ip, aiGuestDeps()));
}

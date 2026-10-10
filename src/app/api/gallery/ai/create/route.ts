import { aiGuestDeps } from '@/features/ai-photos/server/deps';
import { aiCreate } from '@/features/ai-photos/server/guest-api';
import { AI_PHOTOS } from '@/features/ai-photos/config';
import { publicJsonRoute } from '@/lib/public-route';

// the photo is made after the answer, in this request's time where the host allows it (Amplify cuts at
// ~30 s: the background transport, INVITES_AI_IMAGE_TRANSPORT, then keeps each request short)
export const maxDuration = 300;

/**
 * POST /api/gallery/ai/create { t, code?, uploader, guest?, name?, prompt, people, photo?, lang } — asks for
 * an AI photo with the people of honor: the phone's photo (base64 JPEG, made small on the phone) and the
 * request. Answers at once ({ id, left }); the photo is made in the background.
 */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => aiCreate(body, ip, aiGuestDeps()), {
    label: 'ai photos',
    // the photo, as base64 (a third larger than the file)
    maxBytes: Math.ceil((AI_PHOTOS.source.maxBytes * 4) / 3) + 16 * 1024,
  });
}

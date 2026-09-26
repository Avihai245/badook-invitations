import { guestDeps } from '@/features/live-gallery/server/deps';
import { projectorFeed } from '@/features/live-gallery/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/** POST /api/gallery/projector { p, since? } — what the venue's screen shows (the projector link). */
export async function POST(request: Request) {
  return galleryRoute(request, (body) => projectorFeed(body, guestDeps()));
}

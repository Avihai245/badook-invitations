import { aiGuestDeps } from '@/features/ai-photos/server/deps';
import { aiState } from '@/features/ai-photos/server/guest-api';
import { galleryRoute } from '@/features/live-gallery/server/route';

/**
 * POST /api/gallery/ai/state { t, code?, uploader } — the AI photos on the gallery's page: the people of honor,
 * what this phone may still make and its photos ({ ai: null } when the event doesn't offer them).
 */
export async function POST(request: Request) {
  return galleryRoute(request, (body, ip) => aiState(body, ip, aiGuestDeps()));
}

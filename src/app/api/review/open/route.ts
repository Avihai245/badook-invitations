import { reviewGuestDeps } from '@/features/review/server/deps';
import { openApi } from '@/features/review/server/guest-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/review/open { t } — the draft and its comments for the review link (no account). */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => openApi(body, ip, reviewGuestDeps()), {
    label: 'review api',
  });
}

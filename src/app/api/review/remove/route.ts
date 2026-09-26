import { reviewGuestDeps } from '@/features/review/server/deps';
import { removeComment } from '@/features/review/server/guest-api';
import { publicJsonRoute } from '@/lib/public-route';

/** POST /api/review/remove { t, key, commentId } — a family member removes their own comment. */
export async function POST(request: Request) {
  return publicJsonRoute(request, (body, ip) => removeComment(body, ip, reviewGuestDeps()), {
    label: 'review api',
  });
}

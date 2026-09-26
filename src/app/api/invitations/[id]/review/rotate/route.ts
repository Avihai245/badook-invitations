import { hostRoute } from '@/features/invitations/server/host-route';
import { reviewHostDeps } from '@/features/review/server/deps';
import { rotateReviewLink } from '@/features/review/server/host-api';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/review/rotate — a new review link; the old one stops working at once. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => rotateReviewLink(userId, id, base, reviewHostDeps()));
}

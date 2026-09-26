import { hostRoute } from '@/features/invitations/server/host-route';
import { reviewHostDeps } from '@/features/review/server/deps';
import {
  createReviewLink,
  getReview,
  revokeReviewLink,
  updateReviewLink,
} from '@/features/review/server/host-api';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/review — the family's review link and their comments (feature draft_review). */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => getReview(userId, id, base, reviewHostDeps()));
}

/** POST /api/invitations/:id/review { expiresInDays } — makes the review link. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId, body) => createReviewLink(userId, id, body, base, reviewHostDeps()));
}

/** PATCH /api/invitations/:id/review { expiresInDays?, notify? } — its expiry, the host's emails. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId, body) => updateReviewLink(userId, id, body, base, reviewHostDeps()));
}

/** DELETE /api/invitations/:id/review — revokes the link (the comments stay). */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => revokeReviewLink(userId, id, base, reviewHostDeps()));
}

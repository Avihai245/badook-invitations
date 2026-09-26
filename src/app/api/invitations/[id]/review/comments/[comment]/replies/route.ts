import { hostRoute } from '@/features/invitations/server/host-route';
import { reviewHostDeps } from '@/features/review/server/deps';
import { replyToComment } from '@/features/review/server/host-api';

type Params = { params: Promise<{ id: string; comment: string }> };

/** POST /api/invitations/:id/review/comments/:comment/replies { id, body } — the host answers a comment. */
export async function POST(request: Request, { params }: Params) {
  const { id, comment } = await params;
  return hostRoute(request, (userId, body) => replyToComment(userId, id, comment, body, reviewHostDeps()));
}

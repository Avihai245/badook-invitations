import { hostRoute } from '@/features/invitations/server/host-route';
import { reviewHostDeps } from '@/features/review/server/deps';
import { deleteComment, setCommentStatus } from '@/features/review/server/host-api';

type Params = { params: Promise<{ id: string; comment: string }> };

/** PATCH /api/invitations/:id/review/comments/:comment { status } — handled, or open again. */
export async function PATCH(request: Request, { params }: Params) {
  const { id, comment } = await params;
  return hostRoute(request, (userId, body) => setCommentStatus(userId, id, comment, body, reviewHostDeps()));
}

/** DELETE /api/invitations/:id/review/comments/:comment — removes it (and its replies). */
export async function DELETE(request: Request, { params }: Params) {
  const { id, comment } = await params;
  return hostRoute(request, (userId) => deleteComment(userId, id, comment, reviewHostDeps()));
}

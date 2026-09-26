import { snapshotDraft } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/snapshot { reason } — keep the draft in the history (before a design concept). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => snapshotDraft(userId, id, body, deps));
}

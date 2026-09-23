import { createFollowUp } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/follow-up { eventType } — the full invitation for a save-the-date → { id, slug }. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => createFollowUp(userId, id, body, deps));
}

import { dayHostDeps } from '@/features/event-day/server/deps';
import { listChanges } from '@/features/event-day/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/seating/changes — the seating's audit trail, newest first. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => listChanges(userId, id, dayHostDeps()));
}

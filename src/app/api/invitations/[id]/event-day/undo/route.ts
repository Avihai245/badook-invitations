import { dayHostDeps } from '@/features/event-day/server/deps';
import { hostUndo } from '@/features/event-day/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/event-day/undo { id } — the host undoes a check-in. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => hostUndo(userId, id, body, dayHostDeps()));
}

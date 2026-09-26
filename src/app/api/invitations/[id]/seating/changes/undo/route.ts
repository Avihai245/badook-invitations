import { dayHostDeps } from '@/features/event-day/server/deps';
import { undoChange } from '@/features/event-day/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/seating/changes/undo { changeId, force?, notify? } — families back where a change found them. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => undoChange(userId, id, body, dayHostDeps()));
}

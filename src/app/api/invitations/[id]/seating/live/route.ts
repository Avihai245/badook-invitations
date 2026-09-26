import { dayHostDeps } from '@/features/event-day/server/deps';
import { reseat } from '@/features/event-day/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/seating/live — re-seating during the event: { action: 'move', unitId, tableId }
 * or { action: 'merge', from, into }, with a reason, `force` (add chairs) and `notify` (tell the moved families).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => reseat(userId, id, body, dayHostDeps()));
}

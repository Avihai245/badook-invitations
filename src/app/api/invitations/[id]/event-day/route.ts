import { dayHostDeps } from '@/features/event-day/server/deps';
import { getDay } from '@/features/event-day/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/event-day — the live hall: arrivals per table, the timeline, changes, the station link. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => getDay(userId, id, base, dayHostDeps()));
}

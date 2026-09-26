import { dayHostDeps } from '@/features/event-day/server/deps';
import { rotateStation } from '@/features/event-day/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/event-day/station { rotate: true } — a new station link; the old one stops working. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId, body) => rotateStation(userId, id, body, base, dayHostDeps()));
}

import { dayHostDeps } from '@/features/event-day/server/deps';
import { noticesState, sendNotices } from '@/features/event-day/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/seating/notices — every family with a seat to tell, and what it was told. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => noticesState(userId, id, dayHostDeps()));
}

/**
 * POST /api/invitations/:id/seating/notices — { action: 'send', unitIds } from the system's WhatsApp
 * number, { action: 'mark', unitIds } told by the host themselves, { action: 'continue' } the next batch.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => sendNotices(userId, id, body, dayHostDeps()));
}

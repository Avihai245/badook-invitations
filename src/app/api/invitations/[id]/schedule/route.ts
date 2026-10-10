import { hostRoute } from '@/features/invitations/server/host-route';
import { cancelSchedule, getSchedule, setSchedule } from '@/features/scheduler/server/api';
import { scheduleDeps } from '@/features/scheduler/server/deps';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/schedule — the invitation's time zone and its scheduled sends. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => getSchedule(userId, id, scheduleDeps()));
}

/**
 * POST /api/invitations/:id/schedule — { kind, date, time, timeZone, audience }: a send at that date and
 * time on the clock of that time zone (or the one waiting moved).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => setSchedule(userId, id, body, scheduleDeps()));
}

/** DELETE /api/invitations/:id/schedule — { kind }: the send waiting taken back. */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => cancelSchedule(userId, id, body, scheduleDeps()));
}

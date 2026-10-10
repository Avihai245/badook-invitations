import { hostRoute } from '@/features/invitations/server/host-route';
import { saveSchedule } from '@/features/whatsapp/hub';

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/invitations/:id/whatsapp/schedule — { preset, action, stages?, consent? }: save the scheduled
 * messages, turn them on, pause, resume or cancel them.
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => saveSchedule(userId, id, body));
}

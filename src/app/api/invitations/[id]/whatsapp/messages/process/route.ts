import { nudgeIfOk } from '@/features/admin/server/nudge';
import { hostRoute } from '@/features/invitations/server/host-route';
import { continueMessages } from '@/features/whatsapp/hub';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/whatsapp/messages/process — send the next batch of the event's queues. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const res = await hostRoute(request, (userId) => continueMessages(userId, id));
  return nudgeIfOk(res, 'message');
}

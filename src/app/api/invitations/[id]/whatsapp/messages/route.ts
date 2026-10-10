import { nudgeIfOk } from '@/features/admin/server/nudge';
import { hostRoute } from '@/features/invitations/server/host-route';
import { sendMessages } from '@/features/whatsapp/hub';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/whatsapp/messages — { kind, guestIds, consent: true }: send a message now. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const res = await hostRoute(request, (userId, body) => sendMessages(userId, id, body));
  // the admin console's numbers, queues and feed
  return nudgeIfOk(res, 'message');
}

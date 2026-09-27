import { nudgeIfOk } from '@/features/admin/server/nudge';
import { hostRoute } from '@/features/invitations/server/host-route';
import { sendInvitations } from '@/features/whatsapp/api';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/whatsapp — { guestIds, consent: true }: send the invitation on WhatsApp. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const res = await hostRoute(request, (userId, body) => sendInvitations(userId, id, body));
  // the admin console's numbers, queues and feed
  return nudgeIfOk(res, 'message');
}

import { hostRoute } from '@/features/invitations/server/host-route';
import { sendInvitations } from '@/features/whatsapp/api';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/whatsapp — { guestIds, consent: true }: send the invitation on WhatsApp. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => sendInvitations(userId, id, body));
}

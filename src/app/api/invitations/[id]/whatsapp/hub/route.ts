import { hostRoute } from '@/features/invitations/server/host-route';
import { hubState } from '@/features/whatsapp/hub';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/whatsapp/hub — the WhatsApp section: the sequence, its stages, every message. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => hubState(userId, id));
}

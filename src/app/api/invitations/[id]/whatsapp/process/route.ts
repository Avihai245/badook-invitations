import { hostRoute } from '@/features/invitations/server/host-route';
import { continueSending } from '@/features/whatsapp/api';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/whatsapp/process — send the next batch of the queue. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => continueSending(userId, id));
}

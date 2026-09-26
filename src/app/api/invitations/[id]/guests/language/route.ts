import { setGuestsLanguage } from '@/features/invitations/server/guests';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/guests/language — { ids, language }: the language these guests read the
 * invitation in (null: the invitation's default).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => setGuestsLanguage(userId, id, body));
}

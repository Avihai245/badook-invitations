import { saveDraft } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/invitations/:id — autosave { draft, updatedAt } → { updatedAt } | 409 conflict (§7.6). */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => saveDraft(userId, id, body, deps));
}

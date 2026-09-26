import { getDraft, saveDraft } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id — { draft, updatedAt, templateId } of the host's invitation. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, _body, deps) => getDraft(userId, id, deps));
}

/** PATCH /api/invitations/:id — autosave { draft, updatedAt } → { updatedAt } | 409 conflict (§7.6). */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body, deps) => saveDraft(userId, id, body, deps));
}

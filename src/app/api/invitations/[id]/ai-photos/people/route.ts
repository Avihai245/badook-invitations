import { AI_PHOTOS } from '@/features/ai-photos/config';
import { aiHostDeps } from '@/features/ai-photos/server/deps';
import { deletePerson, savePerson } from '@/features/ai-photos/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/ai-photos/people { id?, role, name, description?, photo? } — adds a person of
 * honor or changes one; the photo (base64, made small on the host's device) is re-encoded and stored.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => savePerson(userId, id, body, aiHostDeps()), {
    maxBytes: Math.ceil((AI_PHOTOS.people.maxBytes * 4) / 3) + 16 * 1024,
  });
}

/** DELETE /api/invitations/:id/ai-photos/people { personId } — a person of honor and their photo. */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => deletePerson(userId, id, body, aiHostDeps()));
}

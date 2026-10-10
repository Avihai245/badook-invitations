import { aiHostDeps } from '@/features/ai-photos/server/deps';
import { getAi, updateAiSettings } from '@/features/ai-photos/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/ai-photos — the AI photos' setup: the people of honor, the settings, the counts. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => getAi(userId, id, aiHostDeps()));
}

/** PATCH /api/invitations/:id/ai-photos { enabled?, perGuest?, perEvent?, toGallery?, consent? } */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => updateAiSettings(userId, id, body, aiHostDeps()));
}

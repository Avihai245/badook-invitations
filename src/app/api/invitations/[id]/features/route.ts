import { getEventFeatures, setEventFeature } from '@/features/flags/api';
import { flagDeps } from '@/features/flags/server';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/features — what the event may use, and why not the rest. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId) => getEventFeatures(userId, id, flagDeps));
}

/** PATCH /api/invitations/:id/features { feature, off } — the host switches a feature off for the event (or back on). */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => setEventFeature(userId, id, body, flagDeps));
}

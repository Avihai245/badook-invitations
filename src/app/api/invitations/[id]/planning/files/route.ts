import { hostRoute } from '@/features/invitations/server/host-route';
import { filesOperation } from '@/features/planning/server/files';
import { planningDeps } from '@/features/planning/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/planning/files — { op: 'upload', purpose, contentType, size } answers a signed
 * upload; { op: 'read', paths } answers signed read URLs for this event's files.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => filesOperation(userId, id, body, planningDeps));
}

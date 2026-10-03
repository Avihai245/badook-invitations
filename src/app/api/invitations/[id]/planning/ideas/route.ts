import { hostRoute } from '@/features/invitations/server/host-route';
import { planningDeps } from '@/features/planning/server/deps';
import { ideaOperation } from '@/features/planning/server/ideas';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/planning/ideas — { op: 'save' | 'delete' | 'convert', … }. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => ideaOperation(userId, id, body, planningDeps));
}

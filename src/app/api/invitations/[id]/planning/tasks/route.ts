import { hostRoute } from '@/features/invitations/server/host-route';
import { taskOperation } from '@/features/planning/server/api';
import { planningDeps } from '@/features/planning/server/deps';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/planning/tasks — { op: 'save' | 'delete' | 'reorder' | 'bulk', … }. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => taskOperation(userId, id, body, planningDeps));
}

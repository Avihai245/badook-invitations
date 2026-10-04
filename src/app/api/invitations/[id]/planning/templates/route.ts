import { hostRoute } from '@/features/invitations/server/host-route';
import { planningDeps } from '@/features/planning/server/deps';
import { templateOperation } from '@/features/planning/server/templates';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/planning/templates — { op: 'save', name } keeps this plan as the host's own
 * template; { op: 'list' } answers their templates; { op: 'delete', templateId } removes one (Business).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => templateOperation(userId, id, body, planningDeps));
}

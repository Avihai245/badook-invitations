import { hostRoute } from '@/features/invitations/server/host-route';
import { aiOperation } from '@/features/planning/server/ai-api';
import { planningDeps } from '@/features/planning/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/planning/ai — { kind: 'plan', description } answers a drafted plan to approve;
 * { kind: 'idea', ideaId } answers a summary and next steps for one card (a Pro tool).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => aiOperation(userId, id, body, planningDeps));
}

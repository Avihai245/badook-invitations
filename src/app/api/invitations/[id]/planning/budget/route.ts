import { hostRoute } from '@/features/invitations/server/host-route';
import { budgetOperation } from '@/features/planning/server/budget';
import { planningDeps } from '@/features/planning/server/deps';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/planning/budget — { op: 'category_save' | 'category_delete' | 'item_save' |
 * 'item_delete' | 'payment_save' | 'payment_delete' | 'payment_paid', … }.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => budgetOperation(userId, id, body, planningDeps));
}

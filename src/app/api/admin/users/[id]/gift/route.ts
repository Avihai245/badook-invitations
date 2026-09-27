import { actionDeps } from '@/features/admin/server/action-deps';
import { giftPlan } from '@/features/admin/server/actions';
import { adminRoute } from '@/features/admin/server/gate';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/users/:id/gift { plan, lastDay, reason } — a plan as a gift (plan null: taken back). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'users.plan', (staff, body) => giftPlan(staff, id, body, actionDeps(staff)));
}

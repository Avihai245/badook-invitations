import { actionDeps } from '@/features/admin/server/action-deps';
import { setDiscount } from '@/features/admin/server/actions';
import { adminRoute } from '@/features/admin/server/gate';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/users/:id/discount { percent, lastDay, note, reason } — the team's discount (percent null: removed). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'users.plan', (staff, body) => setDiscount(staff, id, body, actionDeps(staff)));
}

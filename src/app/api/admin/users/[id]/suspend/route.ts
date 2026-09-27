import { actionDeps } from '@/features/admin/server/action-deps';
import { suspendUser } from '@/features/admin/server/actions';
import { adminRoute } from '@/features/admin/server/gate';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/users/:id/suspend { suspend, reason } — the user's sign-in suspended or restored. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'users.suspend', (staff, body) =>
    suspendUser(staff, id, body, actionDeps(staff)),
  );
}

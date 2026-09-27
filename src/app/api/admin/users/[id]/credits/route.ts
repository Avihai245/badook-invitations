import { actionDeps } from '@/features/admin/server/action-deps';
import { addCredits } from '@/features/admin/server/actions';
import { adminRoute } from '@/features/admin/server/gate';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/users/:id/credits { delta, reason } — the team adds (or removes) credits. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'users.credits', (staff, body) =>
    addCredits(staff, id, body, actionDeps(staff)),
  );
}

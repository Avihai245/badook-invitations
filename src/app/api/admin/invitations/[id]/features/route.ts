import { actionDeps } from '@/features/admin/server/action-deps';
import { grantFeature } from '@/features/admin/server/actions';
import { adminRoute } from '@/features/admin/server/gate';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/invitations/:id/features { feature, grant, reason } — a feature beyond the owner's plan. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(request, 'invitations.features', (staff, body) =>
    grantFeature(staff, id, body, actionDeps(staff)),
  );
}

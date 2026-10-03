import { hostRoute } from '@/features/invitations/server/host-route';
import { planningDeps } from '@/features/planning/server/deps';
import { vendorOperation } from '@/features/planning/server/vendors';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/planning/vendors — { op: 'save' | 'delete' | 'close' | 'undo_close', … }. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return hostRoute(request, (userId, body) => vendorOperation(userId, id, body, planningDeps));
}

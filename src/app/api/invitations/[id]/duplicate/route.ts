import { nudgeIfOk } from '@/features/admin/server/nudge';
import { duplicate } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/** POST /api/invitations/:id/duplicate — a new draft copy → { id, slug }. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const res = await hostRoute(request, (userId, _body, deps) => duplicate(userId, id, deps));
  // the admin console's numbers and feed
  return nudgeIfOk(res, 'invitation');
}

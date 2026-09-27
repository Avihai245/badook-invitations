import { nudgeIfOk } from '@/features/admin/server/nudge';
import { publish } from '@/features/invitations/server/host-api';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/invitations/:id/publish { slug? } — validates the draft (blocking errors → 422 with the issue
 * list), applies a new slug, copies draft → published (version + 1, snapshot) and revalidates /i/<slug>.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const res = await hostRoute(request, (userId, body, deps) => publish(userId, id, body, deps));
  // the admin console's numbers and feed
  return nudgeIfOk(res, 'invitation');
}

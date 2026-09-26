import { getInsights } from '@/features/insights/server/api';
import { reportDeps } from '@/features/insights/server/deps';
import { hostRoute } from '@/features/invitations/server/host-route';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/invitations/:id/insights?range=7|30|0 — how guests use the invitation (feature analytics):
 * the funnel, the median time on the page, by language, source and device, per day, the personal
 * links and the gallery's uploads. 403 feature_off when the event doesn't have it.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return hostRoute(request, (userId) => getInsights(userId, id, query, reportDeps()));
}

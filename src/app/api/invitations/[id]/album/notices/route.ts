import { nudgeIfOk } from '@/features/admin/server/nudge';
import { albumNotifyDeps } from '@/features/album/server/deps';
import { albumNoticesState, sendAlbumNotices } from '@/features/album/server/notices-api';
import { hostRoute } from '@/features/invitations/server/host-route';
import { requestBaseUrl } from '@/lib/request-url';

type Params = { params: Promise<{ id: string }> };

/** GET /api/invitations/:id/album/notices — every guest and the album's thank-you they got already. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const base = await requestBaseUrl();
  return hostRoute(request, (userId) => albumNoticesState(userId, id, base, albumNotifyDeps()));
}

/**
 * POST /api/invitations/:id/album/notices — { action: 'send', guestIds } from the system's WhatsApp
 * number (a credit each), { action: 'mark', guestIds } sent from the hosts' own WhatsApp,
 * { action: 'continue' } the next batch of what is queued.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const res = await hostRoute(request, (userId, body) =>
    sendAlbumNotices(userId, id, body, albumNotifyDeps()),
  );
  // the admin console's numbers, queues and feed
  return nudgeIfOk(res, 'message');
}

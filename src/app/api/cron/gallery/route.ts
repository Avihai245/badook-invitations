import { galleryHousekeeping } from '@/features/live-gallery/server/sweep';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { sameSecret } from '@/lib/secrets';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/cron/gallery with `Authorization: Bearer <INVITES_CRON_SECRET>` — the live gallery's
 * housekeeping: files of deleted photos and videos leave storage, uploads that never finished go
 * after two days, deleted items' rows after a month (features/live-gallery/server/sweep.ts). It also
 * runs by itself on the hosts' gallery traffic; .github/workflows/gallery-housekeeping.yml calls it
 * daily. Safe to run twice. Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`))
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  try {
    return Response.json(await galleryHousekeeping(), { headers: NO_STORE });
  } catch (err) {
    console.error('Gallery housekeeping failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

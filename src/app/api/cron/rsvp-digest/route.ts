import { jobDone, runDaily } from '@/features/jobs/jobs';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { sameSecret } from '@/lib/secrets';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/cron/rsvp-digest with `Authorization: Bearer <INVITES_CRON_SECRET>` — the daily run: the
 * RSVP summaries for invitations set to "daily summary", the purge of data past its keeping time, the
 * billing checks, the templates sync and the live gallery's housekeeping (features/jobs, runDaily). The
 * app runs it by itself once a day; a scheduler's call (.github/workflows/rsvp-digest.yml) runs it now
 * and counts as that day's turn. Every part is safe to run twice. Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  }
  try {
    const result = await runDaily(new Date());
    await jobDone('daily');
    return Response.json(result, { headers: NO_STORE });
  } catch (err) {
    console.error('Daily run failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

import { timingSafeEqual } from 'node:crypto';
import { reportOverdue } from '@/features/billing/server/billing';
import { sendDigests } from '@/features/invitations/server/notify';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { serviceDb } from '@/lib/supabase/server';
import { syncSeedOnce } from '@/features/invitations/server/seed-sync';

const NO_STORE = { 'cache-control': 'no-store' };

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * POST /api/cron/rsvp-digest with `Authorization: Bearer <INVITES_CRON_SECRET>` — the daily RSVP
 * summary for invitations set to "daily summary" (called by .github/workflows/rsvp-digest.yml), and
 * the daily purge of data past its keeping time (purge_expired), and the templates and demos sync.
 * Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  }
  try {
    const digests = await sendDigests(new Date());
    // once a day, also what the privacy policy promises about keeping data
    const { data: purged, error } = await serviceDb().rpc('purge_expired');
    if (error) console.error('purge_expired failed', error.message);
    // and tells support about paid plans whose monthly renewal never arrived
    const overdue = await reportOverdue().catch(
      (err) => (console.error('billing_overdue failed', err), null),
    );
    // and that the templates and demos match this deployment (a no-op when they do)
    const seed = await syncSeedOnce('daily');
    return Response.json({ ...digests, purged: purged ?? null, overdue, seed }, { headers: NO_STORE });
  } catch (err) {
    console.error('RSVP digest failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

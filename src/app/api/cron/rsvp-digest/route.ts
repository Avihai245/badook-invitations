import { timingSafeEqual } from 'node:crypto';
import { sendDigests } from '@/features/invitations/server/notify';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';

const NO_STORE = { 'cache-control': 'no-store' };

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * POST /api/cron/rsvp-digest with `Authorization: Bearer <INVITES_CRON_SECRET>` — the daily RSVP
 * summary for invitations set to "daily summary" (called by .github/workflows/rsvp-digest.yml).
 * Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  }
  try {
    return Response.json(await sendDigests(new Date()), { headers: NO_STORE });
  } catch (err) {
    console.error('RSVP digest failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

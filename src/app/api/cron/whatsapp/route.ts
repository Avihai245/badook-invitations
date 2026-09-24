import { cloudApiConfigured } from '@/features/whatsapp/cloud-api';
import { processQueue } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { sameSecret } from '@/lib/secrets';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/cron/whatsapp with `Authorization: Bearer <INVITES_CRON_SECRET>` — sends what is still
 * queued (a host closed the page mid-send; a message waiting to be retried). Meant to run every few
 * minutes (.github/workflows/whatsapp-queue.yml). Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`))
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  if (!cloudApiConfigured()) return Response.json({ skipped: 'not_configured' }, { headers: NO_STORE });
  try {
    const total = { sent: 0, failed: 0, retried: 0 };
    for (let round = 0; round < 4; round++) {
      const r = await processQueue(null, 50);
      total.sent += r.sent;
      total.failed += r.failed;
      total.retried += r.retried;
      if (r.sent + r.failed + r.retried === 0) break;
    }
    return Response.json(total, { headers: NO_STORE });
  } catch (err) {
    console.error('WhatsApp queue failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

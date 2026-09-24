import { jobDone, runWhatsAppQueue } from '@/features/jobs/jobs';
import { cloudApiConfigured } from '@/features/whatsapp/cloud-api';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { sameSecret } from '@/lib/secrets';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/cron/whatsapp with `Authorization: Bearer <INVITES_CRON_SECRET>` — sends what is still
 * queued (a host closed the page mid-send; a message waiting to be retried). A scheduler may call it
 * every few minutes (.github/workflows/whatsapp-queue.yml); the app also does this by itself
 * (features/jobs). Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`))
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  if (!cloudApiConfigured()) return Response.json({ skipped: 'not_configured' }, { headers: NO_STORE });
  try {
    const result = await runWhatsAppQueue(60_000);
    await jobDone('whatsapp');
    return Response.json(result, { headers: NO_STORE });
  } catch (err) {
    console.error('WhatsApp queue failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

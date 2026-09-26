import { voiceDeps } from '@/features/voice/server/deps';
import { processVoice } from '@/features/voice/server/voice';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { sameSecret } from '@/lib/secrets';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/cron/voice with `Authorization: Bearer <INVITES_CRON_SECRET>` — makes the audio that
 * publishes queued (the invitation read aloud, features/voice) and retries that are due. The app does
 * this by itself right after a publish and on its own clock (features/jobs); a scheduler may call it
 * too. Safe to run twice. Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`))
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  try {
    return Response.json(await processVoice(null, voiceDeps(), 20), { headers: NO_STORE });
  } catch (err) {
    console.error('Voice run failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

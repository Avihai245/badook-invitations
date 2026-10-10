import { aiWorkerDeps } from '@/features/ai-photos/server/deps';
import { processAiPhotos } from '@/features/ai-photos/server/worker';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { sameSecret } from '@/lib/secrets';

const NO_STORE = { 'cache-control': 'no-store' };

// the photo is made after the answer, in this request's time where the host allows it (Amplify cuts at
// ~30 s: the background transport, INVITES_AI_IMAGE_TRANSPORT, then keeps each request short)
export const maxDuration = 300;

/**
 * POST /api/cron/ai-photos with `Authorization: Bearer <INVITES_CRON_SECRET>` — checks the AI photos working
 * in OpenAI's background and starts queued ones (features/ai-photos). The app does this by itself right
 * after a guest's request, on the guest's page's checks and on its own clock (features/jobs); a scheduler
 * may call it too. Safe to run twice. Off (404) without a secret.
 */
export async function POST(request: Request) {
  const secret = serverEnv().INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`))
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  try {
    return Response.json(await processAiPhotos(null, aiWorkerDeps(), { starts: 4 }), { headers: NO_STORE });
  } catch (err) {
    console.error('AI photos run failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

import { statusesOf, validSignature } from '@/features/whatsapp/cloud-api';
import { whatsappDb } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { sameSecret } from '@/lib/secrets';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * Meta's webhook for the WhatsApp Business Account (App Dashboard → WhatsApp → Configuration):
 * GET = the subscription handshake (hub.verify_token must equal INVITES_WHATSAPP_VERIFY_TOKEN);
 * POST = message statuses (sent / delivered / read / failed), signed with the app secret.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = serverEnv().INVITES_WHATSAPP_VERIFY_TOKEN;
  if (params.get('hub.mode') === 'subscribe' && sameSecret(params.get('hub.verify_token') ?? '', token)) {
    return new Response(params.get('hub.challenge') ?? '', {
      headers: { ...NO_STORE, 'content-type': 'text/plain' },
    });
  }
  return new Response('Forbidden', { status: 403, headers: NO_STORE });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (
    !validSignature(raw, request.headers.get('x-hub-signature-256'), serverEnv().INVITES_WHATSAPP_APP_SECRET)
  )
    return new Response('Invalid signature', { status: 401, headers: NO_STORE });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400, headers: NO_STORE });
  }
  try {
    for (const s of statusesOf(payload)) await whatsappDb.status(s.id, s.status, s.error);
  } catch (err) {
    // Meta retries a failed delivery for days: answer 500 so it comes back
    console.error('[whatsapp webhook]', err);
    return new Response('Error', { status: 500, headers: NO_STORE });
  }
  return new Response('OK', { headers: NO_STORE });
}

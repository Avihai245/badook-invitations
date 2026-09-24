import { NextResponse } from 'next/server';
import { supportChat } from '@/features/support/chat';
import { clientIp } from '@/lib/client-ip';
import { getSessionUser } from '@/lib/supabase/session';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/support/chat — the support assistant (features/support/chat.ts) for signed-in hosts: the
 * answer as a text stream.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  try {
    const user = await getSessionUser().catch(() => null);
    if (!user)
      return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401, headers: NO_STORE });
    const result = await supportChat(body, { userId: user.id, ip: clientIp(request) });
    if ('stream' in result)
      return new Response(result.stream, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
          ...NO_STORE,
        },
      });
    return NextResponse.json(result.json, { status: result.status, headers: NO_STORE });
  } catch (err) {
    console.error('[support chat]', err);
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

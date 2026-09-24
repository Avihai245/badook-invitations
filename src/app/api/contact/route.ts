import { NextResponse } from 'next/server';
import { submitContact } from '@/features/site/contact';
import { clientIp } from '@/lib/client-ip';
import { getSessionUser } from '@/lib/supabase/session';

const NO_STORE = { 'cache-control': 'no-store' };

/** POST /api/contact — the site's contact form (features/site/contact.ts). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  try {
    const user = await getSessionUser().catch(() => null);
    const result = await submitContact(body, { ip: clientIp(request), userId: user?.id ?? null });
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (err) {
    console.error('[contact]', err);
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

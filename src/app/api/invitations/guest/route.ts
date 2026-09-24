import { NextResponse } from 'next/server';
import { openGuestLink } from '@/features/invitations/server/guests';
import { invitationsEnabled } from '@/lib/feature';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/invitations/guest — { slug, token }: a guest opened their personal link. Returns their
 * name and phone (to prefill the RSVP form and greet them) and counts the visit. Public; the token
 * (96 random bits) is the key.
 */
export async function POST(request: Request) {
  if (!invitationsEnabled()) return NextResponse.json({ ok: false }, { status: 404, headers: NO_STORE });
  const body = (await request.json().catch(() => null)) as { slug?: unknown; token?: unknown } | null;
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const token = typeof body?.token === 'string' ? body.token : '';
  try {
    const result = await openGuestLink(slug, token);
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (err) {
    console.error('[guest link]', err);
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

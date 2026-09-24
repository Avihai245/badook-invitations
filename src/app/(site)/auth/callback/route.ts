import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env';
import { safeNext, sessionDb } from '@/lib/supabase/session';

const OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

/**
 * Landing URL of the Supabase Auth emails (sign-up confirmation, password recovery) and of "Continue
 * with Google": exchanges the PKCE `code` — or verifies a `token_hash` from a customized email
 * template — for a session cookie, then continues to `next` (an in-app path). A sign-in with Google
 * that was canceled or refused comes back with `error`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const base = serverEnv().INVITES_PUBLIC_BASE_URL || request.nextUrl.origin;
  if (params.get('error')) return NextResponse.redirect(new URL('/login?error=oauth_failed', base));
  const next = safeNext(params.get('next'));
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  const db = await sessionDb();
  let ok = false;
  if (code) {
    ok = !(await db.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await db.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  return NextResponse.redirect(new URL(ok ? next : '/login?error=link_invalid', base));
}

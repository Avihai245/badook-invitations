import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { requestBaseUrl } from '@/lib/request-url';
import { callbackError, failedLinkPath, loginPath, RESET_PATH } from '@/lib/supabase/auth-paths';
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
 * with Google" — also reached from any page Supabase fell back to (middleware): exchanges the PKCE
 * `code` — or verifies a `token_hash` from a customized email template — for a session cookie, then
 * continues to `next` (an in-app path; a password reset always goes on to choosing the new password).
 * An expired or used email link, Google refusing, and a link opened in another browser each get
 * their own message.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // the address the visitor is on (their session cookie is set there), not a stale configured one
  const base = await requestBaseUrl();
  const go = (path: string) => NextResponse.redirect(new URL(path, base));
  const next = safeNext(params.get('next'));
  const failed = callbackError(params);
  if (failed) return go(loginPath({ error: failed, next }));

  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  if (!code && !(tokenHash && type && OTP_TYPES.includes(type)))
    return go(loginPath({ error: 'link_invalid', next }));
  try {
    const db = await sessionDb();
    if (code) {
      const { data, error } = await db.auth.exchangeCodeForSession(code);
      if (error) return go(failedLinkPath(error, next));
      // a recovery code says so even when `next` was lost on the way (Supabase's Site URL fallback)
      const recovery = (data as { redirectType?: string | null }).redirectType === 'recovery';
      return go(recovery ? RESET_PATH : next);
    }
    const { error } = await db.auth.verifyOtp({ type: type!, token_hash: tokenHash! });
    if (error) return go(loginPath({ error: 'link_expired', next }));
    return go(type === 'recovery' ? RESET_PATH : next);
  } catch (err) {
    console.error('[auth callback]', err);
    return go(loginPath({ error: 'generic', next }));
  }
}

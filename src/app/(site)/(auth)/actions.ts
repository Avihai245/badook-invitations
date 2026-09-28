'use server';

import { redirect } from 'next/navigation';
import { nudgeAfter } from '@/features/admin/server/nudge';
import type { AppDict } from '@/lib/i18n/app';
import { requestBaseUrl } from '@/lib/request-url';
import { loginPath, RESET_PATH } from '@/lib/supabase/auth-paths';
import { googleSignInEnabled } from '@/lib/supabase/providers';
import { safeNext, sessionDb } from '@/lib/supabase/session';

export type AuthErrorKey = keyof AppDict['auth']['errors'] | keyof AppDict['accountPage']['auth']['errors'];
export type AuthState =
  | { step?: undefined; error?: AuthErrorKey; sent?: boolean; email?: string }
  | {
      step: 'code';
      kind: 'signup' | 'recovery';
      email: string;
      next: string;
      error?: AuthErrorKey;
      sent?: boolean;
    }
  | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_RE = /^\d{6}$/;
const MIN_PASSWORD = 8;

/** Supabase Auth error → a message key (never the raw provider text). */
function errorKey(error: { code?: string; status?: number; reasons?: string[] }): AuthErrorKey {
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'user_already_exists';
    case 'weak_password':
      // Leaked-password protection reports the same code, with 'pwned' among the reasons.
      return error.reasons?.includes('pwned') ? 'leaked_password' : 'weak_password';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'invalid_email';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limited';
    // the Badook team suspended the account's sign-in (the admin console)
    case 'user_banned':
      return 'suspended';
    // a 6-digit code, wrong or past its 15-minute expiry — the same code either way
    case 'otp_expired':
    case 'otp_disabled':
      return 'code_invalid';
  }
  return error.status === 429 ? 'rate_limited' : 'generic';
}

const field = (form: FormData, name: string) => String(form.get(name) ?? '');
const codeKind = (form: FormData): 'signup' | 'recovery' =>
  field(form, 'kind') === 'recovery' ? 'recovery' : 'signup';
/**
 * Where Supabase sends the visitor back to (Google): the address this request came in on — the one
 * their session cookie belongs to, and on Supabase's allow list (docs/google-sign-in.md).
 */
const callbackUrl = async (next: string) =>
  `${await requestBaseUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

/**
 * Email + password. An unconfirmed account (still on its sign-up code) gets a fresh code and the same
 * verification screen sign-up itself shows — instead of a dead end.
 */
export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  const next = safeNext(form.get('next'));
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email', email };
  const db = await sessionDb();
  const { error } = await db.auth.signInWithPassword({ email, password: field(form, 'password') });
  if (!error) redirect(next);
  if (errorKey(error) === 'email_not_confirmed') {
    await db.auth.resend({ type: 'signup', email }).catch(() => undefined);
    return { step: 'code', kind: 'signup', email, next };
  }
  return { error: errorKey(error), email };
}

/** A new account; then a 6-digit code (Supabase's Send Email hook) to confirm the email. */
export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  const password = field(form, 'password');
  const name = field(form, 'name').trim().slice(0, 80);
  const next = safeNext(form.get('next'));
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email', email };
  if (password.length < MIN_PASSWORD) return { error: 'weak_password', email };
  const db = await sessionDb();
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: name ? { full_name: name } : {} },
  });
  if (error) return { error: errorKey(error), email };
  // a new account: the admin console's numbers and feed
  nudgeAfter('user');
  // Email confirmation off → signed in right away; on → the code screen.
  if (data.session) redirect(next);
  return { step: 'code', kind: 'signup', email, next };
}

/**
 * The 6-digit code from Supabase's email: finishes a sign-up (or a login stalled on confirming the
 * email) or unlocks choosing a new password. Same screen for both — `kind` says which `type` to check
 * the code against, and where a correct one leads.
 */
export async function verifyCode(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  const code = field(form, 'code');
  const next = safeNext(form.get('next'));
  const kind = codeKind(form);
  if (!CODE_RE.test(code)) return { step: 'code', kind, email, next, error: 'code_invalid' };
  const db = await sessionDb();
  const { error } = await db.auth.verifyOtp({ email, token: code, type: kind });
  if (error) return { step: 'code', kind, email, next, error: errorKey(error) };
  if (kind === 'signup') nudgeAfter('user');
  redirect(kind === 'signup' ? next : RESET_PATH);
}

/** "Resend code" (60s cooldown in the UI): a new sign-up confirmation code, or a new reset code. */
export async function resendCode(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  const kind = codeKind(form);
  const db = await sessionDb();
  const { error } =
    kind === 'signup'
      ? await db.auth.resend({ type: 'signup', email })
      : await db.auth.resetPasswordForEmail(email);
  return error ? { error: errorKey(error), email } : { sent: true, email };
}

/**
 * "Continue with Google": Supabase sends the visitor to Google and back to /auth/callback with a code
 * (PKCE — the verifier waits in a cookie). A Google account with the email of an existing account
 * signs into that account. Checked first: the button may still be on a page from before Google was
 * switched off in Supabase — then, like any failure here, back to the sign-in page with a message.
 */
export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNext(form.get('next'));
  let target = loginPath({ error: 'oauth_failed', next });
  try {
    if (await googleSignInEnabled({ fresh: true })) {
      const db = await sessionDb();
      const { data, error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: await callbackUrl(next),
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (!error && data?.url) target = data.url;
    }
  } catch (err) {
    console.error('[auth] Google sign-in', err);
  }
  redirect(target);
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email', email };
  const db = await sessionDb();
  const { error } = await db.auth.resetPasswordForEmail(email);
  // Same answer whether or not the account exists (no account enumeration) — except rate limits.
  if (error && errorKey(error) === 'rate_limited') return { error: 'rate_limited', email };
  return { step: 'code', kind: 'recovery', email, next: RESET_PATH };
}

export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = field(form, 'password');
  if (password.length < MIN_PASSWORD) return { error: 'weak_password' };
  const db = await sessionDb();
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: 'session_missing' };
  const { error } = await db.auth.updateUser({ password });
  if (error) return { error: errorKey(error) };
  redirect('/app/invitations');
}

/** Hashed one-time tokens (Supabase's are hex; nothing else is sent on). */
const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * "Continue to Badook" on a one-time sign-in link from Badook Events (docs/partner-api.md): the link
 * only opens a page, and the token is used on this click — so a mail scanner or a chat app's link
 * preview opening the link doesn't use it up.
 */
export async function continueWithLink(form: FormData): Promise<void> {
  const tokenHash = field(form, 'token_hash');
  const next = safeNext(form.get('next'));
  let target = loginPath({ error: 'link_expired', next });
  if (TOKEN_HASH_RE.test(tokenHash)) {
    try {
      const db = await sessionDb();
      const { error } = await db.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
      if (!error) target = next;
    } catch (err) {
      console.error('[auth] sign-in link', err);
    }
  }
  redirect(target);
}

export async function signOut(): Promise<void> {
  const db = await sessionDb();
  await db.auth.signOut();
  redirect('/login');
}

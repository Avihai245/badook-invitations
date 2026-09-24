'use server';

import { redirect } from 'next/navigation';
import type { AppDict } from '@/lib/i18n/app';
import { serverEnv } from '@/lib/env';
import { safeNext, sessionDb } from '@/lib/supabase/session';

export type AuthErrorKey = keyof AppDict['auth']['errors'];
export type AuthState = { error?: AuthErrorKey; sent?: boolean; email?: string } | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

/** Supabase Auth error → a message key (never the raw provider text). */
function errorKey(error: { code?: string; status?: number }): AuthErrorKey {
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'user_already_exists';
    case 'weak_password':
      return 'weak_password';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'invalid_email';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limited';
  }
  return error.status === 429 ? 'rate_limited' : 'generic';
}

const field = (form: FormData, name: string) => String(form.get(name) ?? '');
const callbackUrl = (next: string) =>
  `${serverEnv().INVITES_PUBLIC_BASE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email', email };
  const db = await sessionDb();
  const { error } = await db.auth.signInWithPassword({ email, password: field(form, 'password') });
  if (error) return { error: errorKey(error), email };
  redirect(safeNext(form.get('next')));
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  const password = field(form, 'password');
  const name = field(form, 'name').trim().slice(0, 80);
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email', email };
  if (password.length < MIN_PASSWORD) return { error: 'weak_password', email };
  const db = await sessionDb();
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: name ? { name } : {}, emailRedirectTo: callbackUrl('/app/invitations') },
  });
  if (error) return { error: errorKey(error), email };
  // Email confirmation off → signed in right away; on → "check your inbox".
  if (data.session) redirect('/app/invitations');
  return { sent: true, email };
}

/**
 * "Continue with Google": Supabase sends the visitor to Google and back to /auth/callback with a code
 * (PKCE — the verifier waits in a cookie). A Google account with the email of an existing account
 * signs into that account.
 */
export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNext(form.get('next'));
  const db = await sessionDb();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl(next),
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data?.url) redirect('/login?error=oauth_failed');
  redirect(data.url);
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, 'email').trim();
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email', email };
  const db = await sessionDb();
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl('/auth/update-password'),
  });
  // Same answer whether or not the account exists (no account enumeration) — except rate limits.
  if (error && errorKey(error) === 'rate_limited') return { error: 'rate_limited', email };
  return { sent: true, email };
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

export async function signOut(): Promise<void> {
  const db = await sessionDb();
  await db.auth.signOut();
  redirect('/login');
}

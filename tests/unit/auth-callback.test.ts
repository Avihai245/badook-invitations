import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authAnswerRedirect,
  callbackError,
  failedLinkPath,
  loginPath,
  signedInLanding,
  signupNext,
} from '@/lib/supabase/auth-paths';

// Sign-in plumbing: Supabase's answers that land on a page (its Site URL fallback), the callback's
// messages, where signed-in visitors and new accounts go, and the server actions' redirects.

vi.mock('server-only', () => ({}));

/** next/navigation's redirect() throws; the tests catch where it was going. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const auth = {
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
};
const sessionDb = vi.fn(async () => ({ auth }));
vi.mock('@/lib/supabase/session', async () => ({
  safeNext: (await import('@/lib/supabase/auth-paths')).safeNext,
  sessionDb: () => sessionDb(),
}));
vi.mock('@/lib/request-url', () => ({ requestBaseUrl: async () => 'https://invitations.example.com' }));
const googleSignInEnabled = vi.fn(async (_options?: { fresh?: boolean }) => true);
vi.mock('@/lib/supabase/providers', () => ({
  googleSignInEnabled: (options?: { fresh?: boolean }) => googleSignInEnabled(options),
}));

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  sessionDb.mockClear();
  googleSignInEnabled.mockReset();
  googleSignInEnabled.mockResolvedValue(true);
});

const q = (s: string) => new URLSearchParams(s);

async function redirectOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (err) {
    if (err instanceof Redirected) return err.to;
    throw err;
  }
  throw new Error('no redirect');
}

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('Supabase’s answer on a page (its Site URL fallback)', () => {
  it('goes on to the callback with the same query, next defaulting to the invitations', () => {
    expect(authAnswerRedirect('/', q('code=abc'))).toBe('/auth/callback?code=abc&next=%2Fapp%2Finvitations');
    expect(authAnswerRedirect('/', q('token_hash=t1&type=signup&next=%2Fapp%2Fbilling'))).toBe(
      '/auth/callback?token_hash=t1&type=signup&next=%2Fapp%2Fbilling',
    );
    expect(
      authAnswerRedirect('/contact', q('error=access_denied&error_code=otp_expired&error_description=x')),
    ).toBe(
      '/auth/callback?error=access_denied&error_code=otp_expired&error_description=x&next=%2Fapp%2Finvitations',
    );
    expect(authAnswerRedirect('/app/invitations', q('error_description=Email+link+expired'))).toMatch(
      /^\/auth\/callback\?/,
    );
  });

  it('leaves /auth, /api and pages without an answer alone (our own ?error= included)', () => {
    expect(authAnswerRedirect('/auth/callback', q('code=abc'))).toBeNull();
    expect(authAnswerRedirect('/auth/continue', q('token_hash=abc'))).toBeNull();
    expect(authAnswerRedirect('/api/billing/checkout', q('code=abc'))).toBeNull();
    expect(authAnswerRedirect('/login', q('error=oauth_failed'))).toBeNull();
    expect(authAnswerRedirect('/', q(''))).toBeNull();
  });

  it('the middleware sends it on before anything else', async () => {
    const { middleware } = await import('@/middleware');
    const res = await middleware(new NextRequest('https://invitations.example.com/?code=abc'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://invitations.example.com/auth/callback?code=abc&next=%2Fapp%2Finvitations',
    );
    const invitation = await middleware(
      new NextRequest('https://invitations.example.com/i/noa?error=access_denied&error_code=otp_expired'),
    );
    expect(invitation.headers.get('location')).toMatch(
      /\/auth\/callback\?error=access_denied&error_code=otp_expired/,
    );
    // the callback itself (and the API) go through untouched
    const callback = await middleware(
      new NextRequest('https://invitations.example.com/auth/callback?code=abc'),
    );
    expect(callback.headers.get('location')).toBeNull();
  });
});

describe('the callback’s messages', () => {
  it('an expired or used email link is not a Google failure', () => {
    expect(callbackError(q('error=access_denied&error_code=otp_expired'))).toBe('link_expired');
    expect(
      callbackError(q('error=access_denied&error_description=Email+link+is+invalid+or+has+expired')),
    ).toBe('link_expired');
    expect(callbackError(q('error_code=flow_state_expired'))).toBe('link_expired');
    expect(callbackError(q('error=access_denied&error_description=The+user+canceled'))).toBe('oauth_failed');
    expect(callbackError(q('error=server_error&error_code=unexpected_failure'))).toBe('oauth_failed');
    expect(callbackError(q('code=abc'))).toBeNull();
  });

  it('a link opened in another browser: the email is confirmed — sign in (or ask for the reset again)', () => {
    const missing = { name: 'AuthPKCECodeVerifierMissingError', code: 'pkce_code_verifier_not_found' };
    expect(failedLinkPath(missing, '/app/invitations')).toBe('/login?notice=email_confirmed');
    expect(failedLinkPath(missing, '/app/billing?plan=pro')).toBe(
      '/login?notice=email_confirmed&next=%2Fapp%2Fbilling%3Fplan%3Dpro',
    );
    expect(failedLinkPath(missing, '/auth/update-password')).toBe('/auth/forgot?error=other_browser');
    expect(failedLinkPath({ code: 'flow_state_not_found' }, '/app/invitations')).toBe(
      '/login?error=link_expired',
    );
    expect(loginPath({})).toBe('/login');
  });
});

describe('where people go', () => {
  it('a new account: the plan chosen on the home page, else next', () => {
    expect(signupNext({ plan: 'pro' })).toBe('/app/billing?plan=pro');
    expect(signupNext({ plan: 'business', next: '/app/account' })).toBe('/app/billing?plan=business');
    expect(signupNext({ plan: 'enterprise', next: '/app/account' })).toBe('/app/account');
    expect(signupNext({ next: '//evil.example' })).toBe('/app/invitations');
  });

  it('signed in already: on to next or the plan, never back to a sign-in page', () => {
    expect(signedInLanding('/', q('next=/app/account'))).toBe('/app/invitations');
    expect(signedInLanding('/login', q('next=%2Fapp%2Faccount'))).toBe('/app/account');
    expect(signedInLanding('/login', q('next=/login'))).toBe('/app/invitations');
    expect(signedInLanding('/signup', q('plan=pro'))).toBe('/app/billing?plan=pro');
    expect(signedInLanding('/signup', q(''))).toBe('/app/invitations');
  });
});

describe('/auth/callback', () => {
  const callback = async (query: string) => {
    const { GET } = await import('@/app/(site)/auth/callback/route');
    const res = await GET(new NextRequest(`http://internal:3000/auth/callback?${query}`));
    return res.headers.get('location');
  };

  it('redirects on the public address, to next — a password reset to the new password', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: {}, redirectType: null }, error: null });
    expect(await callback('code=c1&next=%2Fapp%2Fbilling%3Fplan%3Dpro')).toBe(
      'https://invitations.example.com/app/billing?plan=pro',
    );
    // Supabase's fallback lost `next`; the recovery code still says what it is
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: {}, redirectType: 'recovery' },
      error: null,
    });
    expect(await callback('code=c2&next=%2Fapp%2Finvitations')).toBe(
      'https://invitations.example.com/auth/update-password',
    );
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    expect(await callback('token_hash=t1&type=recovery')).toBe(
      'https://invitations.example.com/auth/update-password',
    );
    expect(await callback('token_hash=t1&type=signup')).toBe(
      'https://invitations.example.com/app/invitations',
    );
  });

  it('a different message for each failure', async () => {
    expect(await callback('error=access_denied&error_code=otp_expired&error_description=x')).toBe(
      'https://invitations.example.com/login?error=link_expired',
    );
    expect(await callback('error=access_denied&next=%2Fapp%2Faccount')).toBe(
      'https://invitations.example.com/login?error=oauth_failed&next=%2Fapp%2Faccount',
    );
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthPKCECodeVerifierMissingError', code: 'pkce_code_verifier_not_found' },
    });
    expect(await callback('code=c3')).toBe('https://invitations.example.com/login?notice=email_confirmed');
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
    expect(await callback('token_hash=t2&type=signup')).toBe(
      'https://invitations.example.com/login?error=link_expired',
    );
    expect(await callback('type=signup')).toBe('https://invitations.example.com/login?error=link_invalid');
    auth.exchangeCodeForSession.mockRejectedValue(new Error('network'));
    expect(await callback('code=c4')).toBe('https://invitations.example.com/login?error=generic');
  });
});

describe('the sign-in actions', () => {
  it('Google switched off while the button still shows: back to sign-in with a message, never a throw', async () => {
    const { signInWithGoogle } = await import('@/app/(site)/(auth)/actions');
    googleSignInEnabled.mockResolvedValue(false);
    expect(await redirectOf(() => signInWithGoogle(form({ next: '/app/account' })))).toBe(
      '/login?error=oauth_failed&next=%2Fapp%2Faccount',
    );
    expect(googleSignInEnabled).toHaveBeenCalledWith({ fresh: true });
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    googleSignInEnabled.mockResolvedValue(true);
    auth.signInWithOAuth.mockRejectedValue(new Error('boom'));
    expect(await redirectOf(() => signInWithGoogle(form({})))).toBe('/login?error=oauth_failed');
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://supabase.test/authorize?x' },
      error: null,
    });
    expect(await redirectOf(() => signInWithGoogle(form({ next: '/app/billing?plan=pro' })))).toBe(
      'https://supabase.test/authorize?x',
    );
    expect(auth.signInWithOAuth.mock.calls.at(-1)?.[0].options.redirectTo).toBe(
      'https://invitations.example.com/auth/callback?next=%2Fapp%2Fbilling%3Fplan%3Dpro',
    );
  });

  it('sign-up and password reset send people back to the address they are on, keeping next', async () => {
    const { requestPasswordReset, signUp } = await import('@/app/(site)/(auth)/actions');
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    expect(
      await signUp(
        null,
        form({ email: 'a@example.com', password: 'a-good-password', next: '/app/billing?plan=pro' }),
      ),
    ).toEqual({ sent: true, email: 'a@example.com' });
    expect(auth.signUp.mock.calls[0]![0].options.emailRedirectTo).toBe(
      'https://invitations.example.com/auth/callback?next=%2Fapp%2Fbilling%3Fplan%3Dpro',
    );
    // confirmation off: signed in at once, on to next
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    expect(
      await redirectOf(() =>
        signUp(null, form({ email: 'b@example.com', password: 'a-good-password', next: '/app/account' })),
      ),
    ).toBe('/app/account');
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await requestPasswordReset(null, form({ email: 'a@example.com' }));
    expect(auth.resetPasswordForEmail.mock.calls[0]![1].redirectTo).toBe(
      'https://invitations.example.com/auth/callback?next=%2Fauth%2Fupdate-password',
    );
  });

  it('a partner’s sign-in link is used on the click, not on opening it', async () => {
    const { continueWithLink } = await import('@/app/(site)/(auth)/actions');
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    const token = 'a'.repeat(48);
    expect(await redirectOf(() => continueWithLink(form({ token_hash: token, next: '/app/billing' })))).toBe(
      '/app/billing',
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: token });
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
    expect(await redirectOf(() => continueWithLink(form({ token_hash: token })))).toBe(
      '/login?error=link_expired',
    );
    auth.verifyOtp.mockClear();
    expect(await redirectOf(() => continueWithLink(form({ token_hash: 'x y' })))).toBe(
      '/login?error=link_expired',
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});

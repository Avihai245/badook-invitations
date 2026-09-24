/**
 * Sign-in paths and Supabase Auth's answers, as plain functions: the middleware, the callback route and
 * the sign-in pages share them (no server-only imports — the middleware uses them too). Tested in
 * tests/unit/auth-callback.test.ts.
 */

export const HOME_PATH = '/app/invitations';
export const RESET_PATH = '/auth/update-password';

/** Relative in-app paths only — never an open redirect to another origin. */
export function safeNext(next: unknown, fallback = HOME_PATH): string {
  const value = typeof next === 'string' ? next : '';
  return /^\/(?![/\\])[^\s]*$/.test(value) ? value : fallback;
}

export type PaidPlan = 'pro' | 'business';
export const paidPlanParam = (value: unknown): PaidPlan | null =>
  value === 'pro' || value === 'business' ? value : null;
/** The billing screen, set to start paying for the plan chosen on the home page (?plan=). */
export const planCheckoutPath = (plan: PaidPlan) => `/app/billing?plan=${plan}`;

/** Where a new account goes: the plan chosen on the home page's pricing, else `next`. */
export function signupNext(query: { next?: unknown; plan?: unknown }): string {
  const plan = paidPlanParam(query.plan);
  return plan ? planCheckoutPath(plan) : safeNext(query.next);
}

/**
 * A signed-in visitor of the home page, /login or /signup: on to where they were going (`next`, or the
 * plan they chose) — never back to a sign-in page (that would loop) — else their invitations.
 */
export function signedInLanding(pathname: string, query: URLSearchParams): string {
  if (pathname === '/') return HOME_PATH;
  const target =
    pathname === '/signup'
      ? signupNext({ next: query.get('next'), plan: query.get('plan') })
      : safeNext(query.get('next'));
  return /^\/(login|signup)?([?#]|$)/.test(target) ? HOME_PATH : target;
}

/** The sign-in page with a message and the way back to `next`. */
export function loginPath({ error, notice, next }: { error?: string; notice?: string; next?: string }) {
  const query = new URLSearchParams();
  if (error) query.set('error', error);
  if (notice) query.set('notice', notice);
  if (next && next !== HOME_PATH) query.set('next', next);
  const q = query.toString();
  return q ? `/login?${q}` : '/login';
}

/** Query keys of Supabase Auth's answers: a PKCE code, an email link's token, or an error. */
const AUTH_ANSWER_KEYS = ['code', 'token_hash', 'error_code', 'error_description'];

/**
 * Supabase sends the visitor to the Site URL (the home page) with its answer when the redirect address
 * isn't on its allow list: `/?code=…`, `/?token_hash=…&type=…`, `/?error=…&error_code=…`. Such a visit
 * goes on to /auth/callback with the same query (`next`: the invitations, unless it says otherwise).
 * Pages under /auth and /api are left alone.
 */
export function authAnswerRedirect(pathname: string, query: URLSearchParams): string | null {
  if (/^\/(auth|api)(\/|$)/.test(pathname)) return null;
  if (!AUTH_ANSWER_KEYS.some((key) => query.has(key))) return null;
  const forwarded = new URLSearchParams(query);
  if (!forwarded.get('next')) forwarded.set('next', HOME_PATH);
  return `/auth/callback?${forwarded}`;
}

/** Supabase's error codes for an email link that can't be used (expired, used, its flow gone). */
const LINK_ERROR_CODES = new Set([
  'otp_expired',
  'otp_disabled',
  'flow_state_expired',
  'flow_state_not_found',
  'bad_code_verifier',
]);

/**
 * The error Supabase came back with, as a message: an email link that expired or was already used
 * (error_code otp_expired…) → link_expired; anything else (Google refused, or was canceled) →
 * oauth_failed. null when there is no error.
 */
export function callbackError(query: URLSearchParams): 'link_expired' | 'oauth_failed' | null {
  const code = query.get('error_code');
  const description = query.get('error_description');
  if (!query.get('error') && !code && !description) return null;
  if (code && LINK_ERROR_CODES.has(code)) return 'link_expired';
  return /email link|otp/i.test(description ?? '') ? 'link_expired' : 'oauth_failed';
}

/**
 * A code that couldn't be traded for a session. Its PKCE verifier missing means the link was opened in
 * another browser or app than the one that asked for it: Supabase has already confirmed the email by
 * then, so the visitor only needs to sign in — or, for a password reset, ask again from this browser.
 */
export function failedLinkPath(error: { code?: string; name?: string }, next: string): string {
  const otherBrowser =
    error.code === 'pkce_code_verifier_not_found' || error.name === 'AuthPKCECodeVerifierMissingError';
  if (!otherBrowser) return loginPath({ error: 'link_expired', next });
  return next === RESET_PATH
    ? '/auth/forgot?error=other_browser'
    : loginPath({ notice: 'email_confirmed', next });
}

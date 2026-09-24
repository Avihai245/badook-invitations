import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authAnswerRedirect, signedInLanding } from '@/lib/supabase/auth-paths';

/**
 * Runs on the Node.js runtime — no Edge anywhere (MASTER_PROMPT §1.1 rule 4). Only the host app and the
 * dev pages go through it: the public invitation (/i/…) and the RSVP endpoint never do, so they stay
 * cacheable (responses to middleware rewrites are `private, no-store`) — except for a visit that
 * carries Supabase Auth's answer (below), which is sent on and never rendered.
 *
 * Host app: refreshes the Supabase session cookies (@supabase/ssr) and sends signed-out visitors of
 * /app/… to /login (and signed-in visitors of the home page, /login or /signup to where they were
 * going — `next`, the plan they chose — or their invitations).
 *
 * Supabase falls back to the Site URL (the home page) when a sign-in redirect isn't on its allow list:
 * `/?code=…`, `/?token_hash=…`, `/?error=…&error_code=…` on any page outside /auth and /api go on to
 * /auth/callback with the same query.
 */
/**
 * Read at request time: a literal `process.env.NEXT_PUBLIC_*` is inlined by `next build`, which would
 * freeze whatever the build machine had (e.g. .env.local) instead of the deployment's values.
 */
const runtimeEnv = (name: string): string | undefined => process.env[name] || undefined;

export async function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const answer = authAnswerRedirect(pathname, searchParams);
  if (answer) return NextResponse.redirect(new URL(answer, request.url));
  if (pathname.startsWith('/dev')) {
    const response = NextResponse.next();
    response.headers.set('x-invites-middleware', 'nodejs');
    return response;
  }

  const url = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = runtimeEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // getUser() verifies the token with Supabase Auth and refreshes an expired session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = (path: string) => {
    const target = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    return target;
  };
  if (!user && pathname.startsWith('/app')) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }
  if (user && (pathname === '/' || pathname === '/login' || pathname === '/signup'))
    return redirectTo(signedInLanding(pathname, searchParams));
  return response;
}

export const config = {
  runtime: 'nodejs',
  // (the config is read at build time: literal values only)
  matcher: [
    '/',
    '/dev/:path*',
    '/app/:path*',
    '/login',
    '/signup',
    '/auth/:path*',
    // any other page, only when it carries Supabase Auth's answer (authAnswerRedirect)
    { source: '/((?!api/|auth/|_next/).*)', has: [{ type: 'query', key: 'code' }] },
    { source: '/((?!api/|auth/|_next/).*)', has: [{ type: 'query', key: 'token_hash' }] },
    { source: '/((?!api/|auth/|_next/).*)', has: [{ type: 'query', key: 'error_code' }] },
    { source: '/((?!api/|auth/|_next/).*)', has: [{ type: 'query', key: 'error_description' }] },
  ],
};

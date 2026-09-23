import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs on the Node.js runtime — no Edge anywhere (MASTER_PROMPT §1.1 rule 4).
 * P0: only tags /dev responses so the first Amplify deploy proves Node middleware works there.
 * P1 adds the Supabase session refresh for /app and the `?lang=` rewrite for /i/[slug].
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-invites-middleware', 'nodejs');
  return response;
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/dev/:path*'],
};

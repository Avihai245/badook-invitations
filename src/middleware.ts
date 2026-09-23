import { NextResponse } from 'next/server';

/**
 * Runs on the Node.js runtime — no Edge anywhere (MASTER_PROMPT §1.1 rule 4).
 * Tags /dev responses, proving Node middleware runs on the deployment. (The /i/<slug>?lang= mapping is a
 * next.config rewrite: responses to middleware rewrites are not cacheable.)
 */
export function middleware() {
  const response = NextResponse.next();
  response.headers.set('x-invites-middleware', 'nodejs');
  return response;
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/dev/:path*'],
};

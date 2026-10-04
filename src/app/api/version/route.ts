import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/version — the running build, so a tab left open can tell a new deployment happened. */
export function GET() {
  return NextResponse.json(
    { commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? null },
    { headers: { 'cache-control': 'no-store' } },
  );
}

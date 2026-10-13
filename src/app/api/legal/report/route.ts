import { NextResponse } from 'next/server';
import { reportDeps, legalRequestsActive } from '@/features/legal-requests/server/deps';
import { submitReport } from '@/features/legal-requests/server/report';
import { publicJsonRoute } from '@/lib/public-route';

/**
 * POST /api/legal/report — "Report content / request removal" (anyone, no account). Not found until
 * version 2 of the legal documents is in force.
 */
export async function POST(request: Request) {
  if (!legalRequestsActive())
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  return publicJsonRoute(request, (body, ip) => submitReport(body, { ip }, reportDeps()), {
    label: 'legal-report',
    maxBytes: 16 * 1024,
  });
}

import { NextResponse } from 'next/server';
import { legalRequestsActive, reportDeps } from '@/features/legal-requests/server/deps';
import { checkReportLink } from '@/features/legal-requests/server/report';
import { publicJsonRoute } from '@/lib/public-route';

/**
 * POST /api/legal/report/link { g, a, i } — whether the gallery link a report form was opened with opens
 * a gallery (and an item in it); the item itself is never shown. Not found until version 2 of the legal
 * documents is in force.
 */
export async function POST(request: Request) {
  if (!legalRequestsActive())
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  return publicJsonRoute(request, (body) => checkReportLink(body, reportDeps()), {
    label: 'legal-report-link',
    maxBytes: 2 * 1024,
  });
}

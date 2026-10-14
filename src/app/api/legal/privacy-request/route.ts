import { NextResponse } from 'next/server';
import { legalRequestsActive, requestDeps } from '@/features/legal-requests/server/deps';
import { submitPrivacyRequest } from '@/features/legal-requests/server/privacy-request';
import { publicJsonRoute } from '@/lib/public-route';

/**
 * POST /api/legal/privacy-request — a request about personal information (anyone, no account). Not
 * found until version 2 of the legal documents is in force.
 */
export async function POST(request: Request) {
  if (!legalRequestsActive())
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  return publicJsonRoute(request, (body, ip) => submitPrivacyRequest(body, { ip }, requestDeps()), {
    label: 'legal-privacy-request',
    maxBytes: 16 * 1024,
  });
}

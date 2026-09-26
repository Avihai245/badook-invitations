import { NextResponse } from 'next/server';
import { INSIGHTS } from '@/features/insights/config';
import { beacon } from '@/features/insights/server/api';
import { beaconDeps } from '@/features/insights/server/deps';
import { clientIp } from '@/lib/client-ip';
import { invitationsEnabled } from '@/lib/feature';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

/**
 * POST /api/insights — the invitation page's beacon (features/insights): one page load's state, sent
 * with navigator.sendBeacon (JSON, a couple of KB at most). 204 when taken — and when quietly left out
 * (Global Privacy Control, Do Not Track, crawlers) — so the page can't tell and never retries. Nothing
 * of the request itself is kept: not the address (only a salted hash, for the rate limit, for a day),
 * not the browser.
 */
export async function POST(request: Request) {
  if (!invitationsEnabled()) return NextResponse.json({ ok: false }, { status: 404, headers: HEADERS });
  const text = await request.text();
  if (text.length > INSIGHTS.beacon.maxBytes)
    return NextResponse.json({ ok: false, code: 'too_large' }, { status: 413, headers: HEADERS });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_json' }, { status: 400, headers: HEADERS });
  }
  try {
    const result = await beacon(
      body,
      {
        ip: clientIp(request),
        userAgent: request.headers.get('user-agent') ?? '',
        gpc: request.headers.get('sec-gpc') === '1',
        dnt: request.headers.get('dnt') === '1',
      },
      beaconDeps(),
    );
    if (result.status === 204) return new Response(null, { status: 204, headers: HEADERS });
    return NextResponse.json(result.body, { status: result.status, headers: HEADERS });
  } catch (err) {
    console.error('[insights beacon]', err);
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500, headers: HEADERS });
  }
}

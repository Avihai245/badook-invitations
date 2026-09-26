import 'server-only';
import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { invitationsEnabled } from '@/lib/feature';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: HEADERS });

/**
 * Wraps an API route that a link opens without an account (the live gallery's guests and screen, the
 * entrance stations): POST with a JSON body only (a cross-site form can't post here), a size cap, the
 * link's checks in the handler, no caching, and no internal errors leaking out.
 */
export async function publicJsonRoute(
  request: Request,
  handler: (body: unknown, ip: string | null) => Promise<{ status: number; body: Record<string, unknown> }>,
  { label, maxBytes = 64 * 1024 }: { label: string; maxBytes?: number },
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
    return json(415, { ok: false, code: 'unsupported_media_type' });
  const text = await request.text();
  if (text.length > maxBytes) return json(413, { ok: false, code: 'too_large' });
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return json(400, { ok: false, code: 'invalid_json' });
  }
  try {
    const result = await handler(body, clientIp(request));
    return json(result.status, result.body);
  } catch (err) {
    console.error(`[${label}]`, new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}

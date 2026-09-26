import 'server-only';
import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { invitationsEnabled } from '@/lib/feature';
import type { ApiResult } from './guest-api';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
/** Requests are a few KB (file sizes and types, never files: those go straight to storage). */
const MAX_BYTES = 64 * 1024;

const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: HEADERS });

/**
 * Wraps a guest (or screen) API route of the gallery: POST with a JSON body only, a size cap, the
 * link's checks in the handler, no caching, and no internal errors leaking out.
 */
export async function galleryRoute(
  request: Request,
  handler: (body: unknown, ip: string | null) => Promise<ApiResult>,
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
    return json(415, { ok: false, code: 'unsupported_media_type' });
  const text = await request.text();
  if (text.length > MAX_BYTES) return json(413, { ok: false, code: 'too_large' });
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
    console.error('[gallery api]', new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}

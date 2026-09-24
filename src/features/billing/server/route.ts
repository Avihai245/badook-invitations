import 'server-only';
import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { invitationsEnabled } from '@/lib/feature';
import { getSessionUser } from '@/lib/supabase/session';

const NO_STORE = { 'cache-control': 'no-store' };
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: NO_STORE });

/** A signed-in JSON route of the billing screen (same rules as the host API: JSON bodies only). */
export async function userRoute(
  request: Request,
  handler: (user: User, body: unknown) => Promise<ApiResult>,
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
    return json(415, { ok: false, code: 'unsupported_media_type' });
  const text = await request.text();
  if (text.length > 16_384) return json(413, { ok: false, code: 'too_large' });
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return json(400, { ok: false, code: 'invalid_json' });
  }
  const user = await getSessionUser();
  if (!user) return json(401, { ok: false, code: 'unauthorized' });
  try {
    const result = await handler(user, body);
    return json(result.status, result.body);
  } catch (err) {
    console.error('[billing]', new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}

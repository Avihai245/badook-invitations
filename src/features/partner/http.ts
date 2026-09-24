import 'server-only';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { requestBaseUrl } from '@/lib/request-url';
import { MIN_KEY_LENGTH, partnerAuthorized, partnerKeyUsable, type ApiResult, type PartnerDeps } from './api';
import { partnerDeps } from './server';

const NO_STORE = { 'cache-control': 'no-store' };

let warnedShortKey = false;

/** The partner key, or null while the API is off (unset, or too short to be a real secret — logged once). */
function partnerKey(): string | null {
  const key = serverEnv().INVITES_PARTNER_API_KEY;
  if (!key) return null;
  if (partnerKeyUsable(key)) return key;
  if (!warnedShortKey) {
    warnedShortKey = true;
    console.error(
      `[partner api] off: INVITES_PARTNER_API_KEY has ${key.length} characters, at least ${MIN_KEY_LENGTH} are needed (openssl rand -hex 32)`,
    );
  }
  return null;
}

/** A partner API request: the key (off = 404, wrong = 401), then the handler; errors are logged, not shown. */
export async function partnerRoute(
  request: Request,
  handle: (deps: PartnerDeps) => Promise<ApiResult>,
): Promise<Response> {
  const key = partnerKey();
  if (!key) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE });
  if (!partnerAuthorized(request.headers.get('authorization'), key))
    return NextResponse.json(
      { ok: false, code: 'unauthorized' },
      { status: 401, headers: { ...NO_STORE, 'www-authenticate': 'Bearer' } },
    );
  try {
    const result = await handle(partnerDeps(await requestBaseUrl()));
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (err) {
    console.error('[partner api]', err);
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

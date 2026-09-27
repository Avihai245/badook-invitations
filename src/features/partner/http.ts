import 'server-only';
import { after, NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { requestBaseUrl } from '@/lib/request-url';
import { MIN_KEY_LENGTH, partnerAuthorized, partnerKeyUsable, type ApiResult, type PartnerDeps } from './api';
import { callOf, UnauthorizedBudget, type PartnerEndpoint } from './calls';
import { logPartnerCall, partnerDeps } from './server';

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

/** Calls without the right key are recorded, a limited number an hour (anyone can send them). */
const unauthorized = new UnauthorizedBudget();

/**
 * A partner API request: the key (off = 404, wrong = 401), then the handler; errors are logged, not
 * shown. Each call with the API on is recorded after its answer (calls.ts) for the admin console's
 * API health.
 */
export async function partnerRoute(
  request: Request,
  endpoint: PartnerEndpoint,
  handle: (deps: PartnerDeps) => Promise<ApiResult>,
): Promise<Response> {
  const started = Date.now();
  const key = partnerKey();
  if (!key) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE });
  const record = (result: ApiResult) => {
    const call = callOf(request.method, endpoint, result, Date.now() - started);
    after(() => logPartnerCall(call));
  };
  if (!partnerAuthorized(request.headers.get('authorization'), key)) {
    if (unauthorized.take(Date.now())) record({ status: 401, body: { ok: false, code: 'unauthorized' } });
    return NextResponse.json(
      { ok: false, code: 'unauthorized' },
      { status: 401, headers: { ...NO_STORE, 'www-authenticate': 'Bearer' } },
    );
  }
  try {
    const result = await handle(partnerDeps(await requestBaseUrl()));
    record(result);
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (err) {
    console.error('[partner api]', err);
    record({ status: 500, body: { ok: false, code: 'server_error' } });
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

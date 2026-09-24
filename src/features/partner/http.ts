import 'server-only';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { partnerAuthorized, type ApiResult, type PartnerDeps } from './api';
import { partnerDeps } from './server';

const NO_STORE = { 'cache-control': 'no-store' };

/** A partner API request: the key (off = 404, wrong = 401), then the handler; errors are logged, not shown. */
export async function partnerRoute(
  request: Request,
  handle: (deps: PartnerDeps) => Promise<ApiResult>,
): Promise<Response> {
  const key = serverEnv().INVITES_PARTNER_API_KEY;
  if (!key) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE });
  if (!partnerAuthorized(request.headers.get('authorization'), key))
    return NextResponse.json(
      { ok: false, code: 'unauthorized' },
      { status: 401, headers: { ...NO_STORE, 'www-authenticate': 'Bearer' } },
    );
  try {
    const result = await handle(partnerDeps());
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (err) {
    console.error('[partner api]', err);
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

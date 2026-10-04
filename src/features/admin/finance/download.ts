import 'server-only';
import { NextResponse } from 'next/server';
import { invitationsEnabled } from '@/lib/feature';
import { getRealUser } from '@/lib/supabase/session';
import { can, type Permission } from '../permissions';
import { AdminDbError } from '../server/db';
import { getStaff, type Staff } from '../server/gate';
import type { FileResult } from './api';

const NO_STORE = { 'cache-control': 'no-store' };
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: NO_STORE });

/**
 * A console route that hands the browser a file (the payments' spreadsheet) — the same gate as
 * adminRoute (server/gate.ts), which answers JSON only: the feature flag, a verified user who is staff
 * (else 404) with `perm` (else 403), no caching, no internal error leaking; a database rule comes back
 * as its reason.
 */
export async function adminDownload(
  request: Request,
  perm: Permission,
  handler: (staff: Staff) => Promise<FileResult>,
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  try {
    if (!(await getRealUser())) return json(401, { ok: false, code: 'unauthorized' });
    const staff = await getStaff();
    if (!staff) return json(404, { ok: false, code: 'not_found' });
    if (!can(staff.role, perm)) return json(403, { ok: false, code: 'forbidden' });
    const result = await handler(staff);
    if (result.status !== 200) return json(result.status, { ok: false, code: result.code });
    return new Response(result.body, {
      headers: {
        ...NO_STORE,
        'content-type': result.contentType,
        'content-disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AdminDbError)
      return err.reason === 'forbidden'
        ? json(403, { ok: false, code: 'forbidden' })
        : json(409, { ok: false, code: err.reason });
    console.error('[admin download]', new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}

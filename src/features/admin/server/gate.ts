import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { cache } from 'react';
import { isAdminEmail } from '@/features/billing/server/account';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { rateKey } from '@/lib/links/tokens';
import { serviceDb } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/session';
import { can, permissionsOf, type Permission, type StaffRole } from '../permissions';
import { AdminDbError, adminDb } from './db';

/**
 * Who may open the admin console (/app/admin) and do what there. The signed-in user's role comes from
 * the database (admin_whoami), which keeps the platform's owners (INVITES_ADMIN_EMAILS) on the staff
 * list; every console function checks the role again itself. A visitor who isn't staff gets the
 * site's "not found": the console doesn't say it exists.
 */

export interface Staff {
  userId: string;
  email: string;
  role: StaffRole;
  permissions: Permission[];
}

/** The signed-in staff member (null: signed out, or not staff) — asked once per request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  if (!invitationsEnabled()) return null;
  const user = await getSessionUser();
  if (!user) return null;
  const who = await adminDb.whoami(user.id, serverEnv().INVITES_ADMIN_EMAILS);
  return who
    ? { userId: user.id, email: who.email, role: who.role, permissions: permissionsOf(who.role) }
    : null;
});

/**
 * Whether the host app shows this user the way into the console: one of the platform's owners
 * (INVITES_ADMIN_EMAILS — on the staff list from their first visit) or on the staff list. Never
 * throws (the menu goes without the link).
 */
export async function mayOpenConsole(user: { id: string; email?: string | null }): Promise<boolean> {
  if (isAdminEmail(user.email)) return true;
  return adminDb.isStaff(user.id).catch((err) => (console.error('[admin] is staff', err), false));
}

/**
 * Console pages: the staff member, when they have `perm`. Signed out: to the sign-in page, back here
 * after it. Not staff: not found. Staff without the permission: to the console's overview, which says
 * so.
 */
export async function requireStaff(perm: Permission, next = '/app/admin'): Promise<Staff> {
  if (!invitationsEnabled()) notFound();
  if (!(await getSessionUser())) redirect(`/login?next=${encodeURIComponent(next)}`);
  const staff = await getStaff();
  if (!staff) notFound();
  if (!can(staff.role, perm)) {
    if (perm === 'dashboard.view') notFound();
    redirect(`/app/admin?denied=${encodeURIComponent(perm)}`);
  }
  return staff;
}

const NO_STORE = { 'cache-control': 'no-store' };
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: NO_STORE });

/** Bodies of the console's actions are small (a note, a number). */
export const ADMIN_MAX_JSON_BYTES = 64 * 1024;
/** Changes an hour per staff member (a stolen session can't rewrite everything at once). */
export const ADMIN_ACTIONS_PER_HOUR = 300;

async function actionAllowed(userId: string): Promise<boolean> {
  const { data, error } = await serviceDb().rpc('support_rate_hit', {
    p_key_hash: rateKey('admin', 'actions', userId),
    p_limit: ADMIN_ACTIONS_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (error) throw new Error(`support_rate_hit: ${error.message}`);
  return data === true;
}

/**
 * Wraps a console API route: the feature flag, JSON-only bodies for changes (with the SameSite=Lax
 * session cookie a cross-site form can't post here), a size cap, a verified user who is staff (else
 * 404) with `perm` (else 403), a rate limit on changes, no caching, and no internal error leaking. A
 * database rule the action ran into comes back as its reason: 403 `forbidden`, else 409 `<reason>`.
 */
export async function adminRoute(
  request: Request,
  perm: Permission,
  handler: (staff: Staff, body: unknown) => Promise<ApiResult>,
  { maxBytes = ADMIN_MAX_JSON_BYTES }: { maxBytes?: number } = {},
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  const change = request.method !== 'GET' && request.method !== 'HEAD';
  let body: unknown = undefined;
  if (change) {
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
      return json(415, { ok: false, code: 'unsupported_media_type' });
    const text = await request.text();
    if (text.length > maxBytes) return json(413, { ok: false, code: 'too_large' });
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return json(400, { ok: false, code: 'invalid_json' });
    }
  }
  try {
    if (!(await getSessionUser())) return json(401, { ok: false, code: 'unauthorized' });
    const staff = await getStaff();
    if (!staff) return json(404, { ok: false, code: 'not_found' });
    if (!can(staff.role, perm)) return json(403, { ok: false, code: 'forbidden' });
    if (change && !(await actionAllowed(staff.userId))) return json(429, { ok: false, code: 'rate' });
    const result = await handler(staff, body);
    return json(result.status, result.body);
  } catch (err) {
    if (err instanceof AdminDbError)
      return err.reason === 'forbidden'
        ? json(403, { ok: false, code: 'forbidden' })
        : json(409, { ok: false, code: err.reason });
    console.error('[admin api]', request.method, new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}

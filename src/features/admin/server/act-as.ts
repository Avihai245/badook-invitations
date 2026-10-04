import 'server-only';
import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { serverEnv } from '@/lib/env';
import { signActAs } from '@/lib/supabase/act-as-token';
import { isSuspended } from '@/lib/supabase/auth-paths';
import { can, type Permission } from '../permissions';
import { adminDb } from './db';

/**
 * Remote support: a staff member opens a customer's own app (/app/...) and uses it as them — the
 * customer's invitations, guests, seating, everything — while still signed in as themself, with a
 * banner and a way back. Session: lib/supabase/session.ts getActingAs().
 */
export const ACT_AS_PERMISSION: Permission = 'support.reply';

/** Whether this signed-in user is staff whose role may act as customers (checked on every request). */
export async function mayActAs(user: Pick<User, 'id'>): Promise<boolean> {
  const who = await adminDb
    .whoami(user.id, serverEnv().INVITES_ADMIN_EMAILS)
    .catch((err) => (console.error('[admin] act as: whoami', err), null));
  return !!who && can(who.role, ACT_AS_PERMISSION);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const StartSchema = z.strictObject({ reason: z.string().trim().min(3).max(200) });

export interface ActAsDeps {
  getUser(id: string): Promise<User | null>;
  isStaff(id: string): Promise<boolean>;
  audit(
    actor: string,
    action: string,
    targetType: 'user',
    targetId: string,
    details: Record<string, unknown>,
  ): Promise<number>;
  secret: string;
  now?: number;
}

/**
 * POST /api/admin/users/:id/act-as { reason } — the signed claim to put in the cookie, recorded first
 * (no access without a record). Never oneself, never another staff member (their console stays
 * theirs), never a suspended account.
 */
export async function startActingAs(
  staff: { userId: string },
  userId: string,
  raw: unknown,
  deps: ActAsDeps,
): Promise<{ result: ApiResult; token: string | null }> {
  const fail = (status: number, code: string) => ({
    result: { status, body: { ok: false, code } },
    token: null,
  });
  if (!UUID.test(userId)) return fail(404, 'not_found');
  const parsed = StartSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  if (userId === staff.userId) return fail(409, 'self');
  const target = await deps.getUser(userId);
  if (!target) return fail(404, 'not_found');
  if (isSuspended(target)) return fail(409, 'suspended');
  if (await deps.isStaff(userId)) return fail(409, 'staff');
  await deps.audit(staff.userId, 'users.act_as', 'user', userId, { reason: parsed.data.reason });
  return {
    result: { status: 200, body: { ok: true, redirect: '/app/invitations' } },
    token: signActAs(deps.secret, staff.userId, userId, deps.now),
  };
}

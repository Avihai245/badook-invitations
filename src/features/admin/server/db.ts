import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import { isStaffRole, type StaffRole } from '../permissions';

/**
 * The admin console's database functions (supabase/migrations/*_admin_console.sql): each takes the
 * acting staff member (`actor`, the verified user) and checks their role itself. A refusal or a rule
 * of the database (forbidden, self, last_owner, managed_by_env…) comes back as an AdminDbError with
 * that reason; anything else is thrown on as is.
 */

export class AdminDbError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdminDbError';
  }
}

/** A database rule's reason ('forbidden', 'last_owner'…): the message of a P0001 raise. */
const RULE = /^[a-z_]+$/;

export async function adminRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) {
    if (error.code === 'P0001' && RULE.test(error.message))
      throw new AdminDbError(error.message, `${fn}: ${error.message}`);
    throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  }
  return data as T;
}

export interface Whoami {
  role: StaffRole;
  email: string;
}

export interface StaffMember {
  email: string;
  role: StaffRole;
  /** 'env': one of INVITES_ADMIN_EMAILS (changed there, not in the console) */
  source: 'console' | 'env';
  note: string | null;
  createdAt: string;
  updatedAt: string;
  addedBy: string | null;
  /** the email's account (null: hasn't signed up yet) — it can use the console only when confirmed,
   * not opened by Badook Events and not banned */
  account: {
    userId: string;
    confirmed: boolean;
    partner: boolean;
    banned: boolean;
    lastSignInAt: string | null;
  } | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
}

export type AuditTarget = 'user' | 'invitation' | 'ticket' | 'staff' | 'payment' | 'partner' | 'system';

export const adminDb = {
  /** The user's console role (null: not staff); keeps INVITES_ADMIN_EMAILS on the staff list as owners. */
  async whoami(userId: string, envEmails: readonly string[]): Promise<Whoami | null> {
    const r = await adminRpc<{ role: string; email: string } | null>('admin_whoami', {
      p_user_id: userId,
      p_env_emails: [...envEmails],
    });
    return r && isStaffRole(r.role) ? { role: r.role, email: r.email } : null;
  },
  /** Whether the user may open the console (the host app's menu shows the way in). */
  isStaff: (userId: string) => adminRpc<boolean>('admin_is_staff', { p_user_id: userId }),
  /** An email the partner API may not open or move an account to (a staff member's). */
  emailReserved: (email: string) => adminRpc<boolean>('admin_email_reserved', { p_email: email }),
  staffList: (actor: string) => adminRpc<StaffMember[]>('admin_staff_list', { p_actor: actor }),
  staffSet: (actor: string, email: string, role: StaffRole, note: string | null) =>
    adminRpc<StaffMember>('admin_staff_set', { p_actor: actor, p_email: email, p_role: role, p_note: note }),
  staffRemove: (actor: string, email: string) =>
    adminRpc<boolean>('admin_staff_remove', { p_actor: actor, p_email: email }),
  /** Records an action the server did outside the database (after it; the permission checked). */
  auditAdd: (
    actor: string,
    action: string,
    targetType: AuditTarget | null,
    targetId: string | null,
    details: Record<string, unknown> = {},
  ) =>
    adminRpc<number>('admin_audit_add', {
      p_actor: actor,
      p_action: action,
      p_target_type: targetType,
      p_target_id: targetId,
      p_details: details,
    }),
  auditList: (
    actor: string,
    q: {
      limit?: number;
      before?: number | null;
      targetType?: AuditTarget | null;
      targetId?: string | null;
    } = {},
  ) =>
    adminRpc<AuditEntry[]>('admin_audit_list', {
      p_actor: actor,
      p_limit: q.limit ?? 50,
      p_before: q.before ?? null,
      p_target_type: q.targetType ?? null,
      p_target_id: q.targetId ?? null,
    }),
  /** The console's live channel (made on first use from `candidate`). */
  channel: (actor: string, candidate: string) =>
    adminRpc<string>('admin_channel', { p_actor: actor, p_candidate: candidate }),
  /** The channel for hints from anywhere on the server (null until a console page made it). */
  channelPeek: () => adminRpc<string | null>('admin_channel_peek', {}),
  channelRotate: (actor: string, candidate: string) =>
    adminRpc<string>('admin_channel_rotate', { p_actor: actor, p_candidate: candidate }),
  /** The daily job: the record of actions older than two years goes. */
  maintenance: () => adminRpc<{ audit: number }>('admin_maintenance', {}),
};

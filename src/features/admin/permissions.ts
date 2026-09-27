/**
 * The admin console's roles and what each may do — the same matrix as the database's admin_can
 * (supabase/migrations/*_admin_console.sql), which decides; this copy only shapes the screens (what to
 * show, which buttons). tests/db/admin.test.ts holds the two equal.
 *
 * - owner: everything, including the other owners.
 * - admin: everything but the owners (adds and changes every other role).
 * - support: the customers (with their contact details), their credits, invitations, messages and the
 *   support tickets.
 * - finance: the customers, their credits, the money (cash flow, payments, exports).
 * - viewer: the numbers — no contact details, no actions, no exports.
 */

export const STAFF_ROLES = ['owner', 'admin', 'support', 'finance', 'viewer'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  'dashboard.view',
  'users.view',
  /** full emails and phone numbers (without it they are masked) */
  'users.pii',
  'users.credits',
  'users.plan',
  'users.suspend',
  'invitations.view',
  'invitations.features',
  'messages.view',
  'finance.view',
  'finance.export',
  'support.view',
  'support.reply',
  'partners.view',
  'staff.view',
  'staff.manage',
  /** add, change and remove owners */
  'staff.owners',
  'audit.view',
  'system.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

const GRANTS: Record<StaffRole, readonly Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== 'staff.owners'),
  support: [
    'dashboard.view',
    'users.view',
    'users.pii',
    'users.credits',
    'invitations.view',
    'messages.view',
    'support.view',
    'support.reply',
    'partners.view',
  ],
  finance: [
    'dashboard.view',
    'users.view',
    'users.pii',
    'users.credits',
    'invitations.view',
    'messages.view',
    'finance.view',
    'finance.export',
    'partners.view',
  ],
  viewer: [
    'dashboard.view',
    'users.view',
    'invitations.view',
    'messages.view',
    'finance.view',
    'partners.view',
  ],
};

export const isStaffRole = (v: unknown): v is StaffRole =>
  typeof v === 'string' && (STAFF_ROLES as readonly string[]).includes(v);

export function can(role: StaffRole | null | undefined, perm: Permission): boolean {
  return !!role && GRANTS[role].includes(perm);
}

export function permissionsOf(role: StaffRole): Permission[] {
  return [...GRANTS[role]];
}

/** Roles a member with `role` may give or take away (the database checks it again). */
export function manageableRoles(role: StaffRole): StaffRole[] {
  if (can(role, 'staff.owners')) return [...STAFF_ROLES];
  if (can(role, 'staff.manage')) return STAFF_ROLES.filter((r) => r !== 'owner');
  return [];
}

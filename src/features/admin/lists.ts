import type { StaffRole } from './permissions';

/** The console's lists' sorts (the database's admin_users / admin_invitations take the same). */
export const USER_SORTS = ['newest', 'invitations', 'messages', 'credits', 'last_sign_in'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export const INVITATION_SORTS = ['newest', 'oldest', 'event', 'rsvps'] as const;
export type InvitationSort = (typeof INVITATION_SORTS)[number];

export const INVITATION_STATUSES = ['draft', 'published', 'archived'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/**
 * The most credits one action may add or remove, by role — the database holds the same caps
 * (supabase/migrations/20260927210000_admin_core.sql admin_user_credits).
 */
export const CREDIT_CAPS: Record<StaffRole, number> = {
  owner: 100_000,
  admin: 100_000,
  finance: 1_000,
  support: 100,
  viewer: 0,
};

/** A role's rank: no one suspends a staff member of their own rank or above (admin_role_rank). */
export const STAFF_RANK: Record<StaffRole, number> = {
  owner: 4,
  admin: 3,
  support: 2,
  finance: 2,
  viewer: 1,
};

/** Why the team did something to money, credits or access: 3–200 characters (admin_reason). */
export const REASON_MIN = 3;
export const REASON_MAX = 200;

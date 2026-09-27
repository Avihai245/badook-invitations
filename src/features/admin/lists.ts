/** The console's lists' sorts (the database's admin_users / admin_invitations take the same). */
export const USER_SORTS = ['newest', 'invitations', 'messages', 'credits', 'last_sign_in'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export const INVITATION_SORTS = ['newest', 'oldest', 'event', 'rsvps'] as const;
export type InvitationSort = (typeof INVITATION_SORTS)[number];

export const INVITATION_STATUSES = ['draft', 'published', 'archived'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

import 'server-only';
import type { ActivityItem } from '../activity';
import type { InvitationSort, InvitationStatus, UserSort } from '../lists';
import type { StaffRole } from '../permissions';
import { adminRpc, type StaffMember } from './db';

export { INVITATION_SORTS, USER_SORTS } from '../lists';
export type { InvitationSort, InvitationStatus, UserSort } from '../lists';

/**
 * The console's core in the database (supabase/migrations/20260927210000_admin_core.sql): the
 * overview's numbers and feed, the users and invitations, the team's actions on them, the record of
 * actions in words and the system's state. Each function takes the acting staff member and checks
 * their role itself; contact details come back masked to roles without users.pii.
 */

/** A count now and before: today (since midnight in Israel; yesterday: the same hours a day earlier),
 * the last 7 and 30 days, and the 7 and 30 days before them. */
export interface Periods {
  today: number;
  yesterday: number;
  d7: number;
  prev7: number;
  d30: number;
  prev30: number;
}

export type MessageKind = 'invitation' | 'table' | 'gallery';
export type ByKind = Record<MessageKind, number>;

export interface OverviewDay {
  /** Israel's date, YYYY-MM-DD */
  day: string;
  signups: number;
  invitations: number;
  rsvps: number;
  messages: number;
}

export interface Overview {
  now: string;
  today: string;
  users: {
    total: number;
    new: Periods;
    /** new accounts of the last 30 days, and all of them, by where they came from */
    bySource: { signup: number; google: number; partner: number };
    bySourceTotal: { signup: number; google: number; partner: number };
    active7: number;
    active30: number;
  };
  invitations: {
    total: number;
    status: { draft: number; published: number; archived: number };
    created: Periods;
    /** first publishes: invitations that went live */
    published: Periods;
  };
  rsvps: { responses: Periods; people: Periods; declined: { d7: number; d30: number } };
  whatsapp: {
    /** messages that left (sent, delivered or read) of the three kinds */
    sent: Periods;
    byKind: ByKind;
    /** of the last 30 days' messages: delivered (or read), read, and all that reached an outcome */
    delivery: { delivered: number; read: number; settled: number };
    failed24h: number;
    queued: ByKind;
  };
  credits: { inSystem: number; usedMonth: number; boughtMonth: number; teamMonth: number };
  series: OverviewDay[];
}

export type UserSource = 'signup' | 'google' | `partner:${string}`;
export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type Plan = 'free' | 'pro' | 'business';

export interface UserRow {
  id: string;
  name: string | null;
  /** masked for roles without users.pii */
  email: string;
  phone: string | null;
  source: UserSource;
  venue: string | null;
  plan: Plan;
  planStatus: PlanStatus;
  planRenewsAt: string | null;
  effectivePlan: Plan;
  gift: boolean;
  credits: number;
  invitations: { active: number; total: number };
  messagesSent: number;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  staffRole: StaffRole | null;
  suspended: boolean;
  discount: { percent: number; until: string | null; source: string; active: boolean } | null;
}

export interface UserQuery {
  q?: string;
  source?: 'signup' | 'google' | 'partner';
  plan?: Plan;
  discount?: boolean;
  staff?: boolean;
  suspended?: boolean;
  sort?: UserSort;
  page?: number;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  rows: T[];
}

export interface StatusCounts {
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface Rsvps {
  yes: number;
  no: number;
  people: number;
}

export interface AuditRow {
  id: number;
  at: string;
  actorId: string | null;
  actorEmail: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown>;
}

export interface UserDetail {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  masked: boolean;
  source: UserSource;
  /** the partner's own id for the user (users.pii only) */
  externalId: string | null;
  venue: { name: string; address: string | null } | null;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  bannedUntil: string | null;
  suspended: boolean;
  staff: { role: StaffRole; source: 'console' | 'env' } | null;
  platformOwner: boolean;
  plan: {
    plan: Plan;
    status: PlanStatus;
    renewsAt: string | null;
    effective: Plan;
    /** finance.view only */
    price: number | null;
    provider: string | null;
    gift: boolean;
    hasSubscription: boolean;
    /** a plan the customer pays for now (no gift over it) */
    running: boolean;
  };
  discount: {
    percent: number;
    until: string | null;
    note: string | null;
    source: string;
    setAt: string | null;
    active: boolean;
  } | null;
  credits: {
    balance: number;
    ledger: {
      id: number;
      delta: number;
      reason: string;
      at: string;
      invitationId: string | null;
      by: { name: string | null; email: string; reason: string | null } | null;
    }[];
  };
  invitations: {
    id: string;
    slug: string;
    title: string | null;
    status: 'draft' | 'published' | 'archived';
    eventType: string;
    eventDate: string | null;
    createdAt: string;
    publishedAt: string | null;
    guests: number;
    rsvps: Rsvps;
    messages: number;
  }[];
  messages: Record<MessageKind, StatusCounts>;
  payments: {
    checkouts: {
      id: string;
      product: string;
      amount: number | null;
      provider: string;
      status: 'paid' | 'failed' | 'canceled';
      createdAt: string;
      completedAt: string | null;
    }[];
    renewals: { product: string | null; amount: number | null; status: 'paid' | 'failed'; at: string }[];
  };
  /** audit.view only */
  audit: AuditRow[] | null;
}

export interface InvitationQuery {
  q?: string;
  status?: InvitationStatus;
  eventType?: string;
  template?: string;
  lang?: string;
  /** created, Israel's dates (YYYY-MM-DD), inclusive */
  from?: string;
  to?: string;
  sort?: InvitationSort;
  page?: number;
}

export interface InvitationRow {
  id: string;
  slug: string;
  title: string | null;
  status: 'draft' | 'published' | 'archived';
  eventType: string;
  templateId: string;
  eventDate: string | null;
  locales: string[] | null;
  createdAt: string;
  publishedAt: string | null;
  owner: { id: string; name: string | null; email: string };
  guests: number;
  rsvps: Rsvps;
  messages: number;
  visits: number;
}

export interface InvitationList extends Paged<InvitationRow> {
  counts: {
    total: number;
    status: Partial<Record<'draft' | 'published' | 'archived', number>>;
    eventType: Record<string, number>;
    template: Record<string, number>;
  };
}

export interface InvitationDetail {
  id: string;
  slug: string;
  title: string | null;
  status: 'draft' | 'published' | 'archived';
  eventType: string;
  templateId: string;
  eventDate: string | null;
  startTime: string | null;
  timezone: string | null;
  locales: string[] | null;
  defaultLocale: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  unpublishedChanges: boolean;
  source: { id: string; title: string | null } | null;
  owner: { id: string; name: string | null; email: string };
  features: unknown;
  counts: {
    guests: number;
    guestsWithPhone: number;
    rsvps: Rsvps;
    messages: Record<MessageKind, StatusCounts>;
    gallery: { enabled: boolean | null; items: number; published: number };
    versions: { publishes: number; saves: number };
    visits: { total: number; d30: number };
  };
}

export interface AuditQuery {
  actor?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  before?: number;
  limit?: number;
}

export interface AuditPage {
  rows: AuditRow[];
  /** the id to continue before (null: no more) */
  next: number | null;
  actors: { id: string; email: string; name: string | null }[];
  actions: string[];
}

export interface SystemState {
  now: string;
  jobs: Record<'daily' | 'whatsapp', { finished: string; taken: string } | null>;
  queues: Record<MessageKind, { queued: number; sending: number; oldest: string | null; failed24h: number }>;
  seedVersion: { value: string; updatedAt: string } | null;
  channel: { namedAt: string } | null;
}

/** Drops the keys a query doesn't use (the database reads a missing key as "any"). */
const compact = (q: object) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const coreDb = {
  overview: (actor: string) => adminRpc<Overview>('admin_overview', { p_actor: actor }),
  activity: (actor: string, limit: number) =>
    adminRpc<ActivityItem[]>('admin_activity', { p_actor: actor, p_limit: limit }),
  users: (actor: string, q: UserQuery) =>
    adminRpc<Paged<UserRow>>('admin_users', { p_actor: actor, p_query: compact(q) }),
  user: (actor: string, userId: string) =>
    adminRpc<UserDetail | null>('admin_user', { p_actor: actor, p_user_id: userId }),
  audit: (actor: string, q: AuditQuery) =>
    adminRpc<AuditPage>('admin_audit_search', { p_actor: actor, p_query: compact(q) }),
  credits: (actor: string, userId: string, delta: number, reason: string) =>
    adminRpc<{ balance: number; auditId: number }>('admin_user_credits', {
      p_actor: actor,
      p_user_id: userId,
      p_delta: delta,
      p_reason: reason,
    }),
  /** a plan as a gift through `lastDay` (Israel's date); plan null takes a gift back */
  gift: (
    actor: string,
    userId: string,
    plan: 'pro' | 'business' | null,
    lastDay: string | null,
    reason: string,
  ) =>
    adminRpc<{
      plan: Plan;
      planStatus: PlanStatus;
      planRenewsAt: string | null;
      billingProvider: string | null;
    }>('admin_user_gift', {
      p_actor: actor,
      p_user_id: userId,
      p_plan: plan,
      p_last_day: lastDay,
      p_reason: reason,
    }),
  /** percent null removes the discount */
  discount: (
    actor: string,
    userId: string,
    percent: number | null,
    lastDay: string | null,
    note: string | null,
    reason: string,
  ) =>
    adminRpc<UserDetail['discount']>('admin_user_discount', {
      p_actor: actor,
      p_user_id: userId,
      p_percent: percent,
      p_last_day: lastDay,
      p_note: note,
      p_reason: reason,
    }),
  suspendCheck: (actor: string, userId: string, suspend: boolean, reason: string) =>
    adminRpc<{ email: string; suspended: boolean }>('admin_user_suspend_check', {
      p_actor: actor,
      p_user_id: userId,
      p_suspend: suspend,
      p_reason: reason,
    }),
  /** a staff member added or their role changed (admin_staff_set's rules), with the reason recorded */
  staffChange: (actor: string, email: string, role: StaffRole, note: string | null, reason: string) =>
    adminRpc<StaffMember>('admin_staff_change', {
      p_actor: actor,
      p_email: email,
      p_role: role,
      p_note: note,
      p_reason: reason,
    }),
  /** a staff member removed, with the reason recorded (false: no such member) */
  staffDrop: (actor: string, email: string, reason: string) =>
    adminRpc<boolean>('admin_staff_drop', { p_actor: actor, p_email: email, p_reason: reason }),
  invitations: (actor: string, q: InvitationQuery) =>
    adminRpc<InvitationList>('admin_invitations', { p_actor: actor, p_query: compact(q) }),
  invitation: (actor: string, id: string) =>
    adminRpc<InvitationDetail | null>('admin_invitation', { p_actor: actor, p_id: id }),
  feature: (actor: string, id: string, feature: string, grant: boolean, reason: string) =>
    adminRpc<unknown>('admin_invitation_feature', {
      p_actor: actor,
      p_id: id,
      p_feature: feature,
      p_grant: grant,
      p_reason: reason,
    }),
  system: (actor: string) => adminRpc<SystemState>('admin_system', { p_actor: actor }),
};

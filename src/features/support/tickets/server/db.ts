import 'server-only';
import type { ActivityItem } from '@/features/admin/activity';
import { adminRpc } from '@/features/admin/server/db';
import { serviceDb } from '@/lib/supabase/server';
import { TICKETS, type TicketCategory, type TicketPriority, type TicketStatus } from '../config';
import type {
  AdminSupportList,
  AdminSupportSummary,
  AdminTicket,
  AdminTicketItem,
  ChatLine,
  CustomerTicketRow,
  CustomerTicketSummary,
  InboxQuery,
} from '../types';

/**
 * Typed access to the support tickets' database functions (supabase/migrations/*_support_tickets.sql).
 * The customer's take the verified user and touch only their own tickets; the console's take the
 * acting staff member and check their role themselves (adminRpc: a refusal or a rule comes back as an
 * AdminDbError). A rule of the customer's functions (invalid_subject, invalid_invitation…) comes back
 * as a TicketDbError with that reason.
 */

export class TicketDbError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'TicketDbError';
  }
}

const RULE = /^[a-z_]+$/;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) {
    if (error.code === 'P0001' && RULE.test(error.message))
      throw new TicketDbError(error.message, `${fn}: ${error.message}`);
    throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  }
  return data as T;
}

export interface NewTicket {
  subject: string;
  category: TicketCategory;
  body: string;
  invitationId: string | null;
  locale: 'he' | 'en';
  source: 'app' | 'chat';
  chat: ChatLine[] | null;
}

export interface ContactTicket {
  userId: string | null;
  name: string;
  email: string;
  /** E.164, or empty */
  phone: string;
  subject: string;
  category: TicketCategory;
  body: string;
  locale: 'he' | 'en';
}

/** Who hears about a ticket (the server's emails and the customer's page), unmasked — never sent on. */
export interface NotifyTarget {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  source: 'app' | 'chat' | 'contact';
  status: TicketStatus;
  locale: 'he' | 'en';
  channel: string;
  /** null: a visitor (the contact form), or an account since deleted */
  userId: string | null;
  email: string | null;
  firstName: string | null;
}

export const ticketsDb = {
  /** A new ticket from the app or the assistant (null: an unknown user). */
  open: (userId: string, t: NewTicket) =>
    rpc<CustomerTicketRow | null>('support_ticket_open', {
      p_user_id: userId,
      p_subject: t.subject,
      p_category: t.category,
      p_body: t.body,
      p_invitation_id: t.invitationId,
      p_locale: t.locale,
      p_source: t.source,
      p_chat: t.chat,
    }),
  /** A ticket from the site's contact form (a visitor's, or a signed-in customer's). */
  contact: (t: ContactTicket) =>
    rpc<{ id: string; number: number }>('support_contact_ticket', {
      p_user_id: t.userId,
      p_name: t.name,
      p_email: t.email,
      p_phone: t.phone,
      p_subject: t.subject,
      p_category: t.category,
      p_body: t.body,
      p_locale: t.locale,
    }),
  list: (userId: string) => rpc<CustomerTicketSummary[]>('support_ticket_list', { p_user_id: userId }),
  /** One of the customer's tickets (null: not theirs); `seen`: they are looking at it. */
  get: (userId: string, id: string, seen: boolean) =>
    rpc<CustomerTicketRow | null>('support_ticket_get', { p_user_id: userId, p_id: id, p_seen: seen }),
  reply: (userId: string, id: string, body: string) =>
    rpc<CustomerTicketRow | null>('support_ticket_reply', { p_user_id: userId, p_id: id, p_body: body }),
  close: (userId: string, id: string) =>
    rpc<CustomerTicketRow | null>('support_ticket_close', { p_user_id: userId, p_id: id }),
  /** The customer's tickets with an answer they haven't seen (the app's menu). */
  unread: (userId: string) => rpc<number>('support_unread', { p_user_id: userId }),
  target: (id: string) => rpc<NotifyTarget | null>('support_notify_target', { p_id: id }),
  emailed: (messageId: number, ok: boolean) =>
    rpc<boolean | null>('support_message_emailed', { p_message_id: messageId, p_ok: ok }),
  /** The daily run: answered and silent tickets close; old closed and deleted ones are erased. */
  maintenance: () => rpc<{ autoClosed: number; erased: number; deleted: number }>('support_maintenance', {}),
};

export type TicketsDb = typeof ticketsDb;

export const adminSupportDb = {
  list: (actor: string, q: InboxQuery, pageSize: number = TICKETS.pageSize) =>
    adminRpc<AdminSupportList>('admin_support_list', {
      p_actor: actor,
      p_status: q.status,
      p_scope: q.scope,
      p_category: q.category,
      p_priority: q.priority,
      p_query: q.q || null,
      p_limit: pageSize,
      p_offset: (Math.max(1, q.page) - 1) * pageSize,
    }),
  get: (actor: string, id: string) =>
    adminRpc<AdminTicket | null>('admin_support_get', { p_actor: actor, p_id: id }),
  reply: (actor: string, id: string, body: string, close: boolean) =>
    adminRpc<{ messageId: number; status: TicketStatus }>('admin_support_reply', {
      p_actor: actor,
      p_id: id,
      p_body: body,
      p_close: close,
    }),
  note: (actor: string, id: string, body: string) =>
    adminRpc<{ messageId: number }>('admin_support_note', { p_actor: actor, p_id: id, p_body: body }),
  status: (actor: string, id: string, status: TicketStatus) =>
    adminRpc<{ status: TicketStatus; changed: boolean }>('admin_support_status', {
      p_actor: actor,
      p_id: id,
      p_status: status,
    }),
  priority: (actor: string, id: string, priority: TicketPriority) =>
    adminRpc<{ priority: TicketPriority; changed: boolean }>('admin_support_priority', {
      p_actor: actor,
      p_id: id,
      p_priority: priority,
    }),
  assign: (actor: string, id: string, assignee: string | null) =>
    adminRpc<{ assignee: { userId: string; email: string } | null; changed: boolean }>(
      'admin_support_assign',
      {
        p_actor: actor,
        p_id: id,
        p_assignee: assignee,
      },
    ),
  remove: (actor: string, id: string, reason: string) =>
    adminRpc<boolean>('admin_support_delete', { p_actor: actor, p_id: id, p_reason: reason }),
  summary: (actor: string) => adminRpc<AdminSupportSummary>('admin_support_summary', { p_actor: actor }),
  /** the median time to the team's first answer over the last `days` days */
  replyTime: (actor: string, days = 30) =>
    adminRpc<{ medianMinutes: number | null; answered: number }>('admin_support_reply_time', {
      p_actor: actor,
      p_days: days,
    }),
  activity: (actor: string, limit: number) =>
    adminRpc<ActivityItem[]>('admin_support_activity', { p_actor: actor, p_limit: limit }),
  userTickets: (actor: string, userId: string) =>
    adminRpc<AdminTicketItem[]>('admin_support_user_tickets', { p_actor: actor, p_user_id: userId }),
};

export type AdminSupportDb = typeof adminSupportDb;

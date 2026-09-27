import type { StaffRole } from '@/features/admin/permissions';
import type { RealtimeInfo } from '@/lib/live/types';
import type { TicketCategory, TicketPriority, TicketSource, TicketStatus } from './config';

/** A line of the assistant's conversation attached to a ticket. */
export interface ChatLine {
  role: 'user' | 'assistant';
  content: string;
}

// ─── the customer's view (never a team note, never who on the team wrote) ─────────────────────────

export interface CustomerTicketSummary {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  source: TicketSource;
  createdAt: string;
  /** the customer-visible activity: their message, the team's answer, the closing */
  lastActivityAt: string;
  closedAt: string | null;
  /** the team answered since the customer last looked */
  unread: boolean;
  invitation: { id: string; slug: string; title: string | null } | null;
}

export interface CustomerMessage {
  id: number;
  author: 'customer' | 'team' | 'system';
  body: string | null;
  /** a system line: the ticket closed or opened again */
  event: 'closed' | 'reopened' | null;
  /** who did it: the customer, the team, or (closed) the ticket by itself */
  by: 'customer' | 'team' | 'auto' | null;
  at: string;
}

/** A ticket as the database gives it to its customer (the page's channel, not yet its Realtime info). */
export interface CustomerTicketRow extends CustomerTicketSummary {
  channel: string;
  chat: ChatLine[] | null;
  messages: CustomerMessage[];
}

/** A ticket as its customer's page gets it. */
export interface CustomerTicket extends CustomerTicketSummary {
  chat: ChatLine[] | null;
  messages: CustomerMessage[];
  /** where the page listens for the team's answers (null: Supabase isn't set up) */
  realtime: RealtimeInfo | null;
}

// ─── the console ─────────────────────────────────────────────────────────────────────────────────

export type InboxStatus = TicketStatus | 'all';
export type InboxScope = 'all' | 'mine' | 'unassigned';

export interface InboxQuery {
  status: InboxStatus;
  scope: InboxScope;
  category: TicketCategory | null;
  priority: TicketPriority | null;
  q: string;
  /** 1-based */
  page: number;
}

export interface AdminTicketCustomer {
  /** account · visitor (the contact form, no account) · gone (the account was deleted) */
  kind: 'account' | 'visitor' | 'gone';
  userId: string | null;
  name: string | null;
  /** masked (d***@gmail.com) for roles without users.pii */
  email: string | null;
}

export interface AdminTicketItem {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  locale: 'he' | 'en';
  createdAt: string;
  lastActivityAt: string;
  lastCustomerAt: string | null;
  lastTeamAt: string | null;
  closedAt: string | null;
  /** open: since the customer's last word; waiting: since the team's answer; closed: null */
  waitingSince: string | null;
  customer: AdminTicketCustomer;
  assignee: { userId: string; email: string } | null;
}

export type AdminTicketEvent = 'closed' | 'reopened' | 'status' | 'assigned' | 'priority';

export interface AdminTicketMessage {
  id: number;
  author: 'customer' | 'staff' | 'system';
  /** the staff member who wrote it or did it */
  authorEmail: string | null;
  body: string | null;
  /** a team note (the customer never sees it) */
  internal: boolean;
  event: AdminTicketEvent | null;
  meta: Record<string, string | null | undefined>;
  /** a team answer's email to the customer */
  emailed: 'sent' | 'failed' | null;
  at: string;
}

export interface AdminTicket extends AdminTicketItem {
  chat: ChatLine[] | null;
  invitation: { id: string; slug: string; status: string; title: string | null } | null;
  customer: AdminTicketCustomer & {
    /** masked (+972 5X-XXX-X123) for roles without users.pii */
    phone: string | null;
    plan: 'free' | 'pro' | 'business' | null;
    planStatus: string | null;
    credits: number | null;
    invitations: number | null;
    joinedAt: string | null;
    /** signup · google · partner:<name> */
    source: string | null;
    /** this customer's tickets, this one included */
    tickets: number;
  };
  messages: AdminTicketMessage[];
  /** the team members who may answer (to assign it) */
  agents: { userId: string; email: string; role: StaffRole }[];
}

export interface AdminSupportList {
  items: AdminTicketItem[];
  counts: Record<InboxStatus, number>;
  /** the tab's tickets under the filters */
  total: number;
}

export interface AdminSupportSummary {
  open: number;
  waiting: number;
  unassigned: number;
  highOpen: number;
  oldestOpenAt: string | null;
  openedToday: number;
}

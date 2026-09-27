/**
 * Support tickets (supabase/migrations/*_support_tickets.sql): a customer writes to the team — from
 * the app's "Support" page, from the assistant ("talk to a person", the conversation attached) or
 * through the site's contact form — and the team answers from the admin console. The same limits as
 * the database; shared by the server and the screens.
 */

export const TICKET_CATEGORIES = [
  'support',
  'billing',
  'privacy',
  'accessibility',
  'business',
  'bug',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** open: waiting for the team · waiting: answered, waiting for the customer · closed */
export const TICKET_STATUSES = ['open', 'waiting', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['normal', 'high'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_SOURCES = ['app', 'chat', 'contact'] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const TICKETS = {
  subjectMax: 200,
  bodyMax: 8000,
  /** the assistant's conversation attached to a ticket (as the chat sends it to the server) */
  chat: { messages: 20, chars: 16_000, message: 2000 },
  /** new tickets an hour, per user (or address): the app, the assistant and the contact form together */
  openPerHour: 5,
  /** the customer's messages an hour, per user */
  repliesPerHour: 30,
  /** an answered ticket the customer doesn't come back to closes by itself after these days */
  autoCloseDays: 14,
  /** the customer's ticket page: a check this often while its live connection is down */
  pollMs: 30_000,
  /** the customer's list of tickets (no live channel of its own): a check this often */
  listPollMs: 60_000,
  /** the console's inbox: tickets a page */
  pageSize: 25,
} as const;

export const isTicketCategory = (v: unknown): v is TicketCategory =>
  typeof v === 'string' && (TICKET_CATEGORIES as readonly string[]).includes(v);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/**
 * A name, an address or a title inside a sentence of the other direction (an email in Hebrew, a Hebrew
 * title in English), kept whole: Unicode's first-strong isolate around it (FSI … PDI).
 */
export const isolate = (text: string) => `\u2068${text}\u2069`;

/** A team member as the conversation shows them: their address's name part (the whole one on hover). */
export const staffName = (email: string) => email.split('@')[0] || email;

/**
 * A subject from the message (the contact form has no subject field; the assistant's first question):
 * its first line, cut at a word within `max` characters.
 */
export function subjectFrom(text: string, max = 80): string {
  const line =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? '';
  const flat = line.replace(/\s+/g, ' ');
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

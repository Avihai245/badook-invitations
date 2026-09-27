import 'server-only';
import { z } from 'zod';
import type { RealtimeInfo } from '@/lib/live/types';
import { isUuid, TICKET_CATEGORIES, TICKETS } from '../config';
import type { CustomerTicket, CustomerTicketRow } from '../types';
import { TicketDbError, type TicketsDb } from './db';

/**
 * The customer's side of the support tickets (/app/support, the assistant's "talk to a person"): open a
 * ticket, list theirs, read one (its team answers no longer new), answer, close — plain functions over
 * injected dependencies (tests/unit/support-tickets.test.ts). After each change: the team hears (an
 * email for a new ticket or an answer), the console's open pages refresh, and so do the customer's
 * other open pages of the ticket — all after the answer is sent.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>, status = 200): ApiResult => ({
  status,
  body: { ok: true, ...body },
});
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');

export interface TicketDeps {
  db: Pick<TicketsDb, 'open' | 'list' | 'get' | 'reply' | 'close'>;
  /** true while `who` (u:<user>, ip:<address>) stays within the hour's limit for new tickets / messages */
  rateHit(what: 'ticket' | 'reply', who: string): Promise<boolean>;
  realtime(channel: string): RealtimeInfo | null;
  /** runs a job after the answer is sent (the route's `after`) */
  later(job: () => Promise<unknown>): void;
  /** the team's email: a new ticket, or the customer answered */
  notifyTeam(ticketId: string, kind: 'opened' | 'answered'): Promise<unknown>;
  /** the console's open pages refresh */
  nudge(): Promise<unknown>;
  /** the customer's other open pages of the ticket refresh */
  broadcast(channel: string, kind: string): Promise<unknown>;
}

const ChatSchema = z
  .array(
    z.strictObject({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(TICKETS.chat.message),
    }),
  )
  .min(1)
  .max(TICKETS.chat.messages)
  .refine((lines) => lines.reduce((n, l) => n + l.content.length, 0) <= TICKETS.chat.chars, 'too_long');

export const OpenTicketSchema = z
  .strictObject({
    subject: z.string().trim().min(1).max(TICKETS.subjectMax),
    category: z.enum(TICKET_CATEGORIES),
    body: z.string().trim().min(1).max(TICKETS.bodyMax),
    invitationId: z.string().refine(isUuid).nullable().optional(),
    locale: z.enum(['he', 'en']).default('he'),
    source: z.enum(['app', 'chat']).default('app'),
    chat: ChatSchema.nullable().optional(),
  })
  // the assistant's conversation comes with a ticket from the assistant, and only then
  .refine((t) => (t.source === 'chat') === !!t.chat, { path: ['chat'], message: 'chat' });

export const ReplySchema = z.strictObject({ body: z.string().trim().min(1).max(TICKETS.bodyMax) });

const fieldsOf = (error: z.ZodError) => [...new Set(error.issues.map((i) => String(i.path[0] ?? 'form')))];

/** The ticket for its page: the channel becomes where the page listens. */
export function customerView(row: CustomerTicketRow, deps: Pick<TicketDeps, 'realtime'>): CustomerTicket {
  const { channel, ...rest } = row;
  return { ...rest, realtime: deps.realtime(channel) };
}

/** A database rule on what was sent (invalid_subject, invalid_invitation…) → 400 with the field. */
function refused(err: unknown): ApiResult {
  if (err instanceof TicketDbError && err.reason.startsWith('invalid_'))
    return fail(400, 'invalid', {
      fields: [err.reason === 'invalid_invitation' ? 'invitationId' : err.reason.slice(8)],
    });
  throw err;
}

/** POST /api/support/tickets { subject, category, body, invitationId?, locale, source, chat? } */
export async function openTicket(userId: string, raw: unknown, deps: TicketDeps): Promise<ApiResult> {
  const parsed = OpenTicketSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { fields: fieldsOf(parsed.error) });
  const t = parsed.data;
  if (!(await deps.rateHit('ticket', `u:${userId}`))) return fail(429, 'rate');
  let row: CustomerTicketRow | null;
  try {
    row = await deps.db.open(userId, {
      subject: t.subject,
      category: t.category,
      body: t.body,
      invitationId: t.invitationId ?? null,
      locale: t.locale,
      source: t.source,
      chat: t.chat ?? null,
    });
  } catch (err) {
    return refused(err);
  }
  if (!row) return notFound;
  const id = row.id;
  deps.later(() => Promise.all([deps.notifyTeam(id, 'opened'), deps.nudge()]));
  return ok({ ticket: customerView(row, deps) }, 201);
}

/** GET /api/support/tickets — the customer's tickets. */
export async function listTickets(userId: string, deps: TicketDeps): Promise<ApiResult> {
  return ok({ tickets: await deps.db.list(userId) });
}

/** GET /api/support/tickets/:id[?seen=0] — one of theirs; looking at it makes the answers not new. */
export async function getTicket(
  userId: string,
  id: string,
  seen: boolean,
  deps: TicketDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const row = await deps.db.get(userId, id, seen);
  return row ? ok({ ticket: customerView(row, deps) }) : notFound;
}

/** POST /api/support/tickets/:id/messages { body } — the customer answers (a closed ticket opens again). */
export async function replyTicket(
  userId: string,
  id: string,
  raw: unknown,
  deps: TicketDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = ReplySchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { fields: fieldsOf(parsed.error) });
  if (!(await deps.rateHit('reply', `u:${userId}`))) return fail(429, 'rate');
  let row: CustomerTicketRow | null;
  try {
    row = await deps.db.reply(userId, id, parsed.data.body);
  } catch (err) {
    return refused(err);
  }
  if (!row) return notFound;
  const channel = row.channel;
  deps.later(() =>
    Promise.all([deps.notifyTeam(id, 'answered'), deps.nudge(), deps.broadcast(channel, 'ticket')]),
  );
  return ok({ ticket: customerView(row, deps) });
}

/** POST /api/support/tickets/:id/close — the customer closes it (writing again opens it). */
export async function closeTicket(userId: string, id: string, deps: TicketDeps): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const row = await deps.db.close(userId, id);
  if (!row) return notFound;
  const channel = row.channel;
  deps.later(() => Promise.all([deps.nudge(), deps.broadcast(channel, 'ticket')]));
  return ok({ ticket: customerView(row, deps) });
}

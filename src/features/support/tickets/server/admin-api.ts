import 'server-only';
import { z } from 'zod';
import { AdminDbError } from '@/features/admin/server/db';
import type { Staff } from '@/features/admin/server/gate';
import { isUuid, TICKET_PRIORITIES, TICKET_STATUSES, TICKETS } from '../config';
import type { AdminSupportDb } from './db';

/**
 * The console's actions on a ticket (/app/admin/support/:id): answer the customer (and close), a note
 * for the team, the status, the priority, who handles it, deleting spam — plain functions over injected
 * dependencies (tests/unit/support-tickets.test.ts). The database checks the staff member's role again
 * and records each change. After the answer: the customer's email and their open ticket page for what
 * they see, the console's open pages for everything.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');

export interface AdminTicketDeps {
  db: Pick<AdminSupportDb, 'reply' | 'note' | 'status' | 'priority' | 'assign' | 'remove'>;
  /** runs a job after the answer is sent (the route's `after`) */
  later(job: () => Promise<unknown>): void;
  /** the team's answer by email to the customer (and whether it went, kept on the answer) */
  emailCustomer(ticketId: string, messageId: number, body: string): Promise<unknown>;
  /** the customer's open ticket page refreshes */
  tellCustomer(ticketId: string): Promise<unknown>;
  /** the console's open pages refresh */
  nudge(): Promise<unknown>;
}

const Body = z.string().trim().min(1).max(TICKETS.bodyMax);
export const AdminReplySchema = z.strictObject({ body: Body, close: z.boolean().default(false) });
export const AdminNoteSchema = z.strictObject({ body: Body });
/** One change at a time: the status, the priority or who handles it (null: nobody). */
export const AdminPatchSchema = z.union([
  z.strictObject({ status: z.enum(TICKET_STATUSES) }),
  z.strictObject({ priority: z.enum(TICKET_PRIORITIES) }),
  z.strictObject({ assignee: z.string().refine(isUuid).nullable() }),
]);
export const AdminDeleteSchema = z.strictObject({ reason: z.string().trim().min(1).max(300) });

const fieldsOf = (error: z.ZodError) => [...new Set(error.issues.map((i) => String(i.path[0] ?? 'form')))];

/** The ticket is gone (deleted, or never was): 404 rather than the database's rule. */
async function orNotFound(run: () => Promise<ApiResult>): Promise<ApiResult> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof AdminDbError && err.reason === 'not_found') return notFound;
    throw err;
  }
}

/** POST /api/admin/support/:id/reply { body, close } — support.reply */
export async function adminReply(
  staff: Staff,
  id: string,
  raw: unknown,
  deps: AdminTicketDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = AdminReplySchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { fields: fieldsOf(parsed.error) });
  const { body, close } = parsed.data;
  return orNotFound(async () => {
    const r = await deps.db.reply(staff.userId, id, body, close);
    deps.later(async () => {
      await deps.emailCustomer(id, r.messageId, body);
      await Promise.all([deps.tellCustomer(id), deps.nudge()]);
    });
    return ok({ status: r.status, messageId: r.messageId });
  });
}

/** POST /api/admin/support/:id/note { body } — support.reply; the customer sees nothing of it. */
export async function adminNote(
  staff: Staff,
  id: string,
  raw: unknown,
  deps: AdminTicketDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = AdminNoteSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { fields: fieldsOf(parsed.error) });
  return orNotFound(async () => {
    const r = await deps.db.note(staff.userId, id, parsed.data.body);
    deps.later(() => deps.nudge());
    return ok({ messageId: r.messageId });
  });
}

/** PATCH /api/admin/support/:id { status } | { priority } | { assignee } — support.reply */
export async function adminUpdate(
  staff: Staff,
  id: string,
  raw: unknown,
  deps: AdminTicketDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = AdminPatchSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const patch = parsed.data;
  return orNotFound(async () => {
    if ('status' in patch) {
      const r = await deps.db.status(staff.userId, id, patch.status);
      // the customer sees the status (closed, open again)
      if (r.changed) deps.later(() => Promise.all([deps.tellCustomer(id), deps.nudge()]));
      return ok({ status: r.status, changed: r.changed });
    }
    if ('priority' in patch) {
      const r = await deps.db.priority(staff.userId, id, patch.priority);
      if (r.changed) deps.later(() => deps.nudge());
      return ok({ priority: r.priority, changed: r.changed });
    }
    const r = await deps.db.assign(staff.userId, id, patch.assignee);
    if (r.changed) deps.later(() => deps.nudge());
    return ok({ assignee: r.assignee, changed: r.changed });
  });
}

/** POST /api/admin/support/:id/delete { reason } — support.reply: spam, gone from every list. */
export async function adminDelete(
  staff: Staff,
  id: string,
  raw: unknown,
  deps: AdminTicketDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = AdminDeleteSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { fields: ['reason'] });
  const done = await deps.db.remove(staff.userId, id, parsed.data.reason);
  if (!done) return notFound;
  deps.later(() => deps.nudge());
  return ok({});
}

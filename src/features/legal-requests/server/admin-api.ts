import 'server-only';
import { z } from 'zod';
import type { Staff } from '@/features/admin/server/gate';
import {
  isFinalReportAction,
  isFinalRequestStatus,
  isUuid,
  LEGAL_REQUESTS,
  NOTE_REQUIRED_ACTIONS,
  REPORT_ACTIONS,
  REQUEST_SET_STATUSES,
} from '../config';
import { reporterOutcomeEmail, reportOutcomeOf, requestStatusEmail } from '../email';
import type { LegalDb } from './db';
import { notice, type ApiResult, type LegalConfig, type SendMail } from './common';

/**
 * The console's actions on a report and on a privacy request (/app/admin/legal) — plain functions over
 * injected dependencies (tests/unit/legal-requests-admin.test.ts). The database checks the staff
 * member's role again and records the action (media_report_events + the console's audit log); a rule it
 * enforces ('forbidden' for removing as support, 'note required') comes back as an AdminDbError that the
 * route turns into 403 / 409.
 *
 * A decision that ends a report tells the reporter the outcome — when they gave an email — with a FIXED
 * text per outcome in the report's language; the staff's note is never in it. A final status of a privacy
 * request tells the requester the same way, with the note only when the staff ticked "include the note".
 * Whether the email went is recorded and returned (`emailed`), so the console says so plainly.
 */

export interface AdminLegalDeps {
  db: Pick<
    LegalDb,
    'act' | 'reportTarget' | 'setStatus' | 'requestTarget' | 'markReportNotified' | 'markRequestNotified'
  >;
  send: SendMail;
  /** the gallery's open pages are told something changed (an item hidden, shown again, removed) */
  refreshGallery(invitationId: string): Promise<void>;
  config: LegalConfig;
}

const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

/** 'sent' · 'failed' (recorded as not sent: follow up by hand) · 'none' (nobody to write to) */
export type Emailed = 'sent' | 'failed' | 'none';

/** The decisions that can change an item (hide, restore, remove — and keep / dismiss, which put a held item back). */
const ITEM_ACTIONS: readonly string[] = ['hide', 'restore', 'remove', 'keep', 'dismiss'];

export const ReportActionSchema = z.strictObject({
  action: z.enum(REPORT_ACTIONS),
  note: z.string().trim().max(LEGAL_REQUESTS.reportNote).default(''),
});

export const RequestStatusSchema = z.strictObject({
  status: z.enum(REQUEST_SET_STATUSES),
  note: z.string().trim().max(LEGAL_REQUESTS.requestNote).default(''),
  /** the staff ticked "include the note in the email" */
  includeNote: z.boolean().default(false),
});

/** POST /api/admin/legal/reports/:id { action, note } — support.reply (removing: users.suspend, checked by the database) */
export async function adminReportAct(
  staff: Staff,
  id: string,
  raw: unknown,
  deps: AdminLegalDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = ReportActionSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const { action, note } = parsed.data;
  if (!note && (NOTE_REQUIRED_ACTIONS as readonly string[]).includes(action))
    return fail(400, 'note_required');
  if (action === 'note' && !note) return fail(400, 'note_required');
  const before = await deps.db.reportTarget(id);
  if (!before) return fail(404, 'not_found');

  const report = await deps.db.act(staff.userId, id, action, note || null);
  // what changes an item reaches the open pages at once (best effort: the hint never fails the action)
  if (before.invitationId && ITEM_ACTIONS.includes(action)) {
    try {
      await deps.refreshGallery(before.invitationId);
    } catch (err) {
      console.error('[legal] gallery refresh failed', err);
    }
  }

  let emailed: Emailed = 'none';
  // the first time the report is resolved, to whoever left an address
  if (isFinalReportAction(action) && !before.resolvedAt && before.reporterEmail) {
    const after = await deps.db.reportTarget(id);
    const to = after?.reporterEmail;
    if (after && to) {
      emailed = 'failed';
      await notice(
        'reporter',
        async () => {
          const sent = await deps.send({
            to,
            ...reporterOutcomeEmail({
              locale: after.locale,
              brand: deps.config.brand,
              number: after.number,
              outcome: reportOutcomeOf(after.resolution),
              contactUrl: `${deps.config.site}/contact`,
            }),
            ...(deps.config.teamEmail ? { replyTo: deps.config.teamEmail } : {}),
          });
          if (sent) emailed = 'sent';
          return sent;
        },
        (sent) => deps.db.markReportNotified(id, 'reporter', sent),
      );
    }
  }
  return ok({ report, emailed });
}

/** POST /api/admin/legal/requests/:id { status, note, includeNote } — support.reply */
export async function adminRequestSet(
  staff: Staff,
  id: string,
  raw: unknown,
  deps: AdminLegalDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = RequestStatusSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const { status, note, includeNote } = parsed.data;
  const final = isFinalRequestStatus(status);
  if (final && !note) return fail(400, 'note_required');
  const before = await deps.db.requestTarget(id);
  if (!before) return fail(404, 'not_found');

  const request = await deps.db.setStatus(staff.userId, id, status, note || null);

  let emailed: Emailed = 'none';
  if (final && before.status !== status) {
    emailed = 'failed';
    await notice(
      'requester',
      async () => {
        const sent = await deps.send({
          to: before.email,
          ...requestStatusEmail({
            locale: before.locale,
            brand: deps.config.brand,
            number: before.number,
            status: status as 'fulfilled' | 'partly' | 'declined' | 'closed',
            note: includeNote ? note : null,
            contactUrl: `${deps.config.site}/contact`,
          }),
          ...(deps.config.teamEmail ? { replyTo: deps.config.teamEmail } : {}),
        });
        if (sent) emailed = 'sent';
        return sent;
      },
      (sent) => deps.db.markRequestNotified(id, 'requester', sent),
    );
  }
  return ok({ request, emailed });
}

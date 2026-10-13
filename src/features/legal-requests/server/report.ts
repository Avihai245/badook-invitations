import 'server-only';
import { z } from 'zod';
import { AdminDbError } from '@/features/admin/server/db';
import { sha256Hex, TOKEN_RE } from '@/features/live-gallery/server/tokens';
import {
  adminLegalHref,
  isUuid,
  LEGAL_REQUESTS,
  PHONE_RE,
  REPORT_CATEGORIES,
  REPORT_ROLES,
  type ReportCategory,
} from '../config';
import { hostReportEmail, teamReportEmail } from '../email';
import type { LegalDb, ReportStored } from './db';
import { fail, fieldsOf, notice, ok, type ApiResult, type LegalConfig, type SendMail } from './common';

/**
 * POST /api/legal/report — "Report content / request removal". Anyone sends it, with or without an
 * account; the item is never named by the reporter but resolved by the server from the gallery link
 * they hold (the upload link `g` or the album link `a`, and the item `i` in that gallery), so a report
 * can only point at what its sender could see. Plain functions over injected dependencies
 * (tests/unit/legal-requests.test.ts).
 *
 * Stored first: the database row is the record. An urgent report (a child, an intimate image) hides a
 * published item at once, reversibly. Then the notices go out, best effort, each recorded as sent or
 * not: the team's (a number, the category, the console link), and the one who created the invitation
 * (that an item was reported, the category — never by whom). The reporter's answer does not depend on
 * them and never says an email was sent.
 */

export interface ReportDeps {
  db: Pick<
    LegalDb,
    | 'invitationOfGalleryLink'
    | 'invitationOfAlbumLink'
    | 'itemVisible'
    | 'submitReport'
    | 'markReportNotified'
    | 'countSince'
    | 'earlierReport'
    | 'ownerEmail'
  >;
  send: SendMail;
  /** runs the notices after the answer (the route's `after`) */
  later(job: () => Promise<unknown>): void;
  /** the visitor's address as the database keeps it: a salted hash, never the address */
  hashIp(ip: string | null): string;
  /** the gallery's open pages are told something changed (an item hidden): best effort, never throws */
  refreshGallery(invitationId: string): Promise<void>;
  config: LegalConfig;
}

const email = z
  .string()
  .trim()
  .max(LEGAL_REQUESTS.email)
  .refine((v) => v === '' || z.email().safeParse(v).success);
const phone = z
  .string()
  .trim()
  .max(LEGAL_REQUESTS.phone.max)
  .refine((v) => v === '' || (PHONE_RE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 5));

export const ReportSchema = z
  .strictObject({
    category: z.enum(REPORT_CATEGORIES),
    /** an intimate or sexual image shared without consent (a flag of "harmful") */
    intimate: z.boolean().default(false),
    role: z.enum(REPORT_ROLES),
    description: z.string().trim().min(LEGAL_REQUESTS.description.min).max(LEGAL_REQUESTS.description.max),
    name: z.string().trim().max(LEGAL_REQUESTS.name).default(''),
    email: email.default(''),
    phone: phone.default(''),
    /** what the reporter typed when no link pointed at the item */
    reference: z.string().trim().max(LEGAL_REQUESTS.reference).default(''),
    /** the gallery's upload link, or the album's, and the item in it — as the link carried them */
    g: z.string().trim().max(100).optional(),
    a: z.string().trim().max(100).optional(),
    i: z.string().trim().max(100).optional(),
    locale: z.enum(['he', 'en']).default('he'),
    /** a field people don't see: bots fill it in */
    website: z.string().max(200).default(''),
  })
  .superRefine((r, ctx) => {
    // a copyright claim can only be processed with who makes it and a way to reach them
    if (r.category === 'copyright') {
      if (!r.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'name' });
      if (!r.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'email' });
    }
  });

export type ReportInput = z.infer<typeof ReportSchema>;

export type ResolvedLink =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'ok'; invitationId: string; itemId: string | null; surface: 'gallery' | 'album' };

/**
 * The invitation (and the item) a reporter's link points at. `none`: no link at all; `invalid`: a link
 * that opens nothing, an item that is not there (deleted, not published, another event's) — told apart
 * from `ok` only, never saying which part failed.
 */
export async function resolveReportLink(
  q: { g?: string | undefined; a?: string | undefined; i?: string | undefined },
  deps: Pick<ReportDeps, 'db'>,
): Promise<ResolvedLink> {
  const item = q.i?.trim() || null;
  const gallery = q.g?.trim() || null;
  const album = q.a?.trim() || null;
  if (!gallery && !album) return item ? { kind: 'invalid' } : { kind: 'none' };
  let invitationId: string | null = null;
  let surface: 'gallery' | 'album' = 'gallery';
  if (gallery && TOKEN_RE.test(gallery))
    invitationId = await deps.db.invitationOfGalleryLink(sha256Hex(gallery));
  if (!invitationId && album && TOKEN_RE.test(album)) {
    invitationId = await deps.db.invitationOfAlbumLink(sha256Hex(album));
    surface = 'album';
  }
  if (!invitationId) return { kind: 'invalid' };
  if (item === null) return { kind: 'ok', invitationId, itemId: null, surface };
  if (!isUuid(item) || !(await deps.db.itemVisible(invitationId, item))) return { kind: 'invalid' };
  return { kind: 'ok', invitationId, itemId: item, surface };
}

/** POST /api/legal/report/link — what the form's link opens (the page holds no gallery code of its own). */
export async function checkReportLink(raw: unknown, deps: Pick<ReportDeps, 'db'>): Promise<ApiResult> {
  const parsed = z
    .strictObject({
      g: z.string().trim().max(100).optional(),
      a: z.string().trim().max(100).optional(),
      i: z.string().trim().max(100).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const link = await resolveReportLink(parsed.data, deps);
  return ok({ state: link.kind, item: link.kind === 'ok' && link.itemId !== null });
}

export async function submitReport(
  raw: unknown,
  { ip }: { ip: string | null },
  deps: ReportDeps,
): Promise<ApiResult> {
  const parsed = ReportSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { fields: fieldsOf(parsed.error) });
  const r = parsed.data;
  // a bot: answered as if it worked, stored nowhere
  if (r.website) return ok({ number: null, hidden: false, urgent: false });

  const link = await resolveReportLink(r, deps);
  const linked = link.kind === 'ok';
  // a link to the gallery without an item (the footer's) says nothing of which photo: then the reporter
  // has to say it (who uploaded it, when, what it shows)
  if (linked && link.itemId === null && !r.reference) return fail(400, 'invalid', { fields: ['reference'] });
  if (!linked && !r.reference) {
    // a link that opens nothing: the form then asks for a description of where the content is
    return link.kind === 'invalid'
      ? fail(422, 'link_invalid')
      : fail(400, 'invalid', { fields: ['reference'] });
  }
  const invitationId = linked ? link.invitationId : null;
  const itemId = linked ? link.itemId : null;
  const intimate = r.intimate && r.category === 'harmful';

  const ipHash = deps.hashIp(ip);
  // the same address reporting the same item for the same reason again is the same report (not when the
  // address is unknown: that bucket is everyone)
  if (itemId && ip) {
    const earlier = await deps.db.earlierReport(ipHash, itemId, r.category, LEGAL_REQUESTS.duplicateHours);
    if (earlier) return ok({ number: earlier.number, hidden: earlier.hidden, urgent: earlier.urgent });
  }
  const { perHour, perDay } = LEGAL_REQUESTS.rate;
  if (
    (await deps.db.countSince('media_reports', ipHash, 1)) >= perHour ||
    (await deps.db.countSince('media_reports', ipHash, 24)) >= perDay
  )
    return fail(429, 'rate');

  let stored: ReportStored;
  try {
    stored = await deps.db.submitReport({
      invitation_id: invitationId,
      item_id: itemId,
      surface: linked ? link.surface : 'link',
      category: r.category,
      intimate,
      role: r.role,
      description: r.description,
      reference: r.reference || null,
      reporter_name: r.name || null,
      reporter_email: r.email || null,
      reporter_phone: r.phone || null,
      locale: r.locale,
      ip_hash: ipHash,
    });
  } catch (err) {
    // the item went away between the check and the insert
    if (err instanceof AdminDbError && err.reason === 'item_not_found') return fail(422, 'link_invalid');
    throw err;
  }

  // a held item leaves the feed, the screen and the host's tab at once; then the notices
  if (stored.hidden && invitationId)
    deps.later(async () => {
      try {
        await deps.refreshGallery(invitationId);
      } catch (err) {
        console.error('[legal] gallery refresh failed', err);
      }
    });
  deps.later(() => notifyReport(stored, { invitationId, category: r.category, locale: r.locale }, deps));
  return ok({ number: stored.number, hidden: stored.hidden, urgent: stored.urgent });
}

/** The team's notice and the invitation owner's, each recorded as sent or not. Never throws. */
export async function notifyReport(
  stored: ReportStored,
  report: { invitationId: string | null; category: ReportCategory; locale: 'he' | 'en' },
  deps: Pick<ReportDeps, 'db' | 'send' | 'config'>,
): Promise<void> {
  const { config } = deps;
  await Promise.all([
    notice(
      'team',
      async () => {
        // no address to write to: recorded as not sent, so the console shows it
        if (!config.teamEmail) return false;
        return deps.send({
          to: config.teamEmail,
          ...teamReportEmail({
            brand: config.brand,
            number: stored.number,
            category: report.category,
            urgent: stored.urgent,
            hidden: stored.hidden,
            consoleUrl: `${config.site}${adminLegalHref('reports', stored.id)}`,
          }),
        });
      },
      (sent) => deps.db.markReportNotified(stored.id, 'team', sent),
    ),
    report.invitationId
      ? notice(
          'host',
          async () => {
            const to = await deps.db.ownerEmail(report.invitationId as string);
            if (!to) return false;
            return deps.send({
              to,
              ...hostReportEmail({
                locale: report.locale,
                brand: config.brand,
                category: report.category,
                hidden: stored.hidden,
                appUrl: `${config.site}/app/invitations`,
              }),
            });
          },
          (sent) => deps.db.markReportNotified(stored.id, 'host', sent),
        )
      : Promise.resolve(),
  ]);
}

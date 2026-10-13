import 'server-only';
import { z } from 'zod';
import {
  adminLegalHref,
  LEGAL_REQUESTS,
  PHONE_RE,
  REQUEST_KINDS,
  REQUEST_RELATIONS,
  type RequestKind,
} from '../config';
import { requestAckEmail, teamRequestEmail } from '../email';
import type { LegalDb, RequestStored } from './db';
import { fail, fieldsOf, notice, ok, type ApiResult, type LegalConfig, type SendMail } from './common';

/**
 * POST /api/legal/privacy-request — a request about personal information (access, correction, deletion,
 * restriction, a photo's removal, a child's photo, the exclusion from face search). Anyone sends it. The
 * database stores it with its due date (30 days: the reply the law asks for) and that row is the
 * record; afterwards, best effort and recorded as sent or not, the requester gets an acknowledgement
 * with the number and the due date, and the team (the privacy mailbox) a notice with the console link.
 * The answer to the requester never depends on the emails and never says one was sent.
 */

export interface RequestDeps {
  db: Pick<LegalDb, 'submitRequest' | 'markRequestNotified' | 'countSince'>;
  send: SendMail;
  later(job: () => Promise<unknown>): void;
  hashIp(ip: string | null): string;
  config: LegalConfig;
}

export const PrivacyRequestSchema = z.strictObject({
  kind: z.enum(REQUEST_KINDS),
  relation: z.enum(REQUEST_RELATIONS),
  name: z.string().trim().min(1).max(LEGAL_REQUESTS.name),
  email: z.string().trim().max(LEGAL_REQUESTS.email).pipe(z.email()),
  phone: z
    .string()
    .trim()
    .max(LEGAL_REQUESTS.phone.max)
    .refine((v) => v === '' || (PHONE_RE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 5))
    .default(''),
  details: z.string().trim().min(LEGAL_REQUESTS.details.min).max(LEGAL_REQUESTS.details.max),
  reference: z.string().trim().max(LEGAL_REQUESTS.reference).default(''),
  locale: z.enum(['he', 'en']).default('he'),
  /** a field people don't see: bots fill it in */
  website: z.string().max(200).default(''),
});

export async function submitPrivacyRequest(
  raw: unknown,
  { ip }: { ip: string | null },
  deps: RequestDeps,
): Promise<ApiResult> {
  const parsed = PrivacyRequestSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { fields: fieldsOf(parsed.error) });
  const r = parsed.data;
  if (r.website) return ok({ number: null, dueAt: null });

  const ipHash = deps.hashIp(ip);
  const { perHour, perDay } = LEGAL_REQUESTS.rate;
  if (
    (await deps.db.countSince('privacy_requests', ipHash, 1)) >= perHour ||
    (await deps.db.countSince('privacy_requests', ipHash, 24)) >= perDay
  )
    return fail(429, 'rate');

  const stored = await deps.db.submitRequest({
    kind: r.kind,
    relation: r.relation,
    name: r.name,
    email: r.email,
    phone: r.phone || null,
    details: r.details,
    reference: r.reference || null,
    locale: r.locale,
    ip_hash: ipHash,
  });
  deps.later(() => notifyRequest(stored, { kind: r.kind, email: r.email, locale: r.locale }, deps));
  return ok({ number: stored.number, dueAt: stored.dueAt });
}

/** The requester's acknowledgement and the team's notice, each recorded as sent or not. Never throws. */
export async function notifyRequest(
  stored: RequestStored,
  request: { kind: RequestKind; email: string; locale: 'he' | 'en' },
  deps: Pick<RequestDeps, 'db' | 'send' | 'config'>,
): Promise<void> {
  const { config } = deps;
  await Promise.all([
    notice(
      'requester',
      () =>
        deps.send({
          to: request.email,
          ...requestAckEmail({
            locale: request.locale,
            brand: config.brand,
            number: stored.number,
            dueAt: stored.dueAt,
            privacyUrl: `${config.site}/privacy`,
          }),
          ...(config.teamEmail ? { replyTo: config.teamEmail } : {}),
        }),
      (sent) => deps.db.markRequestNotified(stored.id, 'requester', sent),
    ),
    notice(
      'team',
      async () => {
        if (!config.teamEmail) return false;
        return deps.send({
          to: config.teamEmail,
          ...teamRequestEmail({
            brand: config.brand,
            number: stored.number,
            kind: request.kind,
            dueAt: stored.dueAt,
            consoleUrl: `${config.site}${adminLegalHref('requests', stored.id)}`,
          }),
        });
      },
      (sent) => deps.db.markRequestNotified(stored.id, 'team', sent),
    ),
  ]);
}

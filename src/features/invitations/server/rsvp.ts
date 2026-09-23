import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { RsvpSubmissionSchema } from '../contracts/schemas';
import type {
  DietaryKey,
  InvitationDocument,
  RsvpConfig,
  RsvpResult,
  RsvpSubmission,
} from '../contracts/types';
import { t } from '../i18n/dictionary';
import { endOfDayUtc } from '../lib/dates';
import type { ReplySummary } from '../lib/notify-email';
import { toE164 } from '../lib/phone';
import type { PublishedInvitation } from './published';

/**
 * POST /api/invitations/rsvp (§4, §6, §9): everything except I/O, so it is unit-testable.
 * Order: size → JSON → schema → honeypot (fake success) → timing → invitation → rate limit →
 * deadline → rules of the invitation's RSVP section → sanitize → one-transaction write.
 */

export const MAX_BODY_BYTES = 20 * 1024;
export const MIN_FILL_MS = 3000;
export const RATE_LIMIT = { count: 10, windowSeconds: 60 };

export interface ResponseRow {
  attending: boolean;
  locale: string;
  primary_name: string;
  phone: string | null;
  email: string | null;
  adults_count: number;
  children_count: number;
  message: string | null;
  answers: Record<string, string | boolean>;
  ip_hash: string | null;
}

export interface AttendeeRow {
  kind: 'adult' | 'child';
  position: number;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  dietary: DietaryKey[];
  dietary_notes: string | null;
}

export interface RsvpDeps {
  loadInvitation(slug: string): Promise<PublishedInvitation | null>;
  /** records the attempt; false once over the limit */
  rateHit(invitationId: string, ipHash: string): Promise<boolean>;
  submit(input: {
    invitationId: string;
    response: ResponseRow;
    attendees: AttendeeRow[];
    existingTokenHash: string | null;
    newTokenHash: string;
  }): Promise<{ id: string; replaced: boolean }>;
  now(): number;
  ipHashSalt: string;
}

export interface RsvpOutcome {
  status: number;
  body: RsvpResult;
  /** a reply really saved (not the honeypot's fake success): what the host notification needs */
  saved?: { invitationId: string; doc: InvitationDocument; reply: ReplySummary };
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

const fail = (
  status: number,
  code: 'closed' | 'invalid' | 'rate_limited' | 'not_found',
  fieldErrors?: Record<string, string>,
): RsvpOutcome => ({
  status,
  body:
    fieldErrors && Object.keys(fieldErrors).length ? { ok: false, code, fieldErrors } : { ok: false, code },
});

/** Render as text, never HTML (§9): drop tags and control characters, trim. */
export function sanitize(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}
const clean = (s: string | null | undefined): string | null => {
  const v = s == null ? '' : sanitize(s);
  return v === '' ? null : v;
};
/** Stored in E.164 when it parses (Israeli numbers without +972 included) — hosts call and export them. */
const cleanPhone = (s: string | null | undefined): string | null => {
  const v = clean(s);
  return v === null ? null : toE164(v);
};

const PHONE_OK = (s: string) => /^\d{9,15}$/.test(s.replace(/\D/g, '')) && /^[\d\s()+.-]+$/.test(s);
const EMAIL_OK = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
const ALLERGIES: DietaryKey[] = ['nut_allergy', 'other_allergy'];

/** Rules of the invitation's RSVP section (§3, §6), with localized messages keyed like the form. */
export function validateAgainstConfig(sub: RsvpSubmission, config: RsvpConfig): Record<string, string> {
  const L = sub.locale;
  const e: Record<string, string> = {};
  const req = t(L, 'rsvp.error.required');
  const allowedDiet = new Set<DietaryKey>(config.dietary.enabled ? config.dietary.options : []);
  const checkDiet = (path: string, dietary: DietaryKey[], notes: string | null) => {
    if (dietary.some((k) => !allowedDiet.has(k)) || (dietary.includes('none') && dietary.length > 1)) {
      e[`${path}.dietary`] = req;
    }
    if (dietary.some((k) => ALLERGIES.includes(k)) && !clean(notes)) e[`${path}.dietaryNotes`] = req;
  };

  if (sub.attending) {
    if (sub.adults.length < 1 || sub.adults.length > config.maxAdults) e.adults = req;
    if (sub.children.length > (config.askChildren ? config.maxChildren : 0)) e.children = req;
    sub.adults.forEach((a, i) => {
      if (i === 0 || config.perAttendeeDetails) {
        if (!clean(a.firstName)) e[`a${i}.firstName`] = req;
        if (!clean(a.lastName)) e[`a${i}.lastName`] = req;
      }
      checkDiet(`a${i}`, a.dietary, a.dietaryNotes);
    });
    const p0 = sub.adults[0];
    const phone = clean(p0?.phone);
    const email = clean(p0?.email);
    if (phone ? !PHONE_OK(phone) : config.requirePhone)
      e['a0.phone'] = phone ? t(L, 'rsvp.error.phone') : req;
    if (email ? !EMAIL_OK(email) : config.requireEmail)
      e['a0.email'] = email ? t(L, 'rsvp.error.email') : req;
    sub.children.forEach((c, i) => {
      if (config.perAttendeeDetails && !clean(c.fullName)) e[`c${i}.fullName`] = req;
      checkDiet(`c${i}`, c.dietary, c.dietaryNotes);
    });
    for (const q of config.customQuestions) {
      const v = sub.answers[q.id];
      const missing = v === undefined || v === '' || v === false;
      if (q.required && missing) e[`q.${q.id}`] = req;
      if (v === undefined) continue;
      const wrongType = q.type === 'boolean' ? typeof v !== 'boolean' : typeof v !== 'string';
      const unknownOption = q.type === 'select' && v !== '' && !q.options?.some((o) => o.value === v);
      if (wrongType || unknownOption) e[`q.${q.id}`] = req;
    }
  } else {
    const { fullName, phone, email } = sub.contact;
    if (!clean(fullName)) e['d.fullName'] = req;
    const p = clean(phone);
    const m = clean(email);
    if (!p && !m) e['d.phone'] = t(L, 'rsvp.error.contact');
    if (p && !PHONE_OK(p)) e['d.phone'] = t(L, 'rsvp.error.phone');
    if (m && !EMAIL_OK(m)) e['d.email'] = t(L, 'rsvp.error.email');
  }
  return e;
}

/** Sanitized rows for submit_rsvp. Unknown answer keys are dropped. */
export function toRows(
  sub: RsvpSubmission,
  config: RsvpConfig,
  ipHash: string | null,
): { response: ResponseRow; attendees: AttendeeRow[] } {
  const questionIds = new Set(config.customQuestions.map((q) => q.id));
  const answers = Object.fromEntries(
    Object.entries(sub.answers)
      .filter(([k]) => questionIds.has(k))
      .map(([k, v]) => [k, typeof v === 'string' ? sanitize(v) : v]),
  );
  const message = clean(sub.message);
  if (!sub.attending) {
    return {
      response: {
        attending: false,
        locale: sub.locale,
        primary_name: sanitize(sub.contact.fullName),
        phone: cleanPhone(sub.contact.phone),
        email: clean(sub.contact.email),
        adults_count: 0,
        children_count: 0,
        message,
        answers: {},
        ip_hash: ipHash,
      },
      attendees: [],
    };
  }
  const details = config.perAttendeeDetails;
  const adults: AttendeeRow[] = sub.adults.map((a, i) => ({
    kind: 'adult',
    position: i,
    first_name: i === 0 || details ? clean(a.firstName) : null,
    last_name: i === 0 || details ? clean(a.lastName) : null,
    full_name: null,
    age: null,
    phone: i === 0 ? cleanPhone(a.phone) : null,
    email: i === 0 ? clean(a.email) : null,
    dietary: a.dietary,
    dietary_notes: clean(a.dietaryNotes),
  }));
  const children: AttendeeRow[] = sub.children.map((c, i) => ({
    kind: 'child',
    position: i,
    first_name: null,
    last_name: null,
    full_name: details ? clean(c.fullName) : null,
    age: details ? c.age : null,
    phone: null,
    email: null,
    dietary: c.dietary,
    dietary_notes: clean(c.dietaryNotes),
  }));
  const p0 = adults[0]!;
  return {
    response: {
      attending: true,
      locale: sub.locale,
      primary_name: [p0.first_name, p0.last_name].filter(Boolean).join(' '),
      phone: p0.phone,
      email: p0.email,
      adults_count: adults.length,
      children_count: children.length,
      message,
      answers,
      ip_hash: ipHash,
    },
    attendees: [...adults, ...children],
  };
}

export async function handleRsvp(raw: string, ip: string | null, deps: RsvpDeps): Promise<RsvpOutcome> {
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return fail(413, 'invalid');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, 'invalid');
  }
  const parsed = RsvpSubmissionSchema.safeParse(json);
  if (!parsed.success) return fail(400, 'invalid');
  const sub = parsed.data as RsvpSubmission;

  // Honeypot filled → pretend it worked, store nothing (§12.6).
  if (sub.hp !== '')
    return { status: 200, body: { ok: true, responseId: randomUUID(), editToken: newToken() } };

  // Faster than a human (§4). A client clock ahead of ours gives a negative elapsed: nothing to judge.
  const elapsed = deps.now() - sub.renderedAt;
  if (elapsed >= 0 && elapsed < MIN_FILL_MS) return fail(400, 'invalid');

  const invitation = await deps.loadInvitation(sub.invitationSlug);
  const section = invitation?.doc.sections.find((s) => s.type === 'rsvp' && s.enabled);
  if (!invitation || !section || section.type !== 'rsvp') return fail(404, 'not_found');
  const { doc } = invitation;
  if (!doc.locales.includes(sub.locale)) return fail(400, 'invalid');

  const ipHash = ip && deps.ipHashSalt ? sha256(`${deps.ipHashSalt}:${ip}`) : null;
  if (!(await deps.rateHit(invitation.id, ipHash ?? 'unknown'))) return fail(429, 'rate_limited');

  if (doc.event.rsvpDeadline && deps.now() > endOfDayUtc(doc.event.rsvpDeadline, doc.timezone).getTime()) {
    return fail(409, 'closed');
  }

  const fieldErrors = validateAgainstConfig(sub, section.data);
  if (Object.keys(fieldErrors).length) return fail(400, 'invalid', fieldErrors);

  const { response, attendees } = toRows(sub, section.data, ipHash);
  const token = newToken();
  const saved = await deps.submit({
    invitationId: invitation.id,
    response,
    attendees,
    existingTokenHash: sub.editToken ? sha256(sub.editToken) : null,
    newTokenHash: sha256(token),
  });
  return {
    status: 200,
    body: {
      ok: true,
      responseId: saved.id,
      editToken: saved.replaced && sub.editToken ? sub.editToken : token,
    },
    saved: {
      invitationId: invitation.id,
      doc,
      reply: {
        name: response.primary_name,
        attending: response.attending,
        adults: response.adults_count,
        children: response.children_count,
        message: response.message,
        replaced: saved.replaced,
      },
    },
  };
}

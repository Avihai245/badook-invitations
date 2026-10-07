import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { messagePriceIls, type PlanId } from '@/features/billing/plans';
import { loadAccount } from '@/features/billing/server/account';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/session';
import { configuredTemplateLanguages, templateValues } from '@/features/whatsapp/sender';
import { LOCALES, type EventType, type Locale } from '../contracts/types';
import { formatEventDate } from '../lib/dates';
import { MAX_IMPORT_ROWS, NAME_MAX, normalizeGuestPhone } from '../lib/guest-import';
import { hostsLine } from '../lib/text';
import type { ApiResult } from './host-api';
import { hostDb, isUuid } from './host-db';

/**
 * The guest list of an invitation (supabase/migrations/*_guests_accounts_messaging.sql): import from
 * a spreadsheet, edit, remove, mark as sent, and the personal links (/i/<slug>?g=<token>) that
 * prefill the RSVP form and link the reply to the guest.
 */

export interface GuestRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  partySize: number | null;
  group: string | null;
  /** the language the host set for them (null: the invitation's default) */
  language: Locale | null;
  token: string;
  sendStatus: 'none' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  sendChannel: 'whatsapp' | 'manual' | null;
  sentAt: string | null;
  sendError: string | null;
  openedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  createdAt: string;
  /** asked the system's WhatsApp number to stop: never sent to again */
  optedOut: boolean;
  /** a WhatsApp message waiting for its next try (Meta asked us to slow down) */
  retryAt: string | null;
  response: GuestResponse | null;
}

/** A guest's reply as the guests page shows it (their latest). */
export interface GuestResponse {
  id: string;
  attending: boolean;
  adults: number;
  children: number;
  /** guest: they answered (the RSVP form); host: the host set it here */
  source?: 'guest' | 'host';
  /** people beyond their invitation they asked to bring: not counted until the host approves */
  extraRequested?: number | null;
  updatedAt: string;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export const guestsDb = {
  // an address that isn't an invitation id (/app/invitations/whatever) is simply not the owner's
  list: (id: string, ownerId: string) =>
    isUuid(id)
      ? rpc<GuestRecord[] | null>('owner_guests', { p_id: id, p_owner_id: ownerId })
      : Promise.resolve(null),
  import: (id: string, ownerId: string, rows: unknown[], max: number) =>
    rpc<{ added: number; updated: number; total: number } | null>('import_guests', {
      p_id: id,
      p_owner_id: ownerId,
      p_rows: rows,
      p_max: max,
    }),
  add: (id: string, ownerId: string, guest: CleanGuest & { token: string }, max: number) =>
    rpc<
      | { ok: true; guest: GuestRecord }
      | { ok: false; code: 'duplicate_phone'; guest?: { id: string; name: string } }
      | null
    >('add_guest', { p_id: id, p_owner_id: ownerId, p_guest: guest, p_max: max }),
  update: (id: string, ownerId: string, guestId: string, g: CleanGuest) =>
    rpc<
      | { ok: true; guest: GuestRecord }
      | { ok: false; code: 'duplicate_phone' }
      | { ok: false; code: 'below_confirmed'; confirmed: number }
      | null
    >('update_guest', {
      p_id: id,
      p_owner_id: ownerId,
      p_guest_id: guestId,
      p_name: g.name,
      p_phone: g.phone,
      p_email: g.email,
      p_party_size: g.partySize,
      p_group: g.group,
    }),
  /** the host sets a guest's answer (attending null: no answer — only one the host set) */
  setAnswer: (
    id: string,
    ownerId: string,
    guestId: string,
    attending: boolean | null,
    count: number | null,
  ) =>
    rpc<{ ok: true; guest: GuestRecord } | { ok: false; code: 'invalid' | 'guest_reply' } | null>(
      'owner_set_response',
      { p_id: id, p_owner_id: ownerId, p_guest_id: guestId, p_attending: attending, p_count: count },
    ),
  /** the host approves (or declines) a guest's request to bring more people */
  decideExtra: (id: string, ownerId: string, guestId: string, approve: boolean) =>
    rpc<{ ok: true; guest: GuestRecord } | { ok: false; code: 'nothing' } | null>('owner_extra_decision', {
      p_id: id,
      p_owner_id: ownerId,
      p_guest_id: guestId,
      p_approve: approve,
    }),
  remove: (id: string, ownerId: string, ids: string[]) =>
    rpc<number | null>('delete_guests', { p_id: id, p_owner_id: ownerId, p_guest_ids: ids }),
  markSent: (id: string, ownerId: string, ids: string[], sent: boolean) =>
    rpc<number | null>('mark_guests_sent', { p_id: id, p_owner_id: ownerId, p_guest_ids: ids, p_sent: sent }),
  setLanguage: (id: string, ownerId: string, ids: string[], language: Locale | null) =>
    rpc<number | null>('set_guests_language', {
      p_id: id,
      p_owner_id: ownerId,
      p_guest_ids: ids,
      p_language: language,
    }),
  open: (slug: string, token: string) =>
    rpc<{
      name: string;
      phone: string | null;
      partySize: number | null;
      language: Locale | null;
    } | null>('guest_open', {
      p_slug: slug,
      p_token: token,
    }),
  byToken: (invitationId: string, token: string) =>
    rpc<string | null>('guest_by_token', { p_invitation_id: invitationId, p_token: token }),
  /** a personal link's guest and the people they were invited with (the RSVP's limit) */
  rsvpGuest: (invitationId: string, token: string) =>
    rpc<{ id: string; partySize: number | null } | null>('guest_rsvp', {
      p_invitation_id: invitationId,
      p_token: token,
    }),
};

/** A personal link's token: 16 url-safe characters (96 random bits). */
export const newGuestToken = () => randomBytes(12).toString('base64url');
export const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

const LanguageSchema = z.enum(LOCALES).nullable();
const GuestInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(NAME_MAX),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(254).nullable().optional(),
  partySize: z.number().int().min(1).max(99).nullable().optional(),
  group: z.string().trim().max(60).nullable().optional(),
  language: LanguageSchema.optional(),
});
export const ImportGuestsSchema = z.strictObject({
  guests: z.array(GuestInputSchema).min(1).max(MAX_IMPORT_ROWS),
});
const AddGuestSchema = z.strictObject({ guest: GuestInputSchema });
const IdsSchema = z.strictObject({ ids: z.array(z.string().refine(isUuid)).min(1).max(MAX_IMPORT_ROWS) });
const MarkSchema = z.strictObject({
  ids: z.array(z.string().refine(isUuid)).min(1).max(MAX_IMPORT_ROWS),
  sent: z.boolean(),
});
const LanguageChangeSchema = z.strictObject({
  ids: z.array(z.string().refine(isUuid)).min(1).max(MAX_IMPORT_ROWS),
  language: LanguageSchema,
});

export interface CleanGuest {
  name: string;
  phone: string | null;
  email: string | null;
  partySize: number | null;
  group: string | null;
  language: Locale | null;
}

/** Server-side check of one row (the browser already previewed it): phone to E.164, email shape. */
function clean(g: z.infer<typeof GuestInputSchema>): CleanGuest | { error: 'bad_phone' | 'bad_email' } {
  const phone = g.phone ? normalizeGuestPhone(g.phone) : null;
  if (g.phone && !phone) return { error: 'bad_phone' };
  const email = g.email ? g.email.toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) return { error: 'bad_email' };
  return {
    name: g.name,
    phone,
    email,
    partySize: g.partySize ?? null,
    group: g.group || null,
    language: g.language ?? null,
  };
}

/** The account of the signed-in user (hostRoute already verified the session; the call is cached). */
async function accountOf(userId: string) {
  const user = await getSessionUser();
  return loadAccount({ id: userId, email: user?.id === userId ? user.email : undefined });
}

export async function listGuests(userId: string, id: string): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const guests = await guestsDb.list(id, userId);
  if (!guests) return fail(404, 'not_found');
  return ok({ ok: true, guests });
}

const guestLimit = (err: unknown) => err instanceof Error && /guest_limit/.test(err.message);

/**
 * POST /api/invitations/:id/guests — a spreadsheet's rows ({ guests }), or one guest typed by hand
 * ({ guest }).
 */
export function saveGuests(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  return raw && typeof raw === 'object' && 'guest' in raw
    ? addGuest(userId, id, raw)
    : importGuests(userId, id, raw);
}

/**
 * Adds a spreadsheet's guests: rows re-validated here; a guest already on the list (by phone, or by
 * name when there is no phone) is updated; the plan's list size is enforced.
 */
export async function importGuests(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = ImportGuestsSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const rows: (CleanGuest & { token: string })[] = [];
  const seen = new Set<string>();
  for (const [i, g] of parsed.data.guests.entries()) {
    const c = clean(g);
    if ('error' in c) return fail(422, c.error, { index: i });
    if (c.phone && seen.has(c.phone)) continue;
    if (c.phone) seen.add(c.phone);
    rows.push({ ...c, token: newGuestToken() });
  }
  const account = await accountOf(userId);
  const max = account.limits.guestsPerInvitation;
  try {
    const result = await guestsDb.import(id, userId, rows, max);
    if (!result) return fail(404, 'not_found');
    return ok({ ok: true, ...result });
  } catch (err) {
    if (guestLimit(err)) return fail(402, 'guest_limit', { max, plan: account.effective });
    throw err;
  }
}

/**
 * Adds one guest typed by hand. A phone already on the list is a conflict (409 duplicate_phone, with
 * that guest's name) — never an update of someone else; the plan's list size is enforced.
 */
export async function addGuest(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = AddGuestSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const c = clean(parsed.data.guest);
  if ('error' in c) return fail(422, c.error);
  const account = await accountOf(userId);
  const max = account.limits.guestsPerInvitation;
  try {
    const result = await guestsDb.add(id, userId, { ...c, token: newGuestToken() }, max);
    if (!result) return fail(404, 'not_found');
    if (!result.ok) return fail(409, result.code, result.guest ? { guest: result.guest } : {});
    return ok(result);
  } catch (err) {
    if (guestLimit(err)) return fail(402, 'guest_limit', { max, plan: account.effective });
    throw err;
  }
}

export async function updateGuest(
  userId: string,
  id: string,
  guestId: string,
  raw: unknown,
): Promise<ApiResult> {
  if (!isUuid(id) || !isUuid(guestId)) return fail(404, 'not_found');
  const parsed = GuestInputSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const c = clean(parsed.data);
  if ('error' in c) return fail(422, c.error);
  const result = await guestsDb.update(id, userId, guestId, c);
  if (!result) return fail(404, 'not_found');
  if (!result.ok) return fail(409, result.code, 'confirmed' in result ? { confirmed: result.confirmed } : {});
  // the language is its own call (update_guest keeps its signature): only when the form sent one
  if (parsed.data.language !== undefined && result.guest.language !== c.language) {
    await guestsDb.setLanguage(id, userId, [guestId], c.language);
    return ok({ ...result, guest: { ...result.guest, language: c.language } });
  }
  return ok(result);
}

const AnswerSchema = z.discriminatedUnion('kind', [
  // coming / not coming / no answer (only an answer the host set can be taken back)
  z.strictObject({
    kind: z.literal('answer'),
    attending: z.boolean().nullable(),
    count: z.number().int().min(1).max(99).nullable().default(null),
  }),
  // the guest's request to bring more people
  z.strictObject({ kind: z.literal('extra'), approve: z.boolean() }),
]);

/**
 * PUT /api/invitations/:id/guests/:guestId/answer — the host sets whether a guest is coming and how
 * many ({ kind: 'answer', attending, count }; coming with more than invited invites them with that
 * many), or decides on their request to bring more ({ kind: 'extra', approve }). The reply is like any
 * other: the counts, the seating and the event day follow it. 409 guest_reply: "no answer" over the
 * guest's own reply.
 */
export async function setGuestAnswer(
  userId: string,
  id: string,
  guestId: string,
  raw: unknown,
): Promise<ApiResult> {
  if (!isUuid(id) || !isUuid(guestId)) return fail(404, 'not_found');
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const a = parsed.data;
  if (a.kind === 'answer' && a.attending && a.count === null) return fail(400, 'invalid');
  const result =
    a.kind === 'answer'
      ? await guestsDb.setAnswer(id, userId, guestId, a.attending, a.attending ? a.count : null)
      : await guestsDb.decideExtra(id, userId, guestId, a.approve);
  if (!result) return fail(404, 'not_found');
  if (!result.ok) return fail(result.code === 'invalid' ? 400 : 409, result.code);
  return ok(result);
}

/** POST /api/invitations/:id/guests/language — { ids, language }: the language some guests read in. */
export async function setGuestsLanguage(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = LanguageChangeSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const n = await guestsDb.setLanguage(id, userId, parsed.data.ids, parsed.data.language);
  if (n === null) return fail(404, 'not_found');
  return ok({ ok: true, updated: n });
}

export async function deleteGuests(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = IdsSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const n = await guestsDb.remove(id, userId, parsed.data.ids);
  if (n === null) return fail(404, 'not_found');
  return ok({ ok: true, deleted: n });
}

export async function markGuestsSent(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = MarkSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const n = await guestsDb.markSent(id, userId, parsed.data.ids, parsed.data.sent);
  if (n === null) return fail(404, 'not_found');
  return ok({ ok: true, updated: n });
}

/** Public: a guest opened their personal link → the name and phone that prefill the form. */
export async function openGuestLink(slug: string, token: string): Promise<ApiResult> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug) || !GUEST_TOKEN_RE.test(token)) return fail(404, 'not_found');
  const guest = await guestsDb.open(slug, token);
  if (!guest) return fail(404, 'not_found');
  return ok({ ok: true, guest });
}

// ─── the guests page ─────────────────────────────────────────────────────────────────────────────

/** A message's values in one language: the hosts, the event with its preposition, the date. */
export interface MessageValues {
  hosts: string;
  event: string;
  date: string;
}

export interface GuestsPageReply {
  id: string;
  name: string;
  phone: string | null;
  attending: boolean;
  adults: number;
  children: number;
  guestId: string | null;
  createdAt: string;
}

export interface GuestsPageData {
  id: string;
  slug: string;
  published: boolean;
  /** "נועה & איתי" · "יום חמישי, 17 ביוני 2027" in the host's language when the invitation has it */
  title: string;
  dateLine: string;
  eventType: EventType;
  /** the invitation's default language (a guest without one of their own reads it) */
  locale: Locale;
  /** the invitation's languages — what a guest's language can be */
  locales: Locale[];
  publicBaseUrl: string;
  guests: GuestRecord[];
  /** every reply, lightly (the counts, and matching the general link's replies to guests: lib/rsvp-summary) */
  replies: GuestsPageReply[];
  /** the greeting line with {guest} as the guest will see it, or null when there is none */
  greeting: string | null;
  plan: PlanId;
  maxGuests: number;
  credits: number;
  /** the platform's admins send without credits */
  unlimited: boolean;
  /** "send from my WhatsApp": the message's values in each of the invitation's languages */
  own: Partial<Record<Locale, MessageValues>>;
  whatsapp: {
    configured: boolean;
    priceIls: number;
    priceUsd: number;
    /** the languages the template is approved in (Meta's codes), best first */
    langs: { locale: Locale; code: string }[];
    /** the template's values for this invitation in each of those languages (the dialog's previews) */
    values: Partial<Record<Locale, MessageValues>>;
  };
}

export function whatsappConfigured(): boolean {
  const env = serverEnv();
  return !!(env.INVITES_WHATSAPP_TOKEN && env.INVITES_WHATSAPP_PHONE_NUMBER_ID);
}

export async function loadGuestsPage(
  id: string,
  user: { id: string; email?: string | null },
  uiLocale: Locale,
  /** the address the host is on (requestBaseUrl()) — the personal links are built on it */
  publicBaseUrl?: string,
): Promise<GuestsPageData | null> {
  if (!isUuid(id)) return null;
  const [inv, guests, account, replies] = await Promise.all([
    hostDb.get(id, user.id),
    guestsDb.list(id, user.id),
    loadAccount({ id: user.id, email: user.email ?? undefined }),
    hostDb.responses(id, user.id),
  ]);
  if (!inv || !guests) return null;
  const doc = inv.published ?? inv.draft;
  const locale: Locale = doc.locales.includes(uiLocale) ? uiLocale : doc.defaultLocale;
  const hero = inv.draft.sections.find((s) => s.type === 'hero');
  const greeting =
    hero?.type === 'hero' && hero.data.greeting ? (hero.data.greeting[locale] ?? '').trim() : '';
  const env = serverEnv();
  const langs = configuredTemplateLanguages();
  return {
    id: inv.id,
    slug: inv.slug,
    published: inv.status === 'published',
    title: hostsLine(doc.hosts, locale),
    dateLine: formatEventDate(doc, locale),
    eventType: inv.eventType,
    locale: doc.defaultLocale,
    locales: [...doc.locales],
    publicBaseUrl: publicBaseUrl ?? env.INVITES_PUBLIC_BASE_URL,
    guests,
    replies: (replies?.responses ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      attending: r.attending,
      adults: r.adults,
      children: r.children,
      guestId: r.guestId ?? null,
      createdAt: r.createdAt,
    })),
    greeting: greeting || null,
    plan: account.effective,
    maxGuests: account.limits.guestsPerInvitation,
    credits: account.credits,
    unlimited: account.admin,
    own: Object.fromEntries(doc.locales.map((l) => [l, templateValues(doc, l)])),
    whatsapp: {
      configured: whatsappConfigured(),
      priceUsd: env.INVITES_WHATSAPP_PRICE_USD,
      priceIls: messagePriceIls(env.INVITES_WHATSAPP_PRICE_USD, env.INVITES_USD_TO_ILS),
      langs,
      values: Object.fromEntries(langs.map((l) => [l.locale, templateValues(doc, l.locale)])),
    },
  };
}

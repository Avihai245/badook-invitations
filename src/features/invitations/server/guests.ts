import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { messagePriceIls, type PlanId } from '@/features/billing/plans';
import { loadAccount } from '@/features/billing/server/account';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/session';
import type { EventType, Locale } from '../contracts/types';
import { EVENT_PHRASE } from '@/features/whatsapp/sender';
import { formatDate, formatEventDate } from '../lib/dates';
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
  response: { id: string; attending: boolean; adults: number; children: number; updatedAt: string } | null;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export const guestsDb = {
  list: (id: string, ownerId: string) =>
    rpc<GuestRecord[] | null>('owner_guests', { p_id: id, p_owner_id: ownerId }),
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
    rpc<{ ok: true; guest: GuestRecord } | { ok: false; code: 'duplicate_phone' } | null>('update_guest', {
      p_id: id,
      p_owner_id: ownerId,
      p_guest_id: guestId,
      p_name: g.name,
      p_phone: g.phone,
      p_email: g.email,
      p_party_size: g.partySize,
      p_group: g.group,
    }),
  remove: (id: string, ownerId: string, ids: string[]) =>
    rpc<number | null>('delete_guests', { p_id: id, p_owner_id: ownerId, p_guest_ids: ids }),
  markSent: (id: string, ownerId: string, ids: string[], sent: boolean) =>
    rpc<number | null>('mark_guests_sent', { p_id: id, p_owner_id: ownerId, p_guest_ids: ids, p_sent: sent }),
  open: (slug: string, token: string) =>
    rpc<{ name: string; phone: string | null; partySize: number | null } | null>('guest_open', {
      p_slug: slug,
      p_token: token,
    }),
  byToken: (invitationId: string, token: string) =>
    rpc<string | null>('guest_by_token', { p_invitation_id: invitationId, p_token: token }),
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

const GuestInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(NAME_MAX),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(254).nullable().optional(),
  partySize: z.number().int().min(1).max(99).nullable().optional(),
  group: z.string().trim().max(60).nullable().optional(),
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

export interface CleanGuest {
  name: string;
  phone: string | null;
  email: string | null;
  partySize: number | null;
  group: string | null;
}

/** Server-side check of one row (the browser already previewed it): phone to E.164, email shape. */
function clean(g: z.infer<typeof GuestInputSchema>): CleanGuest | { error: 'bad_phone' | 'bad_email' } {
  const phone = g.phone ? normalizeGuestPhone(g.phone) : null;
  if (g.phone && !phone) return { error: 'bad_phone' };
  const email = g.email ? g.email.toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) return { error: 'bad_email' };
  return { name: g.name, phone, email, partySize: g.partySize ?? null, group: g.group || null };
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
  if (!result.ok) return fail(409, result.code);
  return ok(result);
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

export interface GuestsPageData {
  id: string;
  slug: string;
  published: boolean;
  /** "נועה & איתי" · "יום חמישי, 17 ביוני 2027" in the host's language when the invitation has it */
  title: string;
  dateLine: string;
  eventType: EventType;
  /** the invitation's own language (messages to guests are written in it) */
  locale: Locale;
  publicBaseUrl: string;
  guests: GuestRecord[];
  /** the greeting line with {guest} as the guest will see it, or null when there is none */
  greeting: string | null;
  plan: PlanId;
  maxGuests: number;
  credits: number;
  /** the platform's admins send without credits */
  unlimited: boolean;
  /** "send from my WhatsApp": the message's values in the invitation's own language */
  own: { locale: Locale; hosts: string; event: string; date: string };
  whatsapp: {
    configured: boolean;
    priceIls: number;
    priceUsd: number;
    /** the template's language and its values for this invitation (the dialog's preview) */
    lang: Locale;
    hosts: string;
    event: string;
    date: string;
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
  const [inv, guests, account] = await Promise.all([
    hostDb.get(id, user.id),
    guestsDb.list(id, user.id),
    loadAccount({ id: user.id, email: user.email ?? undefined }),
  ]);
  if (!inv || !guests) return null;
  const doc = inv.published ?? inv.draft;
  const locale: Locale = doc.locales.includes(uiLocale) ? uiLocale : doc.defaultLocale;
  const hero = inv.draft.sections.find((s) => s.type === 'hero');
  const greeting =
    hero?.type === 'hero' && hero.data.greeting ? (hero.data.greeting[locale] ?? '').trim() : '';
  const env = serverEnv();
  const lang: Locale = env.INVITES_WHATSAPP_TEMPLATE_LANG.startsWith('en') ? 'en' : 'he';
  const docLang = doc.locales.includes(lang) ? lang : doc.defaultLocale;
  return {
    id: inv.id,
    slug: inv.slug,
    published: inv.status === 'published',
    title: hostsLine(doc.hosts, locale),
    dateLine: formatEventDate(doc, locale),
    eventType: inv.eventType,
    locale: doc.defaultLocale,
    publicBaseUrl: publicBaseUrl ?? env.INVITES_PUBLIC_BASE_URL,
    guests,
    greeting: greeting || null,
    plan: account.effective,
    maxGuests: account.limits.guestsPerInvitation,
    credits: account.credits,
    unlimited: account.admin,
    own: {
      locale: doc.defaultLocale,
      hosts: hostsLine(doc.hosts, doc.defaultLocale),
      event: EVENT_PHRASE[doc.defaultLocale][doc.eventType],
      date: formatDate(doc.event.date, doc.defaultLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    },
    whatsapp: {
      configured: whatsappConfigured(),
      priceUsd: env.INVITES_WHATSAPP_PRICE_USD,
      priceIls: messagePriceIls(env.INVITES_WHATSAPP_PRICE_USD, env.INVITES_USD_TO_ILS),
      lang,
      hosts: hostsLine(doc.hosts, docLang),
      event: EVENT_PHRASE[lang][doc.eventType],
      date: formatDate(doc.event.date, lang, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    },
  };
}

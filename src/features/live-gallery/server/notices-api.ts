import 'server-only';
import { z } from 'zod';
import { packageFor, whyOff, type FeatureInput } from '@/features/flags/features';
import type { Locale } from '@/features/invitations/contracts/types';
import { isLocale } from '@/features/invitations/lib/locales';
import type { TemplateLanguage } from '@/features/whatsapp/languages';
import type { ProcessResult } from '@/features/whatsapp/sender';
import type { GalleryDb } from './db';
import type { ApiResult } from './guest-api';
import type { GalleryNoticeRow, GalleryNoticesDb, Skipped } from './notices-db';
import { linkToken } from './tokens';

/**
 * "Send guests the gallery link" as plain functions over injected dependencies (the route files wire
 * Supabase and WhatsApp in; tests in tests/unit/gallery-notices.test.ts): every guest of the list with
 * their own gallery link (it keeps their personal link, so their uploads carry their name) and what
 * they got already; sending it from the system's WhatsApp number (the third template — a credit each,
 * refunded when it isn't delivered; 503 until the template is approved), or marking it sent from the
 * host's own WhatsApp. Needs `live_gallery` and the gallery on.
 */

const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * What the messages need in each of the invitation's languages: its default language, its languages,
 * and the hosts in each (the host's own message and the template's {{2}} say them).
 */
export interface GalleryNoticeInvitation {
  locale: Locale;
  locales: Locale[];
  hosts: Partial<Record<Locale, string>>;
}

/** A guest of the dialog, with the language the host set for them (null: the invitation's default). */
export type GalleryNoticeGuest = GalleryNoticeRow & { language: Locale | null };

export interface GalleryNotifyDeps {
  db: Pick<GalleryNoticesDb, 'state' | 'queue' | 'mark' | 'pending'>;
  gallery: Pick<GalleryDb, 'ownerGet'>;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  /** the invitation's languages and the hosts in each (null: not the owner's) */
  invitation(id: string, userId: string): Promise<GalleryNoticeInvitation | null>;
  /** each guest's language by their id (the guest list's) */
  guestLanguages(id: string, userId: string): Promise<Record<string, string | null>>;
  /** the languages the gallery's template is set up in (INVITES_WHATSAPP_TEMPLATE_LANGS) */
  templateLanguages(): TemplateLanguage[];
  /** the system's number can send the gallery link (WhatsApp set up, the template approved) */
  ready(): boolean;
  priceUsd: number;
  /** sends the next batch of the invitation's queued gallery links */
  send(invitationId: string, limit: number): Promise<ProcessResult>;
  /** the host's credits; the platform's admins never run out (their credits are topped up) */
  account(userId: string): Promise<{ credits: number; admin: boolean }>;
  addCredits(userId: string, count: number, ref: string): Promise<void>;
}

async function gate(
  userId: string,
  id: string,
  deps: Pick<GalleryNotifyDeps, 'featureInput'>,
): Promise<ApiResult | null> {
  if (!isUuid(id)) return notFound;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return notFound;
  const why = whyOff('live_gallery', input);
  if (why)
    return fail(403, 'feature_off', {
      feature: 'live_gallery',
      reason: why,
      package: packageFor('live_gallery'),
    });
  return null;
}

/**
 * GET /api/invitations/:id/gallery/notices — every guest with their own gallery link, their language
 * and what they got already; whether the system's number can send, and in which languages (the dialog
 * counts and previews the messages by language, like the invitation's); what a message from the
 * host's own WhatsApp needs in each of the invitation's languages.
 */
export async function galleryNoticesState(
  userId: string,
  id: string,
  base: string,
  deps: GalleryNotifyDeps,
): Promise<ApiResult> {
  const refused = await gate(userId, id, deps);
  if (refused) return refused;
  const [owned, state, account, invitation, languages] = await Promise.all([
    deps.gallery.ownerGet(id, userId),
    deps.db.state(id, userId),
    deps.account(userId),
    deps.invitation(id, userId),
    deps.guestLanguages(id, userId),
  ]);
  if (!owned || !state || !invitation) return notFound;
  const g = owned.gallery;
  if (!g || !g.enabled) return fail(409, 'no_gallery');
  const token = linkToken('upload', id, g.uploadTokenNonce, g.uploadTokenHash);
  if (!token) return fail(409, 'no_link');
  const rows: GalleryNoticeGuest[] = state.rows.map((r) => {
    const language = languages[r.guestId];
    return { ...r, language: language && isLocale(language) ? language : null };
  });
  return ok({
    rows,
    ready: deps.ready(),
    langs: deps.templateLanguages(),
    credits: account.credits,
    unlimited: account.admin,
    priceUsd: deps.priceUsd,
    // each guest's link: `${link}&g=${token}` (and `&lang=` for another language: messages.ts)
    link: `${base}/e/${owned.slug}/upload?t=${token}`,
    own: invitation,
  });
}

const NoticesSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('send'), guestIds: z.array(z.uuid()).min(1).max(5000) }),
  z.strictObject({ action: z.literal('mark'), guestIds: z.array(z.uuid()).min(1).max(5000) }),
  z.strictObject({ action: z.literal('continue') }),
]);

export type SendOutcome =
  | { queued: number; skipped?: Skipped; sent: number; failed: number; pending: number }
  | { error: 'credits'; needed: number; balance: number; skipped?: Skipped }
  | { error: 'nobody' | 'no_gallery'; skipped?: Skipped };

/**
 * POST /api/invitations/:id/gallery/notices — { action: 'send', guestIds } from the system's number (a
 * credit each), { action: 'mark', guestIds } sent by the host themselves, { action: 'continue' } the
 * next batch of what is queued.
 */
export async function sendGalleryNotices(
  userId: string,
  id: string,
  raw: unknown,
  deps: GalleryNotifyDeps,
): Promise<ApiResult> {
  const parsed = NoticesSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const refused = await gate(userId, id, deps);
  if (refused) return refused;
  const q = parsed.data;
  if (q.action === 'mark') {
    const n = await deps.db.mark(id, userId, [...new Set(q.guestIds)]);
    if (n === null) return notFound;
    return ok({ marked: n });
  }
  if (!deps.ready()) return fail(503, 'not_configured');
  if (q.action === 'continue') {
    const next = await deps.send(id, 50);
    return ok({ ...next, pending: await deps.db.pending(id) });
  }
  const guestIds = [...new Set(q.guestIds)];
  const account = await deps.account(userId);
  if (account.admin && account.credits < guestIds.length)
    await deps.addCredits(userId, guestIds.length - account.credits, `gallery:${id}`);
  const queued = await deps.db.queue(id, userId, guestIds, deps.priceUsd);
  if (!queued) return notFound;
  const skipped = queued.skipped ? { skipped: queued.skipped } : {};
  if (!queued.ok) {
    if (queued.code === 'credits')
      return fail(402, 'credits', { needed: queued.needed, balance: queued.balance, ...skipped });
    return fail(queued.code === 'no_gallery' ? 409 : 422, queued.code, skipped);
  }
  const first = await deps.send(id, 50);
  return ok({
    queued: queued.queued,
    ...skipped,
    sent: first.sent,
    failed: first.failed,
    pending: await deps.db.pending(id),
  });
}

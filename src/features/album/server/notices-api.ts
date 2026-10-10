import 'server-only';
import { z } from 'zod';
import { packageFor, whyOff, type FeatureInput } from '@/features/flags/features';
import type { Locale } from '@/features/invitations/contracts/types';
import { isLocale } from '@/features/invitations/lib/locales';
import type { GalleryNoticeGuest } from '@/features/live-gallery/server/notices-api';
import { linkToken } from '@/features/live-gallery/server/tokens';
import type { TemplateLanguage } from '@/features/whatsapp/languages';
import type { ProcessResult } from '@/features/whatsapp/sender';
import type { ApiResult } from './api';
import type { AlbumDb } from './db';
import type { AlbumNoticesDb } from './notices-db';

/**
 * "Send guests the album" as plain functions over injected dependencies (tests in
 * tests/unit/album-notices.test.ts): every guest of the list and the thank-you they got already; the
 * thank-you from the system's WhatsApp number (the album's template — a credit each, refunded when it
 * isn't delivered; 503 until the template is approved), or marked as sent from the hosts' own
 * WhatsApp. Needs the `album` feature and the album on.
 */

const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** What the messages need in each of the invitation's languages: the hosts and where guests celebrated. */
export interface AlbumNoticeInvitation {
  locale: Locale;
  locales: Locale[];
  hosts: Partial<Record<Locale, string>>;
  /** "בחתונה שלנו", "at our wedding"… (album/phrases.ts) */
  phrase: Partial<Record<Locale, string>>;
}

export interface AlbumNotifyDeps {
  db: Pick<AlbumNoticesDb, 'state' | 'queue' | 'mark' | 'pending'>;
  album: Pick<AlbumDb, 'ownerGet'>;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  invitation(id: string, userId: string): Promise<AlbumNoticeInvitation | null>;
  guestLanguages(id: string, userId: string): Promise<Record<string, string | null>>;
  templateLanguages(): TemplateLanguage[];
  ready(): boolean;
  priceUsd: number;
  send(invitationId: string, limit: number): Promise<ProcessResult>;
  account(userId: string): Promise<{ credits: number; admin: boolean }>;
  addCredits(userId: string, count: number, ref: string): Promise<void>;
}

async function gate(
  userId: string,
  id: string,
  deps: Pick<AlbumNotifyDeps, 'featureInput'>,
): Promise<ApiResult | null> {
  if (!isUuid(id)) return notFound;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return notFound;
  const why = whyOff('album', input);
  if (why) return fail(403, 'feature_off', { feature: 'album', reason: why, package: packageFor('album') });
  return null;
}

/**
 * GET /api/invitations/:id/album/notices — every guest, their language and the thank-you they got;
 * whether the system's number can send and in which languages; the album's link and what a message
 * from the hosts' own WhatsApp needs in each language.
 */
export async function albumNoticesState(
  userId: string,
  id: string,
  base: string,
  deps: AlbumNotifyDeps,
): Promise<ApiResult> {
  const refused = await gate(userId, id, deps);
  if (refused) return refused;
  const [owned, state, account, invitation, languages] = await Promise.all([
    deps.album.ownerGet(id, userId),
    deps.db.state(id, userId),
    deps.account(userId),
    deps.invitation(id, userId),
    deps.guestLanguages(id, userId),
  ]);
  if (!owned || !state || !invitation) return notFound;
  const a = owned.album;
  if (!a || !a.enabled) return fail(409, 'no_album');
  const token = linkToken('album', id, a.tokenNonce, a.tokenHash);
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
    // the album for everyone: `&lang=` opens it in another of the invitation's languages
    link: `${base}/e/${owned.slug}/album?a=${token}`,
    own: invitation,
  });
}

const NoticesSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('send'), guestIds: z.array(z.uuid()).min(1).max(5000) }),
  z.strictObject({ action: z.literal('mark'), guestIds: z.array(z.uuid()).min(1).max(5000) }),
  z.strictObject({ action: z.literal('continue') }),
]);

/**
 * POST /api/invitations/:id/album/notices — { action: 'send', guestIds } from the system's number (a
 * credit each), { action: 'mark', guestIds } sent by the hosts themselves, { action: 'continue' } the
 * next batch of what is queued.
 */
export async function sendAlbumNotices(
  userId: string,
  id: string,
  raw: unknown,
  deps: AlbumNotifyDeps,
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
    await deps.addCredits(userId, guestIds.length - account.credits, `album:${id}`);
  const queued = await deps.db.queue(id, userId, guestIds, deps.priceUsd);
  if (!queued) return notFound;
  const skipped = queued.skipped ? { skipped: queued.skipped } : {};
  if (!queued.ok) {
    if (queued.code === 'credits')
      return fail(402, 'credits', { needed: queued.needed, balance: queued.balance, ...skipped });
    return fail(queued.code === 'no_album' ? 409 : 422, queued.code, skipped);
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

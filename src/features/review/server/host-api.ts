import 'server-only';
import { z } from 'zod';
import { effectiveFeatures, type FeatureInput } from '@/features/flags/features';
import type { RealtimeInfo } from '@/lib/live/types';
import { REVIEW } from '../config';
import type { HostReview, LinkState, ReviewLinkView } from '../model';
import type { OwnerReviewRow, ReviewDb } from './db';

/**
 * The draft review in the host's editor (feature `draft_review`): the link (made, a new one, its
 * expiry, how the host hears about comments, revoked) and the comments (answered, handled or open
 * again, removed) — plain functions over injected dependencies (tests/unit/review.test.ts). Every change
 * tells the open review pages and the host's other screens ("comments", "link") through the link's
 * Realtime channel.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface ReviewHostDeps {
  db: Pick<
    ReviewDb,
    | 'ownerGet'
    | 'ownerSetup'
    | 'ownerRotate'
    | 'ownerUpdate'
    | 'ownerRevoke'
    | 'ownerReply'
    | 'ownerStatus'
    | 'ownerDelete'
  >;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  broadcast(channel: string, kind: string): Promise<unknown>;
  realtime(channel: string): RealtimeInfo | null;
  newLink(invitationId: string): { nonce: string; token: string; hash: string };
  tokenAgain(invitationId: string, nonce: string, hash: string): string | null;
  /** a new channel name */
  randomId(): string;
  now(): number;
}

/** The event is the host's and has the feature (else the answer to send). */
async function refused(userId: string, id: string, deps: ReviewHostDeps): Promise<ApiResult | null> {
  if (!isUuid(id)) return notFound;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return notFound;
  if (!effectiveFeatures(input).has('draft_review'))
    return fail(403, 'feature_off', { feature: 'draft_review' });
  return null;
}

function linkState(link: NonNullable<OwnerReviewRow['link']>, now: number): LinkState {
  if (link.revokedAt) return 'revoked';
  if (link.expiresAt && Date.parse(link.expiresAt) <= now) return 'expired';
  return 'ok';
}

function view(id: string, row: OwnerReviewRow, base: string, deps: ReviewHostDeps): HostReview {
  let link: ReviewLinkView | null = null;
  if (row.link) {
    const token = deps.tokenAgain(id, row.link.tokenNonce, row.link.tokenHash);
    link = {
      url: token ? `${base.replace(/\/+$/, '')}/review/${token}` : null,
      state: linkState(row.link, deps.now()),
      expiresAt: row.link.expiresAt,
      notify: row.link.notify,
      createdAt: row.link.createdAt,
    };
  }
  return {
    link,
    comments: row.comments,
    updatedAt: row.updatedAt,
    realtime: row.link ? deps.realtime(row.link.channel) : null,
  };
}

const ok = (id: string, row: OwnerReviewRow | null, base: string, deps: ReviewHostDeps): ApiResult =>
  row ? { status: 200, body: { ok: true, ...view(id, row, base, deps) } } : notFound;

const expiresAt = (days: number | null | undefined, now: number): string | null =>
  days ? new Date(now + days * 86_400_000).toISOString() : null;

const Expiry = z.union([z.literal(7), z.literal(30), z.null()]);

/** GET /api/invitations/:id/review — the link and the comments. */
export async function getReview(userId: string, id: string, base: string, deps: ReviewHostDeps) {
  const no = await refused(userId, id, deps);
  if (no) return no;
  return ok(id, await deps.db.ownerGet(id, userId), base, deps);
}

/** POST /api/invitations/:id/review { expiresInDays } — makes the link (a revoked one: a new one). */
export async function createReviewLink(
  userId: string,
  id: string,
  raw: unknown,
  base: string,
  deps: ReviewHostDeps,
) {
  const parsed = z.strictObject({ expiresInDays: Expiry.optional() }).safeParse(raw ?? {});
  if (!parsed.success) return fail(400, 'invalid');
  const no = await refused(userId, id, deps);
  if (no) return no;
  const link = deps.newLink(id);
  const row = await deps.db.ownerSetup(
    id,
    userId,
    link.hash,
    link.nonce,
    deps.randomId(),
    expiresAt(parsed.data.expiresInDays, deps.now()),
  );
  return ok(id, row, base, deps);
}

/** POST /api/invitations/:id/review/rotate — a new link; the old one stops working at once. */
export async function rotateReviewLink(userId: string, id: string, base: string, deps: ReviewHostDeps) {
  const no = await refused(userId, id, deps);
  if (no) return no;
  const before = await deps.db.ownerGet(id, userId);
  const link = deps.newLink(id);
  const row = await deps.db.ownerRotate(id, userId, link.hash, link.nonce, deps.randomId());
  // the pages open on the old link learn it is gone
  if (row && before?.link) await deps.broadcast(before.link.channel, 'link');
  return ok(id, row, base, deps);
}

/** PATCH /api/invitations/:id/review { expiresInDays?, notify? } */
export async function updateReviewLink(
  userId: string,
  id: string,
  raw: unknown,
  base: string,
  deps: ReviewHostDeps,
) {
  const parsed = z
    .strictObject({ expiresInDays: Expiry.optional(), notify: z.enum(['each', 'daily', 'off']).optional() })
    .safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const no = await refused(userId, id, deps);
  if (no) return no;
  const patch: { expiresAt?: string | null; notify?: 'each' | 'daily' | 'off' } = {};
  if (parsed.data.expiresInDays !== undefined)
    patch.expiresAt = expiresAt(parsed.data.expiresInDays, deps.now());
  if (parsed.data.notify) patch.notify = parsed.data.notify;
  const row = await deps.db.ownerUpdate(id, userId, patch);
  if (row?.link && patch.expiresAt !== undefined) await deps.broadcast(row.link.channel, 'link');
  return ok(id, row, base, deps);
}

/** DELETE /api/invitations/:id/review — revokes the link (the comments stay). */
export async function revokeReviewLink(userId: string, id: string, base: string, deps: ReviewHostDeps) {
  const no = await refused(userId, id, deps);
  if (no) return no;
  const row = await deps.db.ownerRevoke(id, userId);
  if (row?.link) await deps.broadcast(row.link.channel, 'link');
  return ok(id, row, base, deps);
}

/** The link's channel, to tell its pages the comments changed. */
async function tellPages(userId: string, id: string, deps: ReviewHostDeps) {
  const row = await deps.db.ownerGet(id, userId);
  if (row?.link) await deps.broadcast(row.link.channel, 'comments');
}

const commentResult = (row: Awaited<ReturnType<ReviewDb['ownerReply']>>): ApiResult => {
  if (!row) return notFound;
  if (!row.ok)
    return row.code === 'rate' ? fail(429, 'rate') : fail(row.code === 'too_many' ? 409 : 404, row.code);
  return { status: 200, body: { ok: true, comment: row.comment } };
};

/** POST /api/invitations/:id/review/comments/:comment/replies { id, body } — the host answers. */
export async function replyToComment(
  userId: string,
  id: string,
  commentId: string,
  raw: unknown,
  deps: ReviewHostDeps,
) {
  const parsed = z
    .strictObject({ id: z.uuid(), body: z.string().trim().min(1).max(REVIEW.bodyMax) })
    .safeParse(raw);
  if (!parsed.success || !isUuid(commentId)) return fail(400, 'invalid');
  const no = await refused(userId, id, deps);
  if (no) return no;
  const result = commentResult(
    await deps.db.ownerReply(id, userId, commentId, parsed.data.id, parsed.data.body),
  );
  if (result.status === 200) await tellPages(userId, id, deps);
  return result;
}

/** PATCH /api/invitations/:id/review/comments/:comment { status } — handled, or open again. */
export async function setCommentStatus(
  userId: string,
  id: string,
  commentId: string,
  raw: unknown,
  deps: ReviewHostDeps,
) {
  const parsed = z.strictObject({ status: z.enum(['open', 'handled']) }).safeParse(raw);
  if (!parsed.success || !isUuid(commentId)) return fail(400, 'invalid');
  const no = await refused(userId, id, deps);
  if (no) return no;
  const result = commentResult(await deps.db.ownerStatus(id, userId, commentId, parsed.data.status));
  if (result.status === 200) await tellPages(userId, id, deps);
  return result;
}

/** DELETE /api/invitations/:id/review/comments/:comment */
export async function deleteComment(userId: string, id: string, commentId: string, deps: ReviewHostDeps) {
  if (!isUuid(commentId)) return fail(400, 'invalid');
  const no = await refused(userId, id, deps);
  if (no) return no;
  if (!(await deps.db.ownerDelete(id, userId, commentId))) return notFound;
  await tellPages(userId, id, deps);
  return { status: 200, body: { ok: true } };
}

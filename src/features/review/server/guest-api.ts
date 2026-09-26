import 'server-only';
import { z } from 'zod';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import type { Feature } from '@/features/flags/features';
import type { RealtimeInfo } from '@/lib/live/types';
import { AUTHOR_KEY_RE, REVIEW, REVIEW_TOKEN_RE } from '../config';
import type { ReviewState } from '../model';
import type { CommentRow, ReviewDb } from './db';
import { authorKeyHash, rateKey, sha256Hex } from './tokens';

/**
 * The review page's API (/api/review/*) — opened with the review link, no account: the draft and its
 * comments, pinning a comment, answering one, removing one's own. Every call checks the link (working,
 * the event has `draft_review`); the database checks it again and limits each address and the link.
 * Nothing here counts or follows the visitor: their name is what they type, their browser's key only
 * lets them remove their own comment (kept hashed). Tested in tests/unit/review.test.ts.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const fail = (status: number, code: string): ApiResult => ({ status, body: { ok: false, code } });
const notFound = fail(404, 'not_found');
const rate = fail(429, 'rate');

export interface ReviewGuestDeps {
  db: Pick<ReviewDb, 'link' | 'open' | 'addComment' | 'addReply' | 'removeComment'>;
  features(invitationId: string): Promise<Set<Feature>>;
  broadcast(channel: string, kind: string): Promise<unknown>;
  realtime(channel: string): RealtimeInfo | null;
  /** after the answer is sent: the host's email about new comments (when they want one) */
  later(job: () => Promise<unknown>): void;
  notifyHost(invitationId: string): Promise<unknown>;
}

const Token = z.string().regex(REVIEW_TOKEN_RE);
const AuthorKey = z.string().regex(AUTHOR_KEY_RE);
const Name = z.string().trim().min(1).max(REVIEW.nameMax);
const Body = z.string().trim().min(1).max(REVIEW.bodyMax);

type Resolved =
  | { status: 'ok'; invitationId: string; channel: string; hash: string; cinematic: boolean }
  | { status: 'gone'; state: 'expired' | 'revoked' }
  | null;

/** The event behind a review link, when the link works and the event has the feature. */
async function resolve(token: string, deps: ReviewGuestDeps): Promise<Resolved> {
  const hash = sha256Hex(token);
  const link = await deps.db.link(hash);
  if (!link) return null;
  const features = await deps.features(link.invitationId);
  if (!features.has('draft_review')) return null;
  if (link.state !== 'ok') return { status: 'gone', state: link.state };
  return {
    status: 'ok',
    invitationId: link.invitationId,
    channel: link.channel,
    hash,
    cinematic: features.has('cinematic'),
  };
}

const keyOf = (ip: string | null) => rateKey('address', ip ?? 'unknown');

export type OpenResult =
  | { status: 'ok'; state: ReviewState }
  | { status: 'gone'; state: 'expired' | 'revoked' }
  | { status: 'rate' }
  | null;

/** The draft and its comments for a link (the page's first render, and each refresh). */
export async function openReview(
  token: string,
  ip: string | null,
  deps: ReviewGuestDeps,
): Promise<OpenResult> {
  if (!REVIEW_TOKEN_RE.test(token)) return null;
  const r = await resolve(token, deps);
  if (!r) return null;
  if (r.status === 'gone') return r;
  const row = await deps.db.open(r.hash, keyOf(ip));
  if (!row) return null;
  if (!row.ok) return { status: 'rate' };
  const draft = safeMigrateDocument(row.draft);
  if (!draft.success) return null;
  return {
    status: 'ok',
    state: {
      draft: draft.data,
      templateId: draft.data.templateId,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt,
      comments: row.comments,
      realtime: deps.realtime(row.channel),
      cinematic: r.cinematic,
    },
  };
}

/** POST /api/review/open { t } */
export async function openApi(raw: unknown, ip: string | null, deps: ReviewGuestDeps): Promise<ApiResult> {
  const parsed = z.strictObject({ t: Token }).safeParse(raw);
  if (!parsed.success) return notFound;
  const opened = await openReview(parsed.data.t, ip, deps);
  if (!opened) return notFound;
  if (opened.status === 'rate') return rate;
  if (opened.status === 'gone') return fail(410, opened.state);
  return { status: 200, body: { ok: true, ...opened.state } };
}

function written(row: CommentRow | null): ApiResult {
  if (!row) return notFound;
  if (!row.ok) {
    if (row.code === 'rate') return rate;
    if (row.code === 'too_many') return fail(409, 'too_many');
    if (row.code === 'unknown_section') return fail(422, 'unknown_section');
    return fail(404, row.code);
  }
  return { status: 200, body: { ok: true, comment: row.comment } };
}

const CommentSchema = z.strictObject({
  t: Token,
  /** the family member's browser key (lets them remove it later) */
  key: AuthorKey.optional(),
  /** the page's id for it: a retried request adds it once */
  id: z.uuid(),
  sectionId: z.string().min(1).max(80),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  name: Name,
  body: Body,
});

/** POST /api/review/comment — a comment pinned to a spot of a section. */
export async function addComment(raw: unknown, ip: string | null, deps: ReviewGuestDeps): Promise<ApiResult> {
  const parsed = CommentSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, deps);
  if (!r) return notFound;
  if (r.status === 'gone') return fail(410, r.state);
  const result = written(
    await deps.db.addComment(r.hash, keyOf(ip), q.key ? authorKeyHash(q.key) : null, {
      id: q.id,
      sectionId: q.sectionId,
      x: Math.round(q.x * 1000) / 1000,
      y: Math.round(q.y * 1000) / 1000,
      name: q.name,
      body: q.body,
    }),
  );
  if (result.status === 200) {
    await deps.broadcast(r.channel, 'comments');
    deps.later(() => deps.notifyHost(r.invitationId));
  }
  return result;
}

const ReplySchema = z.strictObject({
  t: Token,
  key: AuthorKey.optional(),
  commentId: z.uuid(),
  id: z.uuid(),
  name: Name,
  body: Body,
});

/** POST /api/review/reply — a family member answers a comment. */
export async function addReply(raw: unknown, ip: string | null, deps: ReviewGuestDeps): Promise<ApiResult> {
  const parsed = ReplySchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, deps);
  if (!r) return notFound;
  if (r.status === 'gone') return fail(410, r.state);
  const result = written(
    await deps.db.addReply(r.hash, keyOf(ip), q.key ? authorKeyHash(q.key) : null, {
      commentId: q.commentId,
      id: q.id,
      name: q.name,
      body: q.body,
    }),
  );
  if (result.status === 200) {
    await deps.broadcast(r.channel, 'comments');
    deps.later(() => deps.notifyHost(r.invitationId));
  }
  return result;
}

/** POST /api/review/remove { t, key, commentId } — a family member removes their own comment. */
export async function removeComment(
  raw: unknown,
  ip: string | null,
  deps: ReviewGuestDeps,
): Promise<ApiResult> {
  const parsed = z.strictObject({ t: Token, key: AuthorKey, commentId: z.uuid() }).safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, deps);
  if (!r) return notFound;
  if (r.status === 'gone') return fail(410, r.state);
  const row = await deps.db.removeComment(r.hash, keyOf(ip), authorKeyHash(q.key), q.commentId);
  if (!row) return notFound;
  if (!row.ok) return row.code === 'rate' ? rate : notFound;
  await deps.broadcast(r.channel, 'comments');
  return { status: 200, body: { ok: true } };
}

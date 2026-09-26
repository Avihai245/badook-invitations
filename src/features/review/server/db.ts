import 'server-only';
import { serviceDb } from '@/lib/supabase/server';
import type { LinkState, NotifyMode, ReviewComment } from '../model';

/**
 * Typed access to the draft review's database functions (supabase/migrations/*_studio.sql). Always the
 * service role; each function checks the owner or the link's hash itself.
 */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

type Rate = { ok: false; code: 'rate' };

export interface StoredLink {
  tokenHash: string;
  tokenNonce: string;
  channel: string;
  expiresAt: string | null;
  revokedAt: string | null;
  notify: NotifyMode;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerReviewRow {
  link: StoredLink | null;
  updatedAt: string;
  comments: ReviewComment[];
}

export interface OpenRow {
  ok: true;
  channel: string;
  expiresAt: string | null;
  templateId: string;
  draft: unknown;
  updatedAt: string;
  comments: ReviewComment[];
}

export type CommentRow =
  | { ok: true; comment: ReviewComment }
  | { ok: false; code: 'not_found' | 'too_many' | 'unknown_section' }
  | Rate;

export interface PendingRow {
  id: string;
  mode: NotifyMode;
  notifiedAt: string | null;
  email: string | null;
  document: unknown;
  comments: { number: number; name: string; body: string; reply: boolean; at: string }[];
}

export const reviewDb = {
  // ── the host ──
  ownerGet: (id: string, owner: string) =>
    rpc<OwnerReviewRow | null>('review_owner_get', { p_id: id, p_owner: owner }),
  ownerSetup: (
    id: string,
    owner: string,
    hash: string,
    nonce: string,
    channel: string,
    expiresAt: string | null,
  ) =>
    rpc<OwnerReviewRow | null>('review_owner_setup', {
      p_id: id,
      p_owner: owner,
      p_hash: hash,
      p_nonce: nonce,
      p_channel: channel,
      p_expires_at: expiresAt,
    }),
  ownerRotate: (id: string, owner: string, hash: string, nonce: string, channel: string) =>
    rpc<OwnerReviewRow | null>('review_owner_rotate', {
      p_id: id,
      p_owner: owner,
      p_hash: hash,
      p_nonce: nonce,
      p_channel: channel,
    }),
  ownerUpdate: (id: string, owner: string, patch: { expiresAt?: string | null; notify?: NotifyMode }) =>
    rpc<OwnerReviewRow | null>('review_owner_update', { p_id: id, p_owner: owner, p_patch: patch }),
  ownerRevoke: (id: string, owner: string) =>
    rpc<OwnerReviewRow | null>('review_owner_revoke', { p_id: id, p_owner: owner }),
  ownerReply: (id: string, owner: string, commentId: string, replyId: string, body: string) =>
    rpc<CommentRow | null>('review_owner_reply', {
      p_id: id,
      p_owner: owner,
      p_comment_id: commentId,
      p_reply_id: replyId,
      p_body: body,
    }),
  ownerStatus: (id: string, owner: string, commentId: string, status: 'open' | 'handled') =>
    rpc<CommentRow | null>('review_owner_status', {
      p_id: id,
      p_owner: owner,
      p_comment_id: commentId,
      p_status: status,
    }),
  ownerDelete: (id: string, owner: string, commentId: string) =>
    rpc<boolean>('review_owner_delete', { p_id: id, p_owner: owner, p_comment_id: commentId }),

  // ── the family, by the link's hash ──
  link: (tokenHash: string) =>
    rpc<{ invitationId: string; channel: string; state: LinkState } | null>('review_link', {
      p_token_hash: tokenHash,
    }),
  open: (tokenHash: string, rateKey: string) =>
    rpc<OpenRow | Rate | null>('review_open', { p_token_hash: tokenHash, p_rate_key: rateKey }),
  addComment: (
    tokenHash: string,
    rateKey: string,
    authorKey: string | null,
    c: { id: string; sectionId: string; x: number; y: number; name: string; body: string },
  ) =>
    rpc<CommentRow | null>('review_comment_add', {
      p_token_hash: tokenHash,
      p_rate_key: rateKey,
      p_author_key: authorKey,
      p_comment_id: c.id,
      p_section_id: c.sectionId,
      p_x: c.x,
      p_y: c.y,
      p_name: c.name,
      p_body: c.body,
    }),
  addReply: (
    tokenHash: string,
    rateKey: string,
    authorKey: string | null,
    r: { commentId: string; id: string; name: string; body: string },
  ) =>
    rpc<CommentRow | null>('review_reply_add', {
      p_token_hash: tokenHash,
      p_rate_key: rateKey,
      p_author_key: authorKey,
      p_comment_id: r.commentId,
      p_reply_id: r.id,
      p_name: r.name,
      p_body: r.body,
    }),
  removeComment: (tokenHash: string, rateKey: string, authorKey: string, commentId: string) =>
    rpc<{ ok: true } | { ok: false; code: 'not_found' } | Rate | null>('review_comment_remove', {
      p_token_hash: tokenHash,
      p_rate_key: rateKey,
      p_author_key: authorKey,
      p_comment_id: commentId,
    }),

  // ── the host's emails, housekeeping ──
  notifyPending: (id: string) => rpc<PendingRow | null>('review_notify_pending', { p_id: id }),
  notifyMark: (id: string, at: string) => rpc<null>('review_notify_mark', { p_id: id, p_at: at }),
  digestDue: () => rpc<string[]>('review_digest_due', {}),
  maintenance: (days: number) =>
    rpc<{ comments: number; removed: number }>('review_maintenance', { p_days: days }),
};

export type ReviewDb = typeof reviewDb;

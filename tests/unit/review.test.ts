import { createHash, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { REVIEW_TOKEN_RE } from '@/features/review/config';
import { pinsOf, type ReviewComment } from '@/features/review/model';
import type { OwnerReviewRow, PendingRow, StoredLink } from '@/features/review/server/db';
import type { ReviewGuestDeps } from '@/features/review/server/guest-api';
import type { ReviewHostDeps } from '@/features/review/server/host-api';

/**
 * The draft review link (Phase 5C): its token (derived, only the hash kept), the host's API (the
 * link's life, answers, handled/open, removal — each telling the open pages), the family's API (no
 * account: the link, the feature, what they may write, hashed keys, the host's email afterwards), the
 * email and when it goes. The database functions themselves: tests/db/studio.test.ts.
 */

vi.mock('server-only', () => ({}));
const env = {
  INVITES_GALLERY_SECRET: 'unit-review-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
  INVITES_PUBLIC_BASE_URL: 'https://invites.test',
  INVITES_BRAND_NAME: 'Badook',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));
const sendEmail = vi.fn(async (_: { to: string; subject: string; html: string; text: string }) => true);
vi.mock('@/features/invitations/server/email', () => ({ sendEmail }));
const fakeDb = {
  notifyPending: vi.fn<(id: string) => Promise<PendingRow | null>>(),
  notifyMark: vi.fn(async (_id: string, _at: string) => null),
  digestDue: vi.fn<() => Promise<string[] | null>>(),
};
vi.mock('@/features/review/server/db', () => ({ reviewDb: fakeDb }));

const tokens = await import('@/features/review/server/tokens');
const host = await import('@/features/review/server/host-api');
const guest = await import('@/features/review/server/guest-api');
const { reviewEmail } = await import('@/features/review/email');
const { notifyHost, sendReviewDigests } = await import('@/features/review/server/notify');

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const NOW = Date.parse('2026-09-26T18:00:00.000Z');
const BASE = 'https://invites.test/';
const IP = '203.0.113.9';
const ALL = new Set<Feature>(FEATURES);
const draft = () => structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;

function comment(over: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: randomUUID(),
    number: 1,
    sectionId: draft().sections[1]!.id,
    x: 0.25,
    y: 0.5,
    name: 'Aunt Ruth',
    body: 'Bigger names please',
    status: 'open',
    replies: [],
    draftUpdatedAt: '2026-09-26T17:00:00.000Z',
    handledAt: null,
    createdAt: '2026-09-26T17:30:00.000Z',
    updatedAt: '2026-09-26T17:30:00.000Z',
    ...over,
  };
}

// ─── the link's token ──────────────────────────────────────────────────────────────────────────

describe('review link tokens', () => {
  it('a new link: a 24-character token, the database keeps only its hash and the nonce', () => {
    const link = tokens.newReviewLink(INV);
    expect(link.token).toMatch(REVIEW_TOKEN_RE);
    expect(link.hash).toBe(sha(link.token));
    expect(link.nonce).not.toContain(link.token);
    // two links for the same event differ
    expect(tokens.newReviewLink(INV).token).not.toBe(link.token);
  });

  it('the host’s screen derives the same token again, and none once the server’s key changed', () => {
    const link = tokens.newReviewLink(INV);
    expect(tokens.reviewToken(INV, link.nonce, link.hash)).toBe(link.token);
    // another event, another nonce: no
    expect(tokens.reviewToken('11111111-2222-4333-8444-555555555555', link.nonce, link.hash)).toBeNull();
    const secret = env.INVITES_GALLERY_SECRET;
    env.INVITES_GALLERY_SECRET = 'a-new-secret';
    try {
      expect(tokens.reviewToken(INV, link.nonce, link.hash)).toBeNull();
    } finally {
      env.INVITES_GALLERY_SECRET = secret;
    }
  });

  it('a key of its own: the same nonce gives another token than the gallery’s links', async () => {
    const links = await import('@/lib/links/tokens');
    const link = tokens.newReviewLink(INV);
    const galleryToken = links.deriveLinkToken(links.linkKey('live-gallery'), 'review', INV, link.nonce);
    expect(galleryToken).not.toBe(link.token);
  });

  it('a family member’s browser key and the address are kept only as salted hashes', () => {
    const key = 'Zq3xWm8Kp2Lr7Nv5Ty1Bc4';
    expect(tokens.authorKeyHash(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.authorKeyHash(key)).toBe(tokens.authorKeyHash(key));
    expect(tokens.authorKeyHash(key)).not.toBe(sha(key));
    expect(tokens.rateKey('address', IP)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.rateKey('address', IP)).not.toContain(IP);
    expect(tokens.rateKey('address', IP)).not.toBe(tokens.rateKey('link', IP));
  });
});

// ─── the host's side ───────────────────────────────────────────────────────────────────────────

function stored(over: Partial<StoredLink> = {}): StoredLink {
  const link = tokens.newReviewLink(INV);
  return {
    tokenHash: link.hash,
    tokenNonce: link.nonce,
    channel: 'review-channel-1',
    expiresAt: null,
    revokedAt: null,
    notify: 'each',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    ...over,
  };
}

function hostDeps(
  over: { features?: Partial<FeatureInput>; owner?: string; row?: OwnerReviewRow | null } = {},
) {
  const broadcasts: [string, string][] = [];
  let row: OwnerReviewRow | null =
    over.row === undefined ? { link: null, updatedAt: '2026-09-26T17:00:00.000Z', comments: [] } : over.row;
  let channels = 0;
  const calls: Record<string, unknown[][]> = {};
  const record =
    <A extends unknown[], R>(name: string, fn: (...a: A) => R) =>
    (...a: A): R => {
      (calls[name] ??= []).push(a);
      return fn(...a);
    };
  const setLink = (hash: string, nonce: string, channel: string, expiresAt: string | null) => {
    row = { ...(row ?? { updatedAt: '2026-09-26T17:00:00.000Z', comments: [] }), link: stored() };
    row.link = { ...row.link!, tokenHash: hash, tokenNonce: nonce, channel, expiresAt, revokedAt: null };
    return row;
  };
  const deps: ReviewHostDeps = {
    db: {
      ownerGet: record('ownerGet', async () => row),
      ownerSetup: record('ownerSetup', async (_i, _o, hash, nonce, channel, expiresAt) =>
        row?.link && !row.link.revokedAt ? row : setLink(hash, nonce, channel, expiresAt),
      ),
      ownerRotate: record('ownerRotate', async (_i, _o, hash, nonce, channel) =>
        row?.link ? setLink(hash, nonce, channel, row.link.expiresAt) : null,
      ),
      ownerUpdate: record('ownerUpdate', async (_i, _o, patch) => {
        if (!row?.link) return row;
        row = {
          ...row,
          link: {
            ...row.link,
            ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
            ...(patch.notify ? { notify: patch.notify } : {}),
          },
        };
        return row;
      }),
      ownerRevoke: record('ownerRevoke', async () => {
        if (!row?.link) return row;
        row = { ...row, link: { ...row.link, revokedAt: new Date(NOW).toISOString() } };
        return row;
      }),
      ownerReply: record('ownerReply', async (_i, _o, commentId, replyId, body) => {
        const c = row?.comments.find((k) => k.id === commentId);
        if (!c) return { ok: false as const, code: 'not_found' as const };
        c.replies.push({ id: replyId, by: 'host', name: null, body, at: new Date(NOW).toISOString() });
        return { ok: true as const, comment: c };
      }),
      ownerStatus: record('ownerStatus', async (_i, _o, commentId, status) => {
        const c = row?.comments.find((k) => k.id === commentId);
        if (!c) return { ok: false as const, code: 'not_found' as const };
        c.status = status;
        return { ok: true as const, comment: c };
      }),
      ownerDelete: record('ownerDelete', async (_i, _o, commentId) => {
        const before = row?.comments.length ?? 0;
        if (row) row = { ...row, comments: row.comments.filter((c) => c.id !== commentId) };
        return (row?.comments.length ?? 0) < before;
      }),
    },
    featureInput: async (id) =>
      id === INV
        ? {
            plan: 'free',
            admin: false,
            overrides: NO_OVERRIDES,
            available: ALL,
            ownerId: over.owner ?? OWNER,
            ...over.features,
          }
        : null,
    broadcast: async (channel, kind) => {
      broadcasts.push([channel, kind]);
    },
    realtime: (channel) => ({ url: 'wss://rt.test', key: 'k', channel }) as never,
    newLink: tokens.newReviewLink,
    tokenAgain: tokens.reviewToken,
    randomId: () => `review-channel-${++channels + 1}`,
    now: () => NOW,
  };
  return { deps, broadcasts, calls, current: () => row };
}

describe('the host’s review API', () => {
  it('only the owner, only a valid event, only with the feature', async () => {
    expect((await host.getReview(OWNER, 'not-a-uuid', BASE, hostDeps().deps)).status).toBe(404);
    expect((await host.getReview(OWNER, INV, BASE, hostDeps({ owner: randomUUID() }).deps)).status).toBe(404);
    const off = await host.getReview(
      OWNER,
      INV,
      BASE,
      hostDeps({ features: { overrides: { off: ['draft_review'], grant: [] } } }).deps,
    );
    expect(off).toEqual({ status: 403, body: { ok: false, code: 'feature_off', feature: 'draft_review' } });
    // a deployment without it: refused too
    const gone = hostDeps({ features: { available: new Set(FEATURES.filter((f) => f !== 'draft_review')) } });
    expect((await host.createReviewLink(OWNER, INV, {}, BASE, gone.deps)).status).toBe(403);
    expect(gone.calls.ownerSetup).toBeUndefined();
  });

  it('no link yet: nothing to show, nothing live', async () => {
    const res = await host.getReview(OWNER, INV, BASE, hostDeps().deps);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, link: null, comments: [], realtime: null });
  });

  it('makes a link with an optional expiry: its address holds the token, the database only the hash', async () => {
    const h = hostDeps();
    const res = await host.createReviewLink(OWNER, INV, { expiresInDays: 7 }, BASE, h.deps);
    expect(res.status).toBe(200);
    const link = res.body.link as { url: string; state: string; expiresAt: string };
    expect(link.state).toBe('ok');
    expect(link.expiresAt).toBe(new Date(NOW + 7 * 86_400_000).toISOString());
    const token = link.url.replace('https://invites.test/review/', '');
    expect(token).toMatch(REVIEW_TOKEN_RE);
    const [, , hash, nonce, channel, expiresAt] = h.calls.ownerSetup![0]!;
    expect(hash).toBe(sha(token));
    expect(nonce).not.toBe(token);
    expect(channel).toBe('review-channel-2');
    expect(expiresAt).toBe(link.expiresAt);
    expect(res.body.realtime).toMatchObject({ channel: 'review-channel-2' });
    // without an expiry, and refusing other lengths
    expect(
      ((await host.createReviewLink(OWNER, INV, {}, BASE, hostDeps().deps)).body.link as { expiresAt: null })
        .expiresAt,
    ).toBeNull();
    expect((await host.createReviewLink(OWNER, INV, { expiresInDays: 3 }, BASE, h.deps)).status).toBe(400);
    expect(
      (await host.createReviewLink(OWNER, INV, { expiresInDays: 7, extra: 1 }, BASE, h.deps)).status,
    ).toBe(400);
  });

  it('a new link retires the old one at once and tells the pages open on it', async () => {
    const h = hostDeps();
    const first = await host.createReviewLink(OWNER, INV, {}, BASE, h.deps);
    const rotated = await host.rotateReviewLink(OWNER, INV, BASE, h.deps);
    expect(rotated.status).toBe(200);
    const a = (first.body.link as { url: string }).url;
    const b = (rotated.body.link as { url: string }).url;
    expect(b).not.toBe(a);
    expect(h.broadcasts).toEqual([['review-channel-2', 'link']]);
    expect(rotated.body.realtime).toMatchObject({ channel: 'review-channel-3' });
  });

  it('the expiry and the emails can change; a new expiry reaches the pages', async () => {
    const h = hostDeps();
    await host.createReviewLink(OWNER, INV, { expiresInDays: 30 }, BASE, h.deps);
    const quiet = await host.updateReviewLink(OWNER, INV, { notify: 'daily' }, BASE, h.deps);
    expect((quiet.body.link as { notify: string }).notify).toBe('daily');
    expect(h.broadcasts).toEqual([]);
    const forever = await host.updateReviewLink(OWNER, INV, { expiresInDays: null }, BASE, h.deps);
    expect((forever.body.link as { expiresAt: null }).expiresAt).toBeNull();
    expect(h.broadcasts).toEqual([['review-channel-2', 'link']]);
    expect((await host.updateReviewLink(OWNER, INV, { notify: 'hourly' }, BASE, h.deps)).status).toBe(400);
  });

  it('an expired link shows as expired; a revoked one as revoked (the comments stay)', async () => {
    const past = {
      link: stored({ expiresAt: new Date(NOW - 1000).toISOString() }),
      updatedAt: 'x',
      comments: [comment()],
    };
    const expired = await host.getReview(OWNER, INV, BASE, hostDeps({ row: past }).deps);
    expect((expired.body.link as { state: string }).state).toBe('expired');
    const h = hostDeps({ row: { link: stored(), updatedAt: 'x', comments: [comment()] } });
    const revoked = await host.revokeReviewLink(OWNER, INV, BASE, h.deps);
    expect((revoked.body.link as { state: string }).state).toBe('revoked');
    expect((revoked.body.comments as unknown[]).length).toBe(1);
    expect(h.broadcasts).toEqual([['review-channel-1', 'link']]);
  });

  it('after the server’s key changed, the old link has no address to show (the host makes a new one)', async () => {
    const h = hostDeps({ row: { link: stored(), updatedAt: 'x', comments: [] } });
    const secret = env.INVITES_GALLERY_SECRET;
    env.INVITES_GALLERY_SECRET = 'rotated-secret';
    try {
      const res = await host.getReview(OWNER, INV, BASE, h.deps);
      expect((res.body.link as { url: string | null }).url).toBeNull();
    } finally {
      env.INVITES_GALLERY_SECRET = secret;
    }
  });

  it('answers, marks handled, opens again and removes — each telling the review pages', async () => {
    const c = comment();
    const h = hostDeps({ row: { link: stored(), updatedAt: 'x', comments: [c] } });
    const replyId = randomUUID();
    const replied = await host.replyToComment(OWNER, INV, c.id, { id: replyId, body: '  Done!  ' }, h.deps);
    expect(replied.status).toBe(200);
    expect(h.calls.ownerReply![0]).toEqual([INV, OWNER, c.id, replyId, 'Done!']);
    const handled = await host.setCommentStatus(OWNER, INV, c.id, { status: 'handled' }, h.deps);
    expect((handled.body.comment as ReviewComment).status).toBe('handled');
    const reopened = await host.setCommentStatus(OWNER, INV, c.id, { status: 'open' }, h.deps);
    expect((reopened.body.comment as ReviewComment).status).toBe('open');
    expect((await host.deleteComment(OWNER, INV, c.id, h.deps)).status).toBe(200);
    expect(h.broadcasts).toEqual([
      ['review-channel-1', 'comments'],
      ['review-channel-1', 'comments'],
      ['review-channel-1', 'comments'],
      ['review-channel-1', 'comments'],
    ]);
    // gone now
    expect((await host.deleteComment(OWNER, INV, c.id, h.deps)).status).toBe(404);
    expect((await host.setCommentStatus(OWNER, INV, c.id, { status: 'handled' }, h.deps)).status).toBe(404);
    // bad input
    expect((await host.setCommentStatus(OWNER, INV, c.id, { status: 'done' }, h.deps)).status).toBe(400);
    expect((await host.replyToComment(OWNER, INV, 'nope', { id: replyId, body: 'x' }, h.deps)).status).toBe(
      400,
    );
    expect((await host.replyToComment(OWNER, INV, c.id, { id: replyId, body: '   ' }, h.deps)).status).toBe(
      400,
    );
    expect(
      (await host.replyToComment(OWNER, INV, c.id, { id: replyId, body: 'x'.repeat(1001) }, h.deps)).status,
    ).toBe(400);
  });
});

// ─── the family's side ─────────────────────────────────────────────────────────────────────────

function guestDeps(
  over: {
    state?: 'ok' | 'expired' | 'revoked' | 'missing';
    features?: Feature[];
    rate?: boolean;
    write?: 'ok' | 'rate' | 'too_many' | 'unknown_section' | 'not_found';
  } = {},
) {
  const link = tokens.newReviewLink(INV);
  const broadcasts: [string, string][] = [];
  const later: (() => Promise<unknown>)[] = [];
  const notified: string[] = [];
  const calls: Record<string, unknown[][]> = {};
  const record =
    <A extends unknown[], R>(name: string, fn: (...a: A) => R) =>
    (...a: A): R => {
      (calls[name] ??= []).push(a);
      return fn(...a);
    };
  const written = (): Awaited<ReturnType<ReviewGuestDeps['db']['addComment']>> =>
    !over.write || over.write === 'ok'
      ? { ok: true, comment: comment() }
      : over.write === 'rate'
        ? { ok: false, code: 'rate' }
        : { ok: false, code: over.write };
  const deps: ReviewGuestDeps = {
    db: {
      link: record('link', async (hash: string) =>
        hash === link.hash && over.state !== 'missing'
          ? { invitationId: INV, channel: 'review-channel-1', state: over.state ?? 'ok' }
          : null,
      ),
      open: record('open', async () =>
        over.rate
          ? { ok: false as const, code: 'rate' as const }
          : {
              ok: true as const,
              channel: 'review-channel-1',
              expiresAt: null,
              templateId: draft().templateId,
              draft: draft(),
              updatedAt: '2026-09-26T17:00:00.000Z',
              comments: [comment()],
            },
      ),
      addComment: record('addComment', async () => written()),
      addReply: record('addReply', async () => written()),
      removeComment: record('removeComment', async () =>
        over.write === 'not_found'
          ? { ok: false as const, code: 'not_found' as const }
          : { ok: true as const },
      ),
    },
    features: async () => new Set(over.features ?? FEATURES),
    broadcast: async (channel, kind) => {
      broadcasts.push([channel, kind]);
    },
    realtime: (channel) => ({ url: 'wss://rt.test', key: 'k', channel }) as never,
    later: (job) => {
      later.push(job);
    },
    notifyHost: async (id) => {
      notified.push(id);
    },
  };
  return { deps, token: link.token, broadcasts, later, notified, calls };
}

describe('the review page’s API (no account)', () => {
  it('opens the draft and its comments, with the event’s presentation and a live channel', async () => {
    const g = guestDeps();
    const res = await guest.openApi({ t: g.token }, IP, g.deps);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      templateId: draft().templateId,
      updatedAt: '2026-09-26T17:00:00.000Z',
      cinematic: true,
      realtime: { channel: 'review-channel-1' },
    });
    expect((res.body.draft as InvitationDocument).sections.length).toBe(draft().sections.length);
    // the rate key is a salted hash of the address, never the address
    const [hash, rateKey] = g.calls.open![0]!;
    expect(hash).toBe(sha(g.token));
    expect(rateKey).toBe(tokens.rateKey('address', IP));
    // no cinematic feature: the plain presentation
    const plain = guestDeps({ features: ['draft_review'] });
    expect((await guest.openApi({ t: plain.token }, IP, plain.deps)).body.cinematic).toBe(false);
  });

  it('refuses a bad token, an unknown link, and an event without the feature (as not found)', async () => {
    const g = guestDeps();
    expect((await guest.openApi({ t: 'short' }, IP, g.deps)).status).toBe(404);
    expect((await guest.openApi({ t: g.token, extra: 1 }, IP, g.deps)).status).toBe(404);
    expect((await guest.openApi({ t: 'A'.repeat(24) }, IP, g.deps)).status).toBe(404);
    const missing = guestDeps({ state: 'missing' });
    expect((await guest.openApi({ t: missing.token }, IP, missing.deps)).status).toBe(404);
    const off = guestDeps({ features: FEATURES.filter((f) => f !== 'draft_review') });
    expect((await guest.openApi({ t: off.token }, IP, off.deps)).status).toBe(404);
    expect(off.calls.open).toBeUndefined();
  });

  it('an expired or revoked link says so (410); too many requests (429)', async () => {
    const expired = guestDeps({ state: 'expired' });
    expect(await guest.openApi({ t: expired.token }, IP, expired.deps)).toEqual({
      status: 410,
      body: { ok: false, code: 'expired' },
    });
    const revoked = guestDeps({ state: 'revoked' });
    expect((await guest.openApi({ t: revoked.token }, IP, revoked.deps)).body.code).toBe('revoked');
    expect(await guest.openReview(revoked.token, IP, revoked.deps)).toEqual({
      status: 'gone',
      state: 'revoked',
    });
    const busy = guestDeps({ rate: true });
    expect((await guest.openApi({ t: busy.token }, IP, busy.deps)).status).toBe(429);
  });

  const pinned = (token: string, over: Record<string, unknown> = {}) => ({
    t: token,
    key: 'Zq3xWm8Kp2Lr7Nv5Ty1Bc4',
    id: randomUUID(),
    sectionId: draft().sections[1]!.id,
    x: 0.123456,
    y: 0.9876,
    name: '  Aunt Ruth ',
    body: ' Bigger names please ',
    ...over,
  });

  it('pins a comment: trimmed, spot rounded, the browser key hashed; the pages hear, the host’s email follows', async () => {
    const g = guestDeps();
    const q = pinned(g.token);
    const res = await guest.addComment(q, IP, g.deps);
    expect(res.status).toBe(200);
    const [hash, rateKey, authorKey, fields] = g.calls.addComment![0]!;
    expect(hash).toBe(sha(g.token));
    expect(rateKey).toBe(tokens.rateKey('address', IP));
    expect(authorKey).toBe(tokens.authorKeyHash(q.key));
    expect(authorKey).not.toContain(q.key);
    expect(fields).toEqual({
      id: q.id,
      sectionId: q.sectionId,
      x: 0.123,
      y: 0.988,
      name: 'Aunt Ruth',
      body: 'Bigger names please',
    });
    expect(g.broadcasts).toEqual([['review-channel-1', 'comments']]);
    // the email waits until the answer is sent
    expect(g.notified).toEqual([]);
    await g.later[0]!();
    expect(g.notified).toEqual([INV]);
    // no browser key: fine (it just can't be removed by them later)
    const anon = guestDeps();
    expect((await guest.addComment(pinned(anon.token, { key: undefined }), IP, anon.deps)).status).toBe(200);
    expect(anon.calls.addComment![0]![2]).toBeNull();
  });

  it('refuses what doesn’t fit: outside the section, no name, too long, a bad id', async () => {
    const g = guestDeps();
    for (const bad of [
      { x: 1.2 },
      { y: -0.1 },
      { name: '   ' },
      { name: 'x'.repeat(41) },
      { body: 'x'.repeat(1001) },
      { id: 'not-a-uuid' },
      { key: 'short' },
      { sectionId: '' },
      { extra: true },
    ])
      expect((await guest.addComment(pinned(g.token, bad), IP, g.deps)).status).toBe(400);
    expect(g.calls.addComment).toBeUndefined();
  });

  it('the database’s answers: too many (409), a part no longer in the draft (422), rate (429), gone (410)', async () => {
    const codes = { too_many: 409, unknown_section: 422, rate: 429, not_found: 404 } as const;
    for (const [write, status] of Object.entries(codes)) {
      const g = guestDeps({ write: write as keyof typeof codes });
      expect((await guest.addComment(pinned(g.token), IP, g.deps)).status).toBe(status);
      expect(g.broadcasts).toEqual([]);
      expect(g.later).toEqual([]);
    }
    const expired = guestDeps({ state: 'expired' });
    expect((await guest.addComment(pinned(expired.token), IP, expired.deps)).status).toBe(410);
    expect(expired.calls.addComment).toBeUndefined();
  });

  it('answers a comment; removes one’s own with the browser key (hashed)', async () => {
    const g = guestDeps();
    const commentId = randomUUID();
    const reply = await guest.addReply(
      {
        t: g.token,
        key: 'Zq3xWm8Kp2Lr7Nv5Ty1Bc4',
        commentId,
        id: randomUUID(),
        name: 'Dana',
        body: 'Agreed',
      },
      IP,
      g.deps,
    );
    expect(reply.status).toBe(200);
    expect(g.later).toHaveLength(1);
    const removed = await guest.removeComment(
      { t: g.token, key: 'Zq3xWm8Kp2Lr7Nv5Ty1Bc4', commentId },
      IP,
      g.deps,
    );
    expect(removed).toEqual({ status: 200, body: { ok: true } });
    expect(g.calls.removeComment![0]![2]).toBe(tokens.authorKeyHash('Zq3xWm8Kp2Lr7Nv5Ty1Bc4'));
    expect(g.broadcasts).toEqual([
      ['review-channel-1', 'comments'],
      ['review-channel-1', 'comments'],
    ]);
    // without the key, or someone else's comment: no
    expect((await guest.removeComment({ t: g.token, commentId }, IP, g.deps)).status).toBe(400);
    const other = guestDeps({ write: 'not_found' });
    expect(
      (
        await guest.removeComment(
          { t: other.token, key: 'Zq3xWm8Kp2Lr7Nv5Ty1Bc4', commentId },
          IP,
          other.deps,
        )
      ).status,
    ).toBe(404);
  });
});

// ─── pins, the host's email ────────────────────────────────────────────────────────────────────

describe('pins and the host’s email', () => {
  it('pins carry the number, place and status; the one looked at is active', () => {
    const a = comment({ number: 1 });
    const b = comment({ number: 2, status: 'handled', x: 0.9, y: 0.1 });
    expect(pinsOf([a, b], b.id)).toEqual([
      { id: a.id, number: 1, sectionId: a.sectionId, x: 0.25, y: 0.5, status: 'open', active: false },
      { id: b.id, number: 2, sectionId: b.sectionId, x: 0.9, y: 0.1, status: 'handled', active: true },
    ]);
  });

  it('the email lists the comments, escapes what the family typed, in the invitation’s language', () => {
    const mail = reviewEmail({
      locale: 'en',
      title: 'Noa & Itay',
      comments: [
        { number: 3, name: '<b>Ruth</b>', body: 'Use <script>alert(1)</script> less', reply: false },
        { number: 3, name: 'Dana', body: 'Agreed', reply: true },
      ],
      editorUrl: 'https://invites.test/app/invitations/x/edit',
      brand: 'Badook',
    });
    expect(mail.subject).toContain('Noa & Itay');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<b>Ruth</b>');
    expect(mail.html).toContain('&lt;b&gt;Ruth&lt;/b&gt;');
    expect(mail.html).toContain('https://invites.test/app/invitations/x/edit');
    expect(mail.text).toContain('#3 · Dana');
    expect(mail.text).toContain('Agreed');
    const he = reviewEmail({
      locale: 'he',
      title: 'נועה ואיתי',
      comments: [{ number: 1, name: 'רותי', body: 'יפה', reply: false }],
      editorUrl: 'u',
      brand: 'Badook',
    });
    expect(he.html).toContain('dir="rtl"');
    expect(he.subject).toContain('נועה ואיתי');
  });

  const pending = (over: Partial<PendingRow> = {}): PendingRow => ({
    id: INV,
    mode: 'each',
    notifiedAt: null,
    email: 'host@example.com',
    document: draft(),
    comments: [
      { number: 1, name: 'Ruth', body: 'Bigger', reply: false, at: '2026-09-26T17:40:00.000Z' },
      { number: 1, name: 'Dana', body: 'Agreed', reply: true, at: '2026-09-26T17:50:00.000Z' },
    ],
    ...over,
  });

  beforeEach(() => {
    sendEmail.mockClear();
    fakeDb.notifyPending.mockReset();
    fakeDb.notifyMark.mockClear();
    fakeDb.digestDue.mockReset();
  });

  it('on each comment: at most one email every few minutes, marking up to the newest it told', async () => {
    fakeDb.notifyPending.mockResolvedValue(pending({ notifiedAt: new Date(NOW - 5 * 60_000).toISOString() }));
    await notifyHost(INV, NOW);
    expect(sendEmail).not.toHaveBeenCalled();
    fakeDb.notifyPending.mockResolvedValue(
      pending({ notifiedAt: new Date(NOW - 11 * 60_000).toISOString() }),
    );
    await notifyHost(INV, NOW);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]![0].to).toBe('host@example.com');
    expect(fakeDb.notifyMark).toHaveBeenCalledWith(INV, '2026-09-26T17:50:00.000Z');
  });

  it('a host who wants the daily summary (or none) gets nothing per comment; failures never throw', async () => {
    fakeDb.notifyPending.mockResolvedValue(pending({ mode: 'daily' }));
    await notifyHost(INV, NOW);
    fakeDb.notifyPending.mockResolvedValue(pending({ mode: 'off' }));
    await notifyHost(INV, NOW);
    expect(sendEmail).not.toHaveBeenCalled();
    fakeDb.notifyPending.mockRejectedValue(new Error('db down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyHost(INV, NOW)).resolves.toBeUndefined();
    error.mockRestore();
  });

  it('the daily summary: every host with comments not told yet, except those who turned emails off', async () => {
    const other = '22222222-3333-4444-8555-666666666666';
    fakeDb.digestDue.mockResolvedValue([INV, other]);
    fakeDb.notifyPending.mockImplementation(async (id) =>
      id === INV ? pending({ mode: 'daily' }) : pending({ id: other, mode: 'off' }),
    );
    expect(await sendReviewDigests()).toEqual({ sent: 1, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    fakeDb.digestDue.mockResolvedValue(null);
    expect(await sendReviewDigests()).toEqual({ sent: 0, failed: 0 });
  });
});

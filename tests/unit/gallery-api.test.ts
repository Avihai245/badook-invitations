import { createHash, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { PlanId } from '@/features/billing/plans';
import { GALLERY } from '@/features/live-gallery/config';
import type { AiResult } from '@/features/live-gallery/moderation';
import type { GallerySettings, ItemRow, OwnerGallery, TokenLookup } from '@/features/live-gallery/server/db';
import type { GuestDeps } from '@/features/live-gallery/server/guest-api';
import type { HostGalleryDeps } from '@/features/live-gallery/server/host-api';
import type { GalleryStorage } from '@/features/live-gallery/server/storage';

/**
 * The live gallery's API over fake dependencies: links and codes, what guests may reserve and how it
 * is signed, finishing an upload through the moderation, the feed and the screen, the host's side,
 * the automatic check's request and answers, the live hint, the storage clean-up and how the
 * browser reads storage errors. The database functions themselves: tests/db/gallery.test.ts.
 */

vi.mock('server-only', () => ({}));
const env = {
  INVITES_GALLERY_SECRET: 'unit-gallery-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.test/',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'unit-anon-key',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));

const tokens = await import('@/features/live-gallery/server/tokens');
const guest = await import('@/features/live-gallery/server/guest-api');
const host = await import('@/features/live-gallery/server/host-api');
const ai = await import('@/features/live-gallery/server/ai');
const { broadcastRefresh } = await import('@/features/live-gallery/server/realtime');
const { sweepTrash } = await import('@/features/live-gallery/server/sweep');
const { classify } = await import('@/features/live-gallery/client/transport');

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const UPLOADER = 'phone-uploader-0001';
const IP = '203.0.113.9';
const NOW = Date.parse('2026-09-26T18:00:00.000Z');
const ALL = new Set<Feature>(FEATURES);

// ─── fakes ──────────────────────────────────────────────────────────────────────────────────────

function settings(over: Partial<TokenLookup['gallery']> = {}): TokenLookup['gallery'] {
  return {
    invitationId: INV,
    enabled: true,
    mode: 'instant',
    paused: false,
    opensAt: null,
    closesAt: null,
    hasCode: false,
    uploadTokenHash: '',
    uploadTokenNonce: '',
    projectorTokenHash: '',
    projectorTokenNonce: '',
    channel: 'gallery-channel-unit',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    accessCodeHash: null,
    accessCodeSalt: null,
    ...over,
  };
}

function row(over: Partial<ItemRow> = {}): ItemRow {
  const id = over.id ?? randomUUID();
  const folder = `${INV}/${id}`;
  return {
    id,
    kind: 'image',
    status: 'uploading',
    reason: null,
    originalPath: `${folder}/original.jpg`,
    originalType: 'image/jpeg',
    originalSize: 3_000_000,
    originalDone: false,
    displayPath: `${folder}/display.jpg`,
    displaySize: 900_000,
    thumbPath: `${folder}/thumb.jpg`,
    thumbSize: 60_000,
    width: 4000,
    height: 3000,
    durationMs: null,
    takenAt: null,
    sharpness: null,
    brightness: null,
    enhanced: false,
    aiNsfw: null,
    aiQuality: null,
    phash: null,
    name: null,
    guestId: null,
    createdAt: '2026-09-26T17:00:00.000Z',
    completedAt: null,
    publishedAt: null,
    updatedAt: '2026-09-26T17:00:00.000Z',
    nearest: null,
    ...over,
  };
}

/** Storage in a map: "bucket:path" → size. */
function fakeStorage() {
  const files = new Map<string, number>();
  const signedUploads: string[] = [];
  const storage: GalleryStorage = {
    signUpload: vi.fn(async (bucket, path) => {
      signedUploads.push(`${bucket}:${path}`);
      return { path, token: `tok.${path}`, url: `https://db.test/upload/sign/${bucket}/${path}?token=tok` };
    }),
    signRead: vi.fn(
      async (bucket: string, paths: string[], ttl: number) =>
        new Map<string, string>(paths.map((p) => [p, `https://db.test/sign/${bucket}/${p}?ttl=${ttl}`])),
    ),
    list: vi.fn(async (bucket, folder) =>
      [...files.entries()]
        .filter(([k]) => k.startsWith(`${bucket}:${folder}/`))
        .map(([k, size]) => ({ name: k.slice(`${bucket}:${folder}/`.length), size, type: null })),
    ),
    download: vi.fn(async (bucket, path) =>
      files.has(`${bucket}:${path}`) ? new Uint8Array([1, 2, 3]) : null,
    ),
    remove: vi.fn(async () => undefined),
    resumable: () => ({
      endpoint: 'https://db.test/storage/v1/upload/resumable/sign',
      apiKey: 'unit-anon-key',
    }),
  };
  const put = (bucket: string, path: string | null, size: number) => {
    if (path) files.set(`${bucket}:${path}`, size);
  };
  return { storage, files, signedUploads, put };
}

function guestWorld(
  opts: {
    gallery?: Partial<TokenLookup['gallery']>;
    features?: Feature[];
    status?: TokenLookup['invitation']['status'];
    check?: ((jpeg: Uint8Array) => Promise<AiResult>) | null;
  } = {},
) {
  const upload = tokens.newLink('upload', INV);
  const projector = tokens.newLink('projector', INV);
  const gallery = settings({
    uploadTokenHash: upload.hash,
    uploadTokenNonce: upload.nonce,
    projectorTokenHash: projector.hash,
    projectorTokenNonce: projector.nonce,
    ...opts.gallery,
  });
  const lookup: TokenLookup = {
    gallery,
    invitation: {
      id: INV,
      slug: 'noa-itay',
      status: opts.status ?? 'published',
      eventType: 'wedding',
      templateId: 'classic',
      hosts: null,
      date: '2026-09-26',
      timezone: 'Asia/Jerusalem',
      locales: ['he', 'en'],
      defaultLocale: 'he',
      palette: null,
    },
  };
  const items = new Map<string, { row: ItemRow; uploader: string }>();
  const rateAnswers = new Map<string, boolean>();
  const db = {
    byToken: vi.fn(async (hash: string, kind: 'upload' | 'projector') =>
      (kind === 'upload' ? gallery.uploadTokenHash : gallery.projectorTokenHash) === hash ? lookup : null,
    ),
    rateHit: vi.fn(async (key: string) => rateAnswers.get(key) ?? true),
    reserve: vi.fn(
      async (
        ..._args: Parameters<GuestDeps['db']['reserve']>
      ): Promise<{ ok: true } | { ok: false; code: 'full' | 'not_found'; left?: number }> => ({
        ok: true,
      }),
    ),
    itemForUploader: vi.fn(async (_inv: string, id: string, uploader: string) => {
      const found = items.get(id);
      return found && found.uploader === uploader ? { ...found.row } : null;
    }),
    complete: vi.fn(async (args: Parameters<GuestDeps['db']['complete']>[0]) => {
      const found = items.get(args.itemId);
      if (!found || found.uploader !== args.uploaderHash) return null;
      const first = found.row.status === 'uploading' && args.status !== null;
      if (args.status) found.row = { ...found.row, status: args.status, reason: args.reason };
      if (args.originalDone) found.row = { ...found.row, originalDone: true };
      return {
        status: found.row.status,
        reason: found.row.reason,
        originalDone: found.row.originalDone,
        first,
      };
    }),
    feed: vi.fn(async (): Promise<ItemRow[]> => []),
    changes: vi.fn(async () => ({
      now: '2026-09-26T18:00:00.000Z',
      added: [] as ItemRow[],
      removed: [] as string[],
    })),
    uploaderItems: vi.fn(async (): Promise<ItemRow[]> => []),
    guestDelete: vi.fn(async () => true),
    guestByToken: vi.fn(async (): Promise<string | null> => 'guest-row-id'),
  };
  const { storage, put, signedUploads } = fakeStorage();
  const deps: GuestDeps = {
    db,
    storage,
    features: vi.fn(
      async () => new Set<Feature>(opts.features ?? ['live_gallery', 'projector', 'gallery_ai']),
    ),
    broadcast: vi.fn(async () => true),
    checkImage: opts.check === undefined ? null : opts.check,
    realtime: (channel) => ({ url: 'https://db.test', key: 'unit-anon-key', channel }),
    swept: vi.fn(async () => undefined),
    now: () => NOW,
  };
  /** an item reserved by this test's phone */
  const add = (over: Partial<ItemRow> = {}, uploader = UPLOADER) => {
    const r = row(over);
    items.set(r.id, { row: r, uploader: tokens.uploaderHash(INV, uploader) });
    return r;
  };
  return {
    deps,
    db,
    storage,
    put,
    signedUploads,
    items,
    add,
    rateAnswers,
    token: upload.token,
    projector: projector.token,
    gallery,
  };
}

const photoSpec = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  kind: 'image',
  original: { type: 'image/jpeg', size: 4_000_000 },
  display: { type: 'image/jpeg', size: 800_000 },
  thumb: { type: 'image/jpeg', size: 50_000 },
  width: 4032,
  height: 3024,
  takenAt: '2026-09-26T17:45:00+03:00',
  ...over,
});

// ─── links and codes ────────────────────────────────────────────────────────────────────────────

describe('links and codes', () => {
  it('a link token is random, URL-safe, kept only as a hash, and shown again to the host', () => {
    const a = tokens.newLink('upload', INV);
    const b = tokens.newLink('upload', INV);
    expect(a.token).toMatch(tokens.TOKEN_RE);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(sha(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(tokens.linkToken('upload', INV, a.nonce, a.hash)).toBe(a.token);
    // the same nonce makes a different token for the screen, and for another event
    expect(tokens.deriveToken('projector', INV, a.nonce)).not.toBe(a.token);
    expect(tokens.deriveToken('upload', OWNER, a.nonce)).not.toBe(a.token);
    expect(tokens.linkToken('projector', INV, a.nonce, a.hash)).toBeNull();
  });

  it('after the server key changes the old link still has its hash, but the host is offered a new one', () => {
    const a = tokens.newLink('upload', INV);
    const before = env.INVITES_GALLERY_SECRET;
    env.INVITES_GALLERY_SECRET = 'another-secret';
    try {
      expect(tokens.linkToken('upload', INV, a.nonce, a.hash)).toBeNull();
    } finally {
      env.INVITES_GALLERY_SECRET = before;
    }
    expect(tokens.linkToken('upload', INV, a.nonce, a.hash)).toBe(a.token);
  });

  it('access codes ignore case, spaces and dashes; hashes are salted', () => {
    expect(tokens.normalizeCode(' Ab 12-x ')).toBe('ab12x');
    const salt = tokens.randomId();
    const hash = tokens.codeHash('AB-12', salt);
    expect(tokens.codeMatches('ab 12', salt, hash)).toBe(true);
    expect(tokens.codeMatches('ab13', salt, hash)).toBe(false);
    expect(tokens.codeHash('AB-12', tokens.randomId())).not.toBe(hash);
  });

  it('a device id and rate keys are hashes, never the raw value', () => {
    const a = tokens.uploaderHash(INV, UPLOADER);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.uploaderHash(OWNER, UPLOADER)).not.toBe(a);
    const key = tokens.rateKey('reserve-ip', `${INV}:${IP}`);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(IP);
  });
});

// ─── the guests' API ────────────────────────────────────────────────────────────────────────────

describe('the link and the gallery’s state', () => {
  it('a malformed or unknown token is not found (a malformed one never reaches the database)', async () => {
    const w = guestWorld();
    expect((await guest.guestFeed({ t: 'short' }, IP, w.deps)).status).toBe(404);
    expect(w.db.byToken).not.toHaveBeenCalled();
    expect((await guest.guestFeed({ t: 'A'.repeat(24) }, IP, w.deps)).status).toBe(404);
    // the screen's token doesn't open the upload page, nor the other way round
    expect((await guest.guestFeed({ t: w.projector }, IP, w.deps)).status).toBe(404);
    expect((await guest.projectorFeed({ p: w.token }, w.deps)).status).toBe(404);
    expect((await guest.guestFeed({ t: w.token, extra: 1 }, IP, w.deps)).status).toBe(400);
  });

  it('without live_gallery (plan or switch) the gallery is off; the screen also needs projector', async () => {
    const off = guestWorld({ features: [] });
    expect(await guest.guestFeed({ t: off.token }, IP, off.deps)).toMatchObject({
      status: 403,
      body: { code: 'off' },
    });
    const noScreen = guestWorld({ features: ['live_gallery'] });
    expect((await guest.guestFeed({ t: noScreen.token }, IP, noScreen.deps)).status).toBe(200);
    expect(await guest.projectorFeed({ p: noScreen.projector }, noScreen.deps)).toMatchObject({
      status: 200,
      body: { state: 'off', items: [] },
    });
    const archived = guestWorld({ status: 'archived' });
    expect((await guest.guestFeed({ t: archived.token }, IP, archived.deps)).body.code).toBe('off');
  });

  it('paused, not open yet or over: the feed stays, reserving is refused with the reason', async () => {
    for (const [gallery, state] of [
      [{ paused: true }, 'paused'],
      [{ opensAt: '2026-09-27T10:00:00.000Z' }, 'scheduled'],
      [{ closesAt: '2026-09-26T12:00:00.000Z' }, 'ended'],
    ] as const) {
      const w = guestWorld({ gallery });
      const feed = await guest.guestFeed({ t: w.token }, IP, w.deps);
      expect(feed.status).toBe(200);
      expect(feed.body.state).toBe(state);
      const reserve = await guest.guestReserve(
        { t: w.token, uploader: UPLOADER, items: [photoSpec('a')] },
        IP,
        w.deps,
      );
      expect(reserve).toMatchObject({ status: 403, body: { code: state } });
      expect(w.storage.signUpload).not.toHaveBeenCalled();
    }
  });

  it('the access code: asked for, wrong (rate-limited per address), or right in any spelling', async () => {
    const salt = tokens.randomId();
    const w = guestWorld({
      gallery: { accessCodeHash: tokens.codeHash('Noa 2026', salt), accessCodeSalt: salt },
    });
    expect(await guest.guestFeed({ t: w.token }, IP, w.deps)).toMatchObject({
      status: 401,
      body: { code: 'access_code', wrong: false },
    });
    expect(await guest.guestFeed({ t: w.token, code: 'noa2025' }, IP, w.deps)).toMatchObject({
      status: 401,
      body: { code: 'access_code', wrong: true },
    });
    const codeKey = tokens.rateKey('code', `${INV}:${IP}`);
    expect(w.db.rateHit).toHaveBeenCalledWith(
      codeKey,
      GALLERY.rate.codePerAddress.count,
      GALLERY.rate.codePerAddress.windowSeconds,
    );
    expect((await guest.guestFeed({ t: w.token, code: 'NOA-2026' }, IP, w.deps)).status).toBe(200);
    w.rateAnswers.set(codeKey, false);
    expect((await guest.guestFeed({ t: w.token, code: 'guess' }, IP, w.deps)).status).toBe(429);
  });
});

describe('reserving uploads', () => {
  it('checks types and sizes before signing anything; signs one exact path per part', async () => {
    const w = guestWorld();
    const res = await guest.guestReserve(
      {
        t: w.token,
        uploader: UPLOADER,
        name: '  Dana\n  <Cohen>  ',
        items: [
          photoSpec('ok'),
          photoSpec('pdf', { original: { type: 'application/pdf', size: 1000 } }),
          photoSpec('huge', { original: { type: 'image/jpeg', size: GALLERY.limits.imageBytes + 1 } }),
          photoSpec('mismatch', { kind: 'video' }),
          photoSpec('half', { display: undefined }),
          photoSpec('fat-thumb', { thumb: { type: 'image/jpeg', size: GALLERY.limits.thumbBytes + 1 } }),
          photoSpec('png-preview', { display: { type: 'image/png', size: 1000 } }),
          {
            key: 'long-video',
            kind: 'video',
            original: { type: 'video/mp4', size: 50_000_000 },
            durationMs: GALLERY.limits.videoMs + 1,
          },
          {
            key: 'video',
            kind: 'video',
            original: { type: 'video/quicktime', size: 150_000_000 },
            durationMs: 40_000,
            takenAt: '1999-12-31T23:00:00.000Z',
          },
        ],
      },
      IP,
      w.deps,
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      items: {
        key: string;
        id: string;
        parts: Record<string, { path: string; resumable: unknown; bucket: string }>;
      }[];
      rejected: { key: string; code: string }[];
    };
    expect(body.rejected).toEqual([
      { key: 'pdf', code: 'unsupported_type' },
      { key: 'huge', code: 'too_large' },
      { key: 'mismatch', code: 'unsupported_type' },
      { key: 'half', code: 'invalid' },
      { key: 'fat-thumb', code: 'invalid' },
      { key: 'png-preview', code: 'unsupported_type' },
      { key: 'long-video', code: 'too_long' },
    ]);
    expect(body.items.map((i) => i.key)).toEqual(['ok', 'video']);
    const [photo, video] = body.items;
    expect(Object.keys(photo!.parts).sort()).toEqual(['display', 'original', 'thumb']);
    expect(photo!.parts.original).toMatchObject({
      bucket: 'gallery-originals',
      path: `${INV}/${photo!.id}/original.jpg`,
      resumable: null,
    });
    expect(photo!.parts.thumb).toMatchObject({
      bucket: 'gallery-media',
      path: `${INV}/${photo!.id}/thumb.jpg`,
    });
    // a big file goes resumable; a video without a poster has only its original
    expect(Object.keys(video!.parts)).toEqual(['original']);
    expect(video!.parts.original!.path).toBe(`${INV}/${video!.id}/original.mov`);
    expect(video!.parts.original!.resumable).toEqual({
      endpoint: 'https://db.test/storage/v1/upload/resumable/sign',
      apiKey: 'unit-anon-key',
    });
    expect(w.signedUploads).toHaveLength(4);
    // what the database got: hashed device, a clean name, plausible times only, the event's cap
    const [inv, uploader, guestId, name, rows, cap] = w.db.reserve.mock.calls[0] as unknown as [
      string,
      string,
      string | null,
      string | null,
      { id: string; takenAt: string | null; durationMs: number | null; originalSize: number }[],
      number,
    ];
    expect(inv).toBe(INV);
    expect(uploader).toBe(tokens.uploaderHash(INV, UPLOADER));
    expect(guestId).toBeNull();
    expect(name).toBe('Dana Cohen');
    expect(rows.map((r) => r.takenAt)).toEqual(['2026-09-26T14:45:00.000Z', null]);
    expect(rows[1]!.durationMs).toBe(40_000);
    expect(cap).toBe(GALLERY.limits.itemsPerEvent);
  });

  it('rate-limited per link, per address and per device (hashed keys) — nothing signed when over', async () => {
    const w = guestWorld();
    const req = { t: w.token, uploader: UPLOADER, items: [photoSpec('a')] };
    expect((await guest.guestReserve(req, IP, w.deps)).status).toBe(200);
    const keys = w.db.rateHit.mock.calls.map((c) => c[0] as string);
    expect(keys).toEqual([
      tokens.rateKey('reserve-link', INV),
      tokens.rateKey('reserve-ip', `${INV}:${IP}`),
      tokens.rateKey('reserve-device', `${INV}:${UPLOADER}`),
    ]);
    for (const key of keys) expect(key).not.toContain(IP);
    w.rateAnswers.set(tokens.rateKey('reserve-ip', `${INV}:${IP}`), false);
    const before = w.signedUploads.length;
    expect(await guest.guestReserve(req, IP, w.deps)).toMatchObject({ status: 429, body: { code: 'rate' } });
    expect(w.signedUploads).toHaveLength(before);
  });

  it('the event’s cap, at most ten per request, the invitation guest link', async () => {
    const w = guestWorld();
    w.db.reserve.mockResolvedValueOnce({ ok: false, code: 'full', left: 2 });
    expect(
      await guest.guestReserve({ t: w.token, uploader: UPLOADER, items: [photoSpec('a')] }, IP, w.deps),
    ).toMatchObject({ status: 409, body: { code: 'full', left: 2 } });
    const eleven = Array.from({ length: 11 }, (_, i) => photoSpec(`p${i}`));
    expect(
      (await guest.guestReserve({ t: w.token, uploader: UPLOADER, items: eleven }, IP, w.deps)).status,
    ).toBe(400);
    expect(
      (await guest.guestReserve({ t: w.token, uploader: 'x', items: [photoSpec('a')] }, IP, w.deps)).status,
    ).toBe(400);
    await guest.guestReserve(
      { t: w.token, uploader: UPLOADER, g: 'guest-link-token-0001', items: [photoSpec('a')] },
      IP,
      w.deps,
    );
    expect(w.db.guestByToken).toHaveBeenCalledWith(INV, 'guest-link-token-0001');
    expect(w.db.reserve.mock.calls.at(-1)![2]).toBe('guest-row-id');
  });
});

describe('finishing an upload', () => {
  const metrics = { sharpness: 140, brightness: 0.45, phash: '0f0f0f0f0f0f0f0f', enhanced: true };
  const done = (w: ReturnType<typeof guestWorld>, r: ItemRow) => {
    w.put('gallery-media', r.thumbPath, 50_000);
    w.put('gallery-media', r.displayPath, 800_000);
  };

  it('the preview files must be in storage first; then a good photo is published and pages are told once', async () => {
    const w = guestWorld({ features: ['live_gallery'] });
    const r = w.add();
    const req = { t: w.token, uploader: UPLOADER, id: r.id, originalDone: false, metrics };
    expect(await guest.guestComplete(req, IP, w.deps)).toMatchObject({
      status: 409,
      body: { code: 'missing', parts: ['thumb', 'display'] },
    });
    done(w, r);
    expect(await guest.guestComplete(req, IP, w.deps)).toMatchObject({
      status: 200,
      body: { status: 'published', reason: 'ok', originalDone: false },
    });
    expect(w.deps.broadcast).toHaveBeenCalledTimes(1);
    expect(w.deps.broadcast).toHaveBeenCalledWith('gallery-channel-unit', 'items');
    const call = w.db.complete.mock.calls[0]![0];
    expect(call.metrics).toEqual(metrics);
    expect(call.sizes).toEqual({ thumb: 50_000, display: 800_000 });
    expect(call.checks.map((c) => `${c.check}:${c.result}`)).toEqual([
      'blur:pass',
      'dark:pass',
      'mode:published',
    ]);
    // again (a retry): the same answer, no second hint
    expect((await guest.guestComplete(req, IP, w.deps)).body.status).toBe('published');
    expect(w.deps.broadcast).toHaveBeenCalledTimes(1);
    // the original arrives later: only that is recorded
    w.put('gallery-originals', r.originalPath, 3_000_000);
    expect(await guest.guestComplete({ ...req, originalDone: true }, IP, w.deps)).toMatchObject({
      status: 200,
      body: { status: 'published', originalDone: true },
    });
    expect(w.db.complete.mock.calls.at(-1)![0]).toMatchObject({
      status: null,
      originalDone: true,
      sizes: { original: 3_000_000 },
    });
  });

  it('someone else’s item, or an unknown one, is not found', async () => {
    const w = guestWorld();
    const r = w.add({}, 'another-phone-000001');
    done(w, r);
    const res = await guest.guestComplete(
      { t: w.token, uploader: UPLOADER, id: r.id, originalDone: false, metrics },
      IP,
      w.deps,
    );
    expect(res.status).toBe(404);
    expect(w.db.complete).not.toHaveBeenCalled();
  });

  it('approval mode, a blurry or dark photo, a near-duplicate', async () => {
    const cases: [Partial<TokenLookup['gallery']>, Partial<ItemRow>, typeof metrics, string, string][] = [
      [{ mode: 'approval' }, {}, metrics, 'pending', 'approval'],
      [{}, {}, { ...metrics, sharpness: GALLERY.moderation.blurHold - 1 }, 'pending', 'blurry'],
      [{}, {}, { ...metrics, brightness: GALLERY.moderation.darkHold / 2 }, 'pending', 'dark'],
      [{}, { nearest: GALLERY.moderation.duplicateDistance }, metrics, 'rejected', 'duplicate'],
      [{}, { nearest: GALLERY.moderation.duplicateDistance + 1 }, metrics, 'published', 'ok'],
    ];
    for (const [gallery, over, m, status, reason] of cases) {
      const w = guestWorld({ gallery, features: ['live_gallery'] });
      const r = w.add(over);
      done(w, r);
      const res = await guest.guestComplete(
        { t: w.token, uploader: UPLOADER, id: r.id, originalDone: false, metrics: m },
        IP,
        w.deps,
      );
      expect(res.body).toMatchObject({ status, reason });
    }
  });

  it('the automatic check runs on the thumbnail when the event has it: suspicious → held, unsafe → out', async () => {
    const answers: AiResult[] = [
      { status: 'ok', nsfw: 0.02, quality: 0.9, reason: 'guests dancing' },
      { status: 'ok', nsfw: 0.6, quality: 0.8, reason: 'maybe' },
      { status: 'ok', nsfw: 0.95, quality: 0.8, reason: 'nudity' },
      { status: 'ok', nsfw: 0.01, quality: 0.05, reason: 'a pocket' },
      { status: 'refused' },
      { status: 'error', error: '529 overloaded_error' },
    ];
    const expected = [
      ['published', 'ok'],
      ['pending', 'nsfw'],
      ['rejected', 'unsafe'],
      ['pending', 'quality'],
      ['pending', 'nsfw'],
      ['pending', 'unchecked'],
    ];
    for (const [i, answer] of answers.entries()) {
      const check = vi.fn(async () => answer);
      const w = guestWorld({ check });
      const r = w.add();
      done(w, r);
      const res = await guest.guestComplete(
        { t: w.token, uploader: UPLOADER, id: r.id, originalDone: false, metrics },
        IP,
        w.deps,
      );
      expect([res.body.status, res.body.reason]).toEqual(expected[i]);
      expect(w.storage.download).toHaveBeenCalledWith('gallery-media', r.thumbPath);
      expect(check).toHaveBeenCalledTimes(1);
      const saved = w.db.complete.mock.calls[0]![0];
      if (answer.status === 'ok')
        expect(saved.metrics).toMatchObject({ aiNsfw: answer.nsfw, aiQuality: answer.quality });
      if (i === 2) expect(w.deps.broadcast).toHaveBeenCalledTimes(1);
    }
  });

  it('without the feature, or without a model on this server, nothing is sent to the AI', async () => {
    const check = vi.fn(async (): Promise<AiResult> => ({ status: 'ok', nsfw: 0, quality: 1, reason: '' }));
    const w = guestWorld({ check, features: ['live_gallery'] });
    const r = w.add();
    done(w, r);
    await guest.guestComplete(
      { t: w.token, uploader: UPLOADER, id: r.id, originalDone: false, metrics },
      IP,
      w.deps,
    );
    expect(check).not.toHaveBeenCalled();
    const noModel = guestWorld({ check: null });
    const r2 = noModel.add();
    done(noModel, r2);
    const res = await guest.guestComplete(
      { t: noModel.token, uploader: UPLOADER, id: r2.id, originalDone: false, metrics },
      IP,
      noModel.deps,
    );
    expect(res.body.status).toBe('published');
  });

  it('past the day’s ceiling of checks an upload waits for the host', async () => {
    const check = vi.fn(async (): Promise<AiResult> => ({ status: 'ok', nsfw: 0, quality: 1, reason: '' }));
    const w = guestWorld({ check });
    w.rateAnswers.set(tokens.rateKey('ai', 'day'), false);
    const r = w.add();
    done(w, r);
    const res = await guest.guestComplete(
      { t: w.token, uploader: UPLOADER, id: r.id, originalDone: false, metrics },
      IP,
      w.deps,
    );
    expect(res.body).toMatchObject({ status: 'pending', reason: 'unchecked' });
    expect(check).not.toHaveBeenCalled();
  });

  it('a video needs its file first (the feed plays it); a file over the limit doesn’t count; the poster is checked', async () => {
    const check = vi.fn(async (): Promise<AiResult> => ({
      status: 'ok',
      nsfw: 0.01,
      quality: 0.9,
      reason: 'toast',
    }));
    const w = guestWorld({ check });
    const r = w.add({
      kind: 'video',
      originalPath: `${INV}/v1/original.mp4`,
      originalType: 'video/mp4',
      originalSize: 80_000_000,
      durationMs: 30_000,
    });
    done(w, r);
    const req = { t: w.token, uploader: UPLOADER, id: r.id, originalDone: true, metrics: null };
    // the fake lists by the item's folder: put the original where the item's folder is
    const original = `${INV}/${r.id}/original.mp4`;
    w.items.get(r.id)!.row.originalPath = original;
    expect(await guest.guestComplete(req, IP, w.deps)).toMatchObject({
      status: 409,
      body: { parts: ['original'] },
    });
    w.put('gallery-originals', original, GALLERY.limits.videoBytes + 1);
    expect((await guest.guestComplete(req, IP, w.deps)).body.parts).toEqual(['original']);
    w.put('gallery-originals', original, 80_000_000);
    expect(await guest.guestComplete(req, IP, w.deps)).toMatchObject({
      status: 200,
      body: { status: 'published', originalDone: true },
    });
    expect(check).toHaveBeenCalledTimes(1);
    // a video has no blur / dark / duplicate checks
    const checks = w.db.complete.mock.calls.at(-1)![0].checks.map((c) => c.check);
    expect(checks).toEqual(['ai', 'mode']);
  });

  it('a thumbnail bigger than allowed is refused', async () => {
    const w = guestWorld({ features: ['live_gallery'] });
    const r = w.add();
    w.put('gallery-media', r.thumbPath, GALLERY.limits.thumbBytes + 1);
    w.put('gallery-media', r.displayPath, 800_000);
    expect(
      (
        await guest.guestComplete(
          { t: w.token, uploader: UPLOADER, id: r.id, originalDone: false, metrics },
          IP,
          w.deps,
        )
      ).status,
    ).toBe(413);
  });
});

describe('signing again, deleting one’s own upload', () => {
  it('fresh upload URLs for what isn’t stored yet; what is comes back done', async () => {
    const w = guestWorld();
    const r = w.add();
    w.put('gallery-media', r.thumbPath, 50_000);
    const res = await guest.guestResign(
      { t: w.token, uploader: UPLOADER, id: r.id, parts: ['thumb', 'display', 'original'] },
      IP,
      w.deps,
    );
    expect(res.status).toBe(200);
    const parts = res.body.parts as Record<string, { done?: true; path?: string }>;
    expect(parts.thumb).toEqual({ done: true });
    expect(parts.display!.path).toBe(r.displayPath);
    expect(parts.original!.path).toBe(r.originalPath);
    const other = await guest.guestResign(
      { t: w.token, uploader: 'another-phone-000001', id: r.id, parts: ['thumb'] },
      IP,
      w.deps,
    );
    expect(other.status).toBe(404);
  });

  it('a guest deletes their own upload: the files go now and pages are told', async () => {
    const w = guestWorld();
    const id = randomUUID();
    expect((await guest.guestRemove({ t: w.token, uploader: UPLOADER, id }, IP, w.deps)).status).toBe(200);
    expect(w.db.guestDelete).toHaveBeenCalledWith(INV, id, tokens.uploaderHash(INV, UPLOADER));
    expect(w.deps.swept).toHaveBeenCalled();
    expect(w.deps.broadcast).toHaveBeenCalledWith('gallery-channel-unit', 'items');
    w.db.guestDelete.mockResolvedValueOnce(false);
    expect((await guest.guestRemove({ t: w.token, uploader: UPLOADER, id }, IP, w.deps)).status).toBe(404);
  });
});

describe('the feed and the screen', () => {
  const published = (over: Partial<ItemRow> = {}) =>
    row({
      status: 'published',
      reason: 'ok',
      publishedAt: '2026-09-26T17:30:00.000Z',
      originalDone: true,
      ...over,
    });

  it('a page of published items with signed URLs only (no paths, no scores), and the next cursor', async () => {
    const w = guestWorld();
    const rows = Array.from({ length: GALLERY.feed.pageSize }, () => published());
    const video = published({
      kind: 'video',
      originalPath: `${INV}/v/original.mp4`,
      originalType: 'video/mp4',
      durationMs: 12_000,
    });
    rows[0] = video;
    w.db.feed.mockResolvedValueOnce(rows);
    const res = await guest.guestFeed({ t: w.token }, IP, w.deps);
    expect(res.status).toBe(200);
    const items = res.body.items as Record<string, unknown>[];
    expect(items).toHaveLength(GALLERY.feed.pageSize);
    expect(Object.keys(items[1]!).sort()).toEqual(
      [
        'at',
        'display',
        'durationMs',
        'height',
        'id',
        'kind',
        'name',
        'takenAt',
        'thumb',
        'video',
        'width',
      ].sort(),
    );
    expect(items[1]!.thumb).toBe(
      `https://db.test/sign/gallery-media/${rows[1]!.thumbPath}?ttl=${GALLERY.urls.signedTtlSeconds}`,
    );
    expect(items[0]!.video).toBe(
      `https://db.test/sign/gallery-originals/${video.originalPath}?ttl=${GALLERY.urls.signedTtlSeconds}`,
    );
    expect(items[1]!.video).toBeNull();
    // one signing request per bucket, whatever the page size
    expect(w.storage.signRead).toHaveBeenCalledTimes(2);
    expect(res.body.next).toEqual({ at: rows.at(-1)!.publishedAt, id: rows.at(-1)!.id });
    expect(res.body.realtime).toEqual({
      url: 'https://db.test',
      key: 'unit-anon-key',
      channel: 'gallery-channel-unit',
    });
    expect(res.body.expiresAt).toBe(NOW + GALLERY.urls.signedTtlSeconds * 1000);
    expect(JSON.stringify(res.body)).not.toMatch(/uploader|sharpness|aiNsfw|phash|originalPath/);
  });

  it('what changed since (with a little overlap), this phone’s own uploads, a per-device limit', async () => {
    const w = guestWorld();
    const mine = row({ status: 'pending', reason: 'approval' });
    w.db.uploaderItems.mockResolvedValueOnce([mine]);
    w.db.changes.mockResolvedValueOnce({
      now: '2026-09-26T18:00:01.000Z',
      added: [published()],
      removed: ['gone-id'],
    });
    const res = await guest.guestFeed(
      { t: w.token, since: '2026-09-26T17:59:00.000Z', uploader: UPLOADER, mine: true },
      IP,
      w.deps,
    );
    expect(w.db.changes).toHaveBeenCalledWith(INV, '2026-09-26T17:58:55.000Z', 200);
    expect(w.db.uploaderItems).toHaveBeenCalledWith(INV, tokens.uploaderHash(INV, UPLOADER));
    expect(res.body).toMatchObject({ now: '2026-09-26T18:00:01.000Z', removed: ['gone-id'], next: null });
    expect(res.body.mine).toEqual([
      {
        id: mine.id,
        kind: 'image',
        status: 'pending',
        reason: 'approval',
        thumb: expect.stringContaining(mine.thumbPath!),
        createdAt: mine.createdAt,
      },
    ]);
    w.rateAnswers.set(tokens.rateKey('feed', `${INV}:${UPLOADER}`), false);
    expect((await guest.guestFeed({ t: w.token, uploader: UPLOADER }, IP, w.deps)).status).toBe(429);
  });

  it('the screen: newest published items, then what changed', async () => {
    const w = guestWorld();
    w.db.feed.mockResolvedValueOnce([published()]);
    const first = await guest.projectorFeed({ p: w.projector }, w.deps);
    expect(first).toMatchObject({ status: 200, body: { state: 'open' } });
    expect(w.db.feed).toHaveBeenCalledWith(INV, null, 200);
    expect((first.body.items as unknown[]).length).toBe(1);
    await guest.projectorFeed({ p: w.projector, since: '2026-09-26T18:00:00.000Z' }, w.deps);
    expect(w.db.changes).toHaveBeenCalledWith(INV, '2026-09-26T17:59:55.000Z', 200);
  });
});

// ─── the host's side ────────────────────────────────────────────────────────────────────────────

function hostWorld(plan: PlanId = 'business', opts: { gallery?: boolean } = {}) {
  let gallery: GallerySettings | null = null;
  const patches: Record<string, unknown>[] = [];
  const owned = (): OwnerGallery => ({
    slug: 'noa-itay',
    status: 'published',
    timezone: 'Asia/Jerusalem',
    gallery,
    counts: null,
  });
  const makeGallery = (
    links: { uploadHash: string; uploadNonce: string; projectorHash: string; projectorNonce: string },
    channel: string,
  ): GallerySettings => ({
    invitationId: INV,
    enabled: true,
    mode: 'instant',
    paused: false,
    opensAt: null,
    closesAt: null,
    hasCode: false,
    uploadTokenHash: links.uploadHash,
    uploadTokenNonce: links.uploadNonce,
    projectorTokenHash: links.projectorHash,
    projectorTokenNonce: links.projectorNonce,
    channel,
    createdAt: '2026-09-26T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
  });
  if (opts.gallery) {
    const u = tokens.newLink('upload', INV);
    const p = tokens.newLink('projector', INV);
    gallery = makeGallery(
      { uploadHash: u.hash, uploadNonce: u.nonce, projectorHash: p.hash, projectorNonce: p.nonce },
      'host-channel-1',
    );
  }
  const mine = (userId: string) => userId === OWNER;
  const db = {
    ownerGet: vi.fn(async (_id: string, userId: string) => (mine(userId) ? owned() : null)),
    ownerCreate: vi.fn(
      async (
        _id: string,
        userId: string,
        links: Parameters<HostGalleryDeps['db']['ownerCreate']>[2],
        channel: string,
      ) => {
        if (!mine(userId)) return null;
        gallery ??= makeGallery(links, channel);
        return owned();
      },
    ),
    ownerUpdate: vi.fn(async (_id: string, userId: string, patch: Record<string, unknown>) => {
      if (!mine(userId) || !gallery) return null;
      patches.push(patch);
      const { accessCode, ...rest } = patch;
      gallery = { ...gallery, ...(rest as Partial<GallerySettings>) };
      if (accessCode !== undefined) gallery.hasCode = accessCode !== null;
      return owned();
    }),
    ownerRotate: vi.fn(
      async (
        _id: string,
        userId: string,
        which: 'upload' | 'projector',
        hash: string,
        nonce: string,
        channel: string,
      ) => {
        if (!mine(userId) || !gallery) return null;
        gallery =
          which === 'upload'
            ? { ...gallery, uploadTokenHash: hash, uploadTokenNonce: nonce, channel }
            : { ...gallery, projectorTokenHash: hash, projectorTokenNonce: nonce, channel };
        return owned();
      },
    ),
    ownerDelete: vi.fn(async (_id: string, userId: string) => mine(userId)),
    ownerItems: vi.fn(async (): Promise<ItemRow[] | null> => []),
    ownerModerate: vi.fn(async (_id: string, _u: string, ids: string[]) => ({ count: ids.length, ids })),
    ownerOriginals: vi.fn(async (): Promise<{ items: ItemRow[]; total: number; bytes: number } | null> => ({
      items: [],
      total: 0,
      bytes: 0,
    })),
  };
  const { storage } = fakeStorage();
  const input = (): FeatureInput & { ownerId: string } => ({
    plan,
    admin: false,
    overrides: NO_OVERRIDES,
    available: ALL,
    ownerId: OWNER,
  });
  const deps: HostGalleryDeps = {
    db,
    storage,
    featureInput: vi.fn(async () => input()),
    broadcast: vi.fn(async () => true),
    realtime: (channel) => ({ url: 'https://db.test', key: 'unit-anon-key', channel }),
    sweep: vi.fn(async () => undefined),
    qr: vi.fn(async (url: string) => ({
      svg: `<svg data-url="${url}"></svg>`,
      png: 'data:image/png;base64,AA',
    })),
    now: () => NOW,
  };
  return { deps, db, storage, patches, current: () => gallery };
}

const BASE = 'https://invitations.example.com';
type View = NonNullable<Awaited<ReturnType<typeof host.hostView>>>;

describe('the host’s gallery tab', () => {
  it('only the owner; a plan without the gallery gets the upgrade (which package, which plan)', async () => {
    const w = hostWorld('free');
    expect((await host.getGallery('someone-else', INV, BASE, w.deps)).status).toBe(404);
    expect((await host.getGallery(OWNER, 'not-a-uuid', BASE, w.deps)).status).toBe(404);
    const view = (await host.getGallery(OWNER, INV, BASE, w.deps)).body.view as View;
    expect(view.gallery).toBeNull();
    expect(view.features.live_gallery).toEqual({ on: false, why: 'plan', package: 'premium', plan: 'pro' });
    expect(view.features.projector).toMatchObject({ on: false, package: 'vip', plan: 'business' });
    expect(await host.turnOn(OWNER, INV, BASE, w.deps)).toMatchObject({
      status: 402,
      body: { code: 'plan', package: 'premium' },
    });
    expect(w.db.ownerCreate).not.toHaveBeenCalled();
  });

  it('turning it on makes two links kept as hashes; the page shows them, with a QR code', async () => {
    const w = hostWorld('pro');
    const res = await host.turnOn(OWNER, INV, BASE, w.deps);
    expect(res.status).toBe(200);
    const links = w.db.ownerCreate.mock.calls[0]![2];
    const view = res.body.view as View;
    const t = new URL(view.gallery!.uploadUrl!).searchParams.get('t')!;
    expect(view.gallery!.uploadUrl).toBe(`${BASE}/e/noa-itay/upload?t=${t}`);
    expect(sha(t)).toBe(links.uploadHash);
    expect(links.projectorHash).not.toBe(links.uploadHash);
    expect(JSON.stringify(links)).not.toContain(t);
    expect(view.gallery!.qr!.svg).toContain(view.gallery!.uploadUrl!);
    // Pro has no screen: no screen link
    expect(view.gallery!.projectorUrl).toBeNull();
    expect(view.gallery!.state).toBe('open');
    const biz = hostWorld('business');
    const bizView = (await host.turnOn(OWNER, INV, BASE, biz.deps)).body.view as View;
    const p = new URL(bizView.gallery!.projectorUrl!).searchParams.get('t')!;
    expect(sha(p)).toBe(biz.db.ownerCreate.mock.calls[0]![2].projectorHash);
  });

  it('settings: only what is sent; a window that ends before it opens is refused; codes are hashed with a salt', async () => {
    const w = hostWorld('pro', { gallery: true });
    expect(
      await host.updateSettings(
        OWNER,
        INV,
        { opensAt: '2026-09-26T20:00:00.000Z', closesAt: '2026-09-26T19:00:00.000Z' },
        BASE,
        w.deps,
      ),
    ).toMatchObject({ status: 400, body: { field: 'closesAt' } });
    expect((await host.updateSettings(OWNER, INV, { accessCode: 'ab' }, BASE, w.deps)).body).toMatchObject({
      field: 'accessCode',
    });
    expect((await host.updateSettings(OWNER, INV, {}, BASE, w.deps)).status).toBe(400);
    expect(
      (await host.updateSettings(OWNER, INV, { mode: 'approval', paused: true }, BASE, w.deps)).status,
    ).toBe(200);
    expect(w.patches.at(-1)).toEqual({ mode: 'approval', paused: true });
    expect(w.deps.broadcast).toHaveBeenLastCalledWith('host-channel-1', 'settings');
    await host.updateSettings(OWNER, INV, { accessCode: ' Noa-2026 ' }, BASE, w.deps);
    const code = w.patches.at(-1)!.accessCode as { hash: string; salt: string };
    expect(code.hash).toBe(tokens.codeHash('noa2026', code.salt));
    expect(JSON.stringify(w.patches.at(-1))).not.toMatch(/noa-?2026/i);
    await host.updateSettings(OWNER, INV, { accessCode: null }, BASE, w.deps);
    expect(w.patches.at(-1)).toEqual({ accessCode: null });
    expect((await host.updateSettings('someone-else', INV, { paused: false }, BASE, w.deps)).status).toBe(
      404,
    );
  });

  it('turning it back on needs the plan', async () => {
    const w = hostWorld('free', { gallery: true });
    await host.updateSettings(OWNER, INV, { enabled: false }, BASE, w.deps);
    expect(await host.updateSettings(OWNER, INV, { enabled: true }, BASE, w.deps)).toMatchObject({
      status: 402,
      body: { code: 'plan' },
    });
  });

  it('a new link replaces the old one at once; pages on the old one are told', async () => {
    const w = hostWorld('business', { gallery: true });
    const old = w.current()!.uploadTokenHash;
    const res = await host.rotateLink(OWNER, INV, { which: 'upload' }, BASE, w.deps);
    expect(res.status).toBe(200);
    expect(w.current()!.uploadTokenHash).not.toBe(old);
    expect(w.current()!.channel).not.toBe('host-channel-1');
    expect(w.deps.broadcast).toHaveBeenCalledWith('host-channel-1', 'settings');
    const t = new URL((res.body.view as View).gallery!.uploadUrl!).searchParams.get('t')!;
    expect(sha(t)).toBe(w.current()!.uploadTokenHash);
    expect((await host.rotateLink(OWNER, INV, { which: 'rsvp' }, BASE, w.deps)).status).toBe(400);
  });

  it('review: approve, hide, reject, delete (the files go), each id once', async () => {
    const w = hostWorld('pro', { gallery: true });
    const a = randomUUID();
    const res = await host.moderateItems(OWNER, INV, { action: 'publish', ids: [a, a] }, w.deps);
    expect(res.body).toMatchObject({ count: 1 });
    expect(w.db.ownerModerate).toHaveBeenCalledWith(INV, OWNER, [a], 'publish');
    expect(w.deps.sweep).not.toHaveBeenCalled();
    await host.moderateItems(OWNER, INV, { action: 'delete', ids: [a] }, w.deps);
    expect(w.deps.sweep).toHaveBeenCalledTimes(1);
    expect((await host.moderateItems(OWNER, INV, { action: 'feature', ids: [a] }, w.deps)).status).toBe(400);
    expect((await host.moderateItems(OWNER, INV, { action: 'hide', ids: ['x'] }, w.deps)).status).toBe(400);
  });

  it('the host’s list shows everything about an item, with the next page', async () => {
    const w = hostWorld('pro', { gallery: true });
    const rows = Array.from({ length: GALLERY.feed.hostPageSize }, () =>
      row({ status: 'pending', reason: 'nsfw', aiNsfw: 0.6, aiQuality: 0.8, guestName: 'Dana' }),
    );
    w.db.ownerItems.mockResolvedValueOnce(rows);
    const res = await host.listItems(OWNER, INV, { status: 'pending' }, w.deps);
    expect(w.db.ownerItems).toHaveBeenCalledWith(INV, OWNER, 'pending', null, GALLERY.feed.hostPageSize);
    const first = (res.body.items as Record<string, unknown>[])[0]!;
    expect(first).toMatchObject({ status: 'pending', reason: 'nsfw', aiNsfw: 0.6, guestName: 'Dana' });
    expect(res.body.next).toEqual({ at: rows.at(-1)!.createdAt, id: rows.at(-1)!.id });
    expect((await host.listItems(OWNER, INV, { status: 'everything' }, w.deps)).status).toBe(400);
    w.db.ownerItems.mockResolvedValueOnce(null);
    expect((await host.listItems(OWNER, INV, {}, w.deps)).status).toBe(404);
  });

  it('the download list: originals (or the display version while one is missing), named by time in the event’s zone', async () => {
    const w = hostWorld('pro', { gallery: true });
    const a = row({ originalDone: true, takenAt: '2026-09-26T18:04:33.000Z', name: 'Dana / Cohen?' });
    const b = row({ originalDone: false, originalType: 'image/heic', createdAt: '2026-09-26T18:10:00.000Z' });
    const c = row({ originalDone: false, displayPath: null });
    w.db.ownerOriginals.mockResolvedValueOnce({ items: [a, b, c], total: 3, bytes: 123 });
    const res = await host.originalsPage(OWNER, INV, { scope: 'published' }, w.deps);
    expect(w.db.ownerOriginals).toHaveBeenCalledWith(INV, OWNER, 'published', null, 100);
    const files = res.body.files as {
      id: string;
      name: string;
      url: string;
      partial: boolean;
      size: number;
    }[];
    expect(files.map((f) => f.id)).toEqual([a.id, b.id]);
    expect(files[0]!.name).toBe(`2026-09-26_21-04-33_Dana-Cohen_${a.id.slice(0, 8)}.jpg`);
    expect(files[0]!.url).toContain(`gallery-originals/${a.originalPath}`);
    expect(files[1]).toMatchObject({ partial: true, size: b.displaySize });
    expect(files[1]!.name).toBe(`2026-09-26_21-10-00_${b.id.slice(0, 8)}_preview.jpg`);
    expect(files[1]!.url).toContain(`gallery-media/${b.displayPath}`);
    expect(res.body).toMatchObject({ total: 3, bytes: 123, next: null });
    expect(host.stamp('2026-01-01T00:00:00.000Z', 'Not/AZone')).toBe('2026-01-01_00-00-00');
  });

  it('deleting the gallery removes its files and tells the pages', async () => {
    const w = hostWorld('pro', { gallery: true });
    expect((await host.deleteGallery(OWNER, INV, w.deps)).status).toBe(200);
    expect(w.deps.sweep).toHaveBeenCalled();
    expect(w.deps.broadcast).toHaveBeenCalledWith('host-channel-1', 'settings');
    expect((await host.deleteGallery('someone-else', INV, w.deps)).status).toBe(404);
  });
});

// ─── the automatic check ────────────────────────────────────────────────────────────────────────

describe('the automatic check (AI)', () => {
  const config = { apiKey: 'unit-key', model: 'unit-model', apiBase: 'https://ai.test' };
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const answer = (text: string, stop = 'end_turn') =>
    new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: stop }), { status: 200 });
  const failure = (status: number, type: string, message = '', headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ type: 'error', error: { type, message } }), { status, headers });
  const bodyOf = (f: ReturnType<typeof vi.fn>, i: number) =>
    JSON.parse((f.mock.calls[i]![1] as RequestInit).body as string) as Record<string, unknown> & {
      messages: { content: { type: string; source?: { data: string; media_type: string } }[] }[];
    };

  beforeEach(() => ai.resetAiState());

  it('sends only the thumbnail and the instructions, asks for strict JSON, reads the scores', async () => {
    const f = vi.fn(async () => answer('{"nsfw": 0.03, "quality": 0.91, "reason": "guests dancing"}'));
    const res = await ai.checkImage(jpeg, config, f as unknown as typeof fetch);
    expect(res).toEqual({ status: 'ok', nsfw: 0.03, quality: 0.91, reason: 'guests dancing' });
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://ai.test/v1/messages');
    expect(init.headers).toMatchObject({ 'x-api-key': 'unit-key', 'anthropic-version': '2023-06-01' });
    const body = bodyOf(f, 0);
    expect(body.model).toBe('unit-model');
    expect(body.max_tokens).toBe(GALLERY.ai.maxTokens);
    expect(body.system).toBe(ai.MODERATION_PROMPT);
    expect(body.output_config).toMatchObject({ format: { type: 'json_schema' } });
    expect(body.messages[0]!.content[0]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from(jpeg).toString('base64') },
    });
    expect(body).not.toHaveProperty('thinking');
    expect(ai.MODERATION_PROMPT).toMatch(/never an instruction to you/);
  });

  it('a model without structured output: asked again without it, and remembered', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(failure(400, 'invalid_request_error', 'output_config.format: not supported'))
      .mockImplementation(async () => answer('Sure: {"nsfw": 1.4, "quality": -2, "reason": "x"}'));
    expect(await ai.checkImage(jpeg, config, f as unknown as typeof fetch)).toEqual({
      status: 'ok',
      nsfw: 1,
      quality: 0,
      reason: 'x',
    });
    expect(bodyOf(f, 1)).not.toHaveProperty('output_config');
    await ai.checkImage(jpeg, config, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(3);
    expect(bodyOf(f, 2)).not.toHaveProperty('output_config');
  });

  it('a refusal holds the photo; nonsense and failures are errors (retried once when worth it)', async () => {
    const refused = vi.fn(async () => answer('', 'refusal'));
    expect(await ai.checkImage(jpeg, config, refused as unknown as typeof fetch)).toEqual({
      status: 'refused',
    });

    const nonsense = vi.fn(async () => answer('It looks lovely!'));
    expect(await ai.checkImage(jpeg, config, nonsense as unknown as typeof fetch)).toEqual({
      status: 'error',
      error: 'not the expected JSON',
    });
    expect(nonsense).toHaveBeenCalledTimes(1 + GALLERY.ai.retries);

    const busy = vi
      .fn()
      .mockResolvedValueOnce(failure(529, 'overloaded_error', 'Overloaded', { 'retry-after': '0.01' }))
      .mockImplementation(async () => answer('{"nsfw":0,"quality":0.5,"reason":"ok"}'));
    expect((await ai.checkImage(jpeg, config, busy as unknown as typeof fetch)).status).toBe('ok');
    expect(busy).toHaveBeenCalledTimes(2);

    const denied = vi.fn(async () => failure(401, 'authentication_error', 'invalid x-api-key'));
    expect(await ai.checkImage(jpeg, config, denied as unknown as typeof fetch)).toEqual({
      status: 'error',
      error: '401 authentication_error',
    });
    expect(denied).toHaveBeenCalledTimes(1);

    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect((await ai.checkImage(jpeg, config, down as unknown as typeof fetch)).status).toBe('error');

    const late = vi.fn();
    expect(
      await ai.checkImage(jpeg, config, late as unknown as typeof fetch, { deadline: Date.now() + 500 }),
    ).toEqual({
      status: 'error',
      error: 'no answer',
    });
    expect(late).not.toHaveBeenCalled();
  });

  it('reads only the expected JSON', () => {
    expect(ai.parseAnswer('{"nsfw":0.2,"quality":0.7,"reason":" fine "}')).toEqual({
      nsfw: 0.2,
      quality: 0.7,
      reason: 'fine',
    });
    expect(ai.parseAnswer('```json\n{"nsfw":0.2,"quality":0.7,"reason":"a"}\n```')).toMatchObject({
      nsfw: 0.2,
    });
    expect(ai.parseAnswer('{"nsfw":"low","quality":0.7,"reason":"a"}')).toBeNull();
    expect(ai.parseAnswer('{"quality":0.7,"reason":"a"}')).toBeNull();
    expect(ai.parseAnswer('no')).toBeNull();
  });
});

// ─── the live hint, the clean-up, storage errors ────────────────────────────────────────────────

describe('the live hint and the clean-up', () => {
  it('a hint says only "something changed", on the gallery’s channel, with the server key', async () => {
    const f = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await broadcastRefresh('chan-xyz', 'items', f as unknown as typeof fetch)).toBe(true);
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://db.test/realtime/v1/api/broadcast');
    expect(init.headers).toMatchObject({ apikey: 'unit-service-key' });
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([
      {
        topic: 'chan-xyz',
        event: 'refresh',
        payload: { kind: 'items', at: expect.any(Number) },
        private: false,
      },
    ]);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await broadcastRefresh('chan-xyz', 'items', down as unknown as typeof fetch)).toBe(false);
    error.mockRestore();
  });

  it('removes the queued files bucket by bucket, then marks them done', async () => {
    const batch = [
      { id: 1, bucket: 'gallery-originals', path: 'a/original.jpg' },
      { id: 2, bucket: 'gallery-media', path: 'a/thumb.jpg' },
      { id: 3, bucket: 'gallery-media', path: 'a/display.jpg' },
    ];
    const db = {
      trashClaim: vi.fn().mockResolvedValueOnce(batch).mockResolvedValue([]),
      trashDone: vi.fn(async (ids: number[]) => ids.length),
      maintenance: vi.fn(),
    };
    const storage = { remove: vi.fn(async () => undefined) };
    expect(await sweepTrash(1000, { db, storage })).toBe(3);
    expect(storage.remove).toHaveBeenCalledWith('gallery-originals', ['a/original.jpg']);
    expect(storage.remove).toHaveBeenCalledWith('gallery-media', ['a/thumb.jpg', 'a/display.jpg']);
    expect(db.trashDone).toHaveBeenCalledWith([1, 2, 3]);
    // a failed removal leaves them queued (claimed again after the lease)
    const failing = { remove: vi.fn(async () => Promise.reject(new Error('storage down'))) };
    db.trashClaim.mockResolvedValueOnce(batch);
    db.trashDone.mockClear();
    await expect(sweepTrash(1000, { db, storage: failing })).rejects.toThrow('storage down');
    expect(db.trashDone).not.toHaveBeenCalled();
  });
});

describe('what a storage error means for the upload queue', () => {
  it('already there, too big, wrong type, expired, try later', () => {
    expect(classify(409, '')).toBe('done');
    expect(
      classify(400, '{"statusCode":"409","error":"Duplicate","message":"The resource already exists"}'),
    ).toBe('done');
    expect(classify(413, '')).toBe('too_large');
    expect(
      classify(400, '{"error":"Payload too large","message":"The object exceeded the maximum allowed size"}'),
    ).toBe('too_large');
    expect(classify(415, '')).toBe('unsupported');
    expect(
      classify(400, '{"error":"invalid_mime_type","message":"mime type image/tiff is not supported"}'),
    ).toBe('unsupported');
    expect(classify(400, '{"statusCode":"403","error":"Unauthorized","message":"jwt expired"}')).toBe(
      'expired',
    );
    expect(classify(403, 'signature verification failed')).toBe('expired');
    expect(classify(0, '')).toBe('network');
    for (const s of [408, 429, 500, 502, 503]) expect(classify(s, '')).toBe('server');
    expect(classify(400, 'bad')).toBe('expired');
    expect(classify(404, '')).toBe('server');
  });
});

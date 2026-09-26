import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FACES, modelBase } from '@/features/faces/config';
import {
  DESCRIPTOR_LENGTH,
  DescriptorSchema,
  FacesSchema,
  faceDistance,
  faceWindow,
  matchPhotos,
  normalizeFaces,
  type Face,
} from '@/features/faces/model';
import type { FaceGuestDeps, FaceHostDeps } from '@/features/faces/server/api';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { ItemRow, TokenLookup } from '@/features/live-gallery/server/db';
import type { GuestDeps } from '@/features/live-gallery/server/guest-api';

/**
 * Face search ("the photos I'm in") without a browser or a database: the model's version, the math
 * that decides two faces are the same person (search) or close enough to leave out or forget, what a
 * detector's faces become before they are sent, the window face search is open in (until its data's
 * erasure, 30 days after the event), and the API over fake dependencies — the flag, the window, the
 * link and its access code, the rate limits, the thresholds each call uses. The SQL: tests/db/faces.test.ts;
 * the real model on real photos: tests/unit/face-model.test.ts.
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
const api = await import('@/features/faces/server/api');

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const IP = '203.0.113.9';
const NOW = Date.parse('2026-09-27T18:00:00.000Z');
const ALL = new Set<Feature>(FEATURES);

/** A descriptor pointing one way, with `noise` added to each number (seeded). */
function descriptor(seed: number, noise = 0, base = 0.05): number[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
  const dir = Array.from({ length: DESCRIPTOR_LENGTH }, (_, i) => base * Math.sin(i * ((seed % 7) + 1)));
  return dir.map((v) => v + noise * rand());
}

// ─── the model and the math ─────────────────────────────────────────────────────────────────────

describe('the face model', () => {
  it('is the installed @vladmandic/face-api, served from the app itself', () => {
    const pkg = JSON.parse(readFileSync('node_modules/@vladmandic/face-api/package.json', 'utf8')) as {
      version: string;
    };
    expect(FACES.model.version).toBe(pkg.version);
    expect(modelBase()).toBe(`/face-models/${pkg.version}/`);
    for (const net of FACES.model.nets)
      expect(() =>
        readFileSync(`node_modules/@vladmandic/face-api/model/${net}-weights_manifest.json`),
      ).not.toThrow();
  });
});

describe('the same person, or not', () => {
  it('measures the Euclidean distance between descriptors', () => {
    expect(faceDistance([0, 0], [3, 4])).toBe(5);
    const a = descriptor(3);
    expect(faceDistance(a, a)).toBe(0);
  });

  it('search finds photos within 0.52; leaving out and forgetting reach a little further (0.6)', () => {
    expect(FACES.match.search).toBeLessThan(FACES.match.exclude);
    expect(FACES.match.exclude).toBeLessThanOrEqual(0.6);
    const me = descriptor(11);
    const shift = (d: number[], by: number) => d.map((v, i) => (i === 0 ? v + by : v));
    const faces = [
      { itemId: 'close', descriptor: shift(me, 0.3) },
      { itemId: 'edge', descriptor: shift(me, 0.56) }, // beyond search, within exclusion
      { itemId: 'stranger', descriptor: shift(me, 0.9) },
      { itemId: 'close', descriptor: shift(me, 0.1) }, // the same photo, a closer face
      { itemId: 'excluded', descriptor: null }, // left out: nothing to match
    ];
    const found = matchPhotos(me, faces);
    expect(found.map((f) => f.itemId)).toEqual(['close']);
    expect(found[0]!.distance).toBeCloseTo(0.1, 6);
    expect(matchPhotos(me, faces, FACES.match.exclude).map((f) => f.itemId)).toEqual(['close', 'edge']);
  });

  it('turns a detector’s faces into what is sent: fractions, the sure and big enough ones, largest first', () => {
    const d = descriptor(5);
    const raw = [
      { x: 100, y: 50, width: 200, height: 220, score: 0.97, descriptor: d },
      { x: 900, y: 600, width: 400, height: 420, score: 0.91, descriptor: d },
      { x: 10, y: 10, width: 20, height: 20, score: 0.99, descriptor: d }, // too small to match
      { x: 500, y: 500, width: 200, height: 200, score: 0.3, descriptor: d }, // unsure
      { x: 1100, y: 800, width: 300, height: 300, score: 0.9, descriptor: d.slice(1) }, // not a descriptor
      { x: -40, y: 700, width: 200, height: 200, score: 0.95, descriptor: new Float32Array(d) }, // off the edge
    ];
    const faces = normalizeFaces(raw, 1200, 900);
    expect(faces).toHaveLength(3);
    // the largest first
    expect(faces[0]!.box[2] * faces[0]!.box[3]).toBeGreaterThan(faces[1]!.box[2] * faces[1]!.box[3]);
    for (const f of faces) {
      const [x, y, w, h] = f.box;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(1.0001);
      expect(y + h).toBeLessThanOrEqual(1.0001);
      expect(f.descriptor).toHaveLength(DESCRIPTOR_LENGTH);
    }
    expect(FacesSchema.safeParse(faces).success).toBe(true);
    expect(normalizeFaces(raw, 0, 900)).toEqual([]);
  });

  it('accepts only real descriptors and boxes inside the photo', () => {
    expect(DescriptorSchema.safeParse(descriptor(1)).success).toBe(true);
    expect(DescriptorSchema.safeParse(descriptor(1).slice(1)).success).toBe(false);
    expect(DescriptorSchema.safeParse([...descriptor(1).slice(1), 7]).success).toBe(false);
    const face = (box: number[]): Face => ({
      box: box as Face['box'],
      score: 0.9,
      descriptor: descriptor(2),
    });
    expect(FacesSchema.safeParse([face([0.1, 0.1, 0.2, 0.2])]).success).toBe(true);
    expect(FacesSchema.safeParse([face([0.9, 0.1, 0.2, 0.2])]).success).toBe(false);
    expect(FacesSchema.safeParse([face([0.1, 0.1, 0, 0.2])]).success).toBe(false);
  });
});

describe('how long face search stays open', () => {
  it('until the data’s erasure, 30 days after the event', () => {
    const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
    expect(faceWindow('2026-09-26', day('2026-09-20'))).toEqual({ open: true, until: '2026-10-26' });
    expect(faceWindow('2026-09-26', day('2026-10-26')).open).toBe(true);
    expect(faceWindow('2026-09-26', day('2026-10-27')).open).toBe(false);
    // across a month and a year
    expect(faceWindow('2026-12-15', day('2027-01-14')).until).toBe('2027-01-14');
    expect(faceWindow(null, NOW)).toEqual({ open: true, until: null });
  });
});

// ─── the API ────────────────────────────────────────────────────────────────────────────────────

function galleryRow(over: Partial<ItemRow> = {}): ItemRow {
  const id = over.id ?? randomUUID();
  return {
    id,
    kind: 'image',
    status: 'published',
    reason: null,
    originalPath: `${INV}/${id}/original.jpg`,
    originalType: 'image/jpeg',
    originalSize: 3_000_000,
    originalDone: true,
    displayPath: `${INV}/${id}/display.jpg`,
    displaySize: 900_000,
    thumbPath: `${INV}/${id}/thumb.jpg`,
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
    completedAt: '2026-09-26T17:00:00.000Z',
    publishedAt: '2026-09-26T17:00:00.000Z',
    updatedAt: '2026-09-26T17:00:00.000Z',
    ...over,
  };
}

function world(opts: { features?: Feature[]; date?: string; code?: string; rate?: boolean } = {}) {
  const link = tokens.newLink('upload', INV);
  const salt = tokens.randomId();
  const lookup: TokenLookup = {
    gallery: {
      invitationId: INV,
      enabled: true,
      mode: 'instant',
      paused: false,
      opensAt: null,
      closesAt: null,
      hasCode: !!opts.code,
      uploadTokenHash: link.hash,
      uploadTokenNonce: link.nonce,
      projectorTokenHash: 'x',
      projectorTokenNonce: 'x',
      channel: 'gallery-channel-unit',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      accessCodeHash: opts.code ? tokens.codeHash(opts.code, salt) : null,
      accessCodeSalt: opts.code ? salt : null,
    },
    invitation: {
      id: INV,
      slug: 'noa-itay',
      status: 'published',
      eventType: 'wedding',
      templateId: 'classic',
      hosts: null,
      date: opts.date ?? '2026-09-26',
      timezone: 'Asia/Jerusalem',
      locales: ['he', 'en'],
      defaultLocale: 'he',
      palette: null,
    },
  };
  const photo = galleryRow();
  const gallery = {
    db: {
      byToken: vi.fn(async (hash: string) => (hash === link.hash ? lookup : null)),
      rateHit: vi.fn(async () => opts.rate ?? true),
    },
    storage: {
      signRead: vi.fn(
        async (_b: string, paths: string[]) => new Map(paths.map((p) => [p, `https://db.test/sign/${p}`])),
      ),
    },
    features: vi.fn(async () => new Set<Feature>(opts.features ?? ['live_gallery', 'face_albums'])),
    now: () => NOW,
  } as unknown as GuestDeps;
  const db = {
    search: vi.fn(async () => [{ ...photo, distance: 0.31 }]),
    leaveOut: vi.fn(async () => ({ excluded: 2 })),
    forget: vi.fn(async () => ({ erased: 3, optouts: 1 })),
    indexUpload: vi.fn(async () => ({ ok: true as const, faces: 2, excluded: 0 })),
  };
  const deps: FaceGuestDeps = { gallery, db };
  return { deps, db, gallery, token: link.token, photo };
}

describe('guests’ face search', () => {
  it('finds the published photos a descriptor matches, signed, with the search threshold', async () => {
    const w = world();
    const d = descriptor(9);
    const res = await api.searchFaces({ t: w.token, descriptor: d }, IP, w.deps);
    expect(res.status).toBe(200);
    expect(w.db.search).toHaveBeenCalledWith(INV, d, FACES.match.search, FACES.match.albumLimit);
    const items = res.body.items as { id: string; display: string }[];
    expect(items.map((i) => i.id)).toEqual([w.photo.id]);
    expect(items[0]!.display).toContain('https://db.test/sign/');
  });

  it('refuses without the feature, after the window, without the code, over the limit, or with a bad body', async () => {
    const d = descriptor(9);
    const off = world({ features: ['live_gallery'] });
    expect(await api.searchFaces({ t: off.token, descriptor: d }, IP, off.deps)).toMatchObject({
      status: 403,
      body: { code: 'feature_off' },
    });
    expect(off.db.search).not.toHaveBeenCalled();
    // no gallery at all (live_gallery off): the gallery is off
    const noGallery = world({ features: ['face_albums'] });
    expect((await api.searchFaces({ t: noGallery.token, descriptor: d }, IP, noGallery.deps)).status).toBe(
      403,
    );
    const late = world({ date: '2026-08-01' });
    expect(await api.searchFaces({ t: late.token, descriptor: d }, IP, late.deps)).toMatchObject({
      status: 410,
      body: { code: 'expired' },
    });
    const coded = world({ code: 'rose-7' });
    expect((await api.searchFaces({ t: coded.token, descriptor: d }, IP, coded.deps)).status).toBe(401);
    expect(
      (await api.searchFaces({ t: coded.token, code: 'ROSE 7', descriptor: d }, IP, coded.deps)).status,
    ).toBe(200);
    const busy = world({ rate: false });
    expect((await api.searchFaces({ t: busy.token, descriptor: d }, IP, busy.deps)).status).toBe(429);
    const w = world();
    expect((await api.searchFaces({ t: w.token, descriptor: d.slice(1) }, IP, w.deps)).status).toBe(400);
    expect((await api.searchFaces({ t: 'nope-nope-nope-nope-nope', descriptor: d }, IP, w.deps)).status).toBe(
      404,
    );
    expect(w.db.search).not.toHaveBeenCalled();
  });

  it('leaving out and forgetting use the wider threshold; forgetting works after the window too', async () => {
    const d = descriptor(4);
    const w = world();
    expect(await api.leaveOut({ t: w.token, descriptor: d }, IP, w.deps)).toMatchObject({
      status: 200,
      body: { excluded: 2 },
    });
    expect(w.db.leaveOut).toHaveBeenCalledWith(INV, d, FACES.match.exclude);
    const late = world({ date: '2026-01-01', features: ['live_gallery'] });
    expect(await api.forget({ t: late.token, descriptor: d }, IP, late.deps)).toMatchObject({
      status: 200,
      body: { erased: 3 },
    });
    expect(late.db.forget).toHaveBeenCalledWith(INV, d, FACES.match.exclude);
    // but leaving out needs search to be open
    expect((await api.leaveOut({ t: late.token, descriptor: d }, IP, late.deps)).status).toBe(403);
  });

  it('the uploading phone sends its photo’s faces under its own device hash', async () => {
    const w = world();
    const faces: Face[] = [{ box: [0.1, 0.1, 0.2, 0.25], score: 0.93, descriptor: descriptor(2) }];
    const id = randomUUID();
    const res = await api.indexUpload({ t: w.token, uploader: 'phone-uploader-0001', id, faces }, IP, w.deps);
    expect(res).toMatchObject({ status: 200, body: { faces: 2 } });
    expect(w.db.indexUpload).toHaveBeenCalledWith(
      INV,
      id,
      tokens.uploaderHash(INV, 'phone-uploader-0001'),
      faces,
      FACES.match.exclude,
    );
    w.db.indexUpload.mockResolvedValueOnce({ ok: false, code: 'not_found' } as never);
    expect(
      (await api.indexUpload({ t: w.token, uploader: 'phone-uploader-0001', id, faces }, IP, w.deps)).status,
    ).toBe(404);
    const off = world({ features: ['live_gallery'] });
    expect(
      (await api.indexUpload({ t: off.token, uploader: 'phone-uploader-0001', id, faces }, IP, off.deps))
        .status,
    ).toBe(403);
  });
});

describe('the host’s face search', () => {
  // the host turned face search on (it never is by default)
  const input = (over: Partial<FeatureInput> = {}): FeatureInput & { ownerId: string } => ({
    ownerId: OWNER,
    plan: 'business',
    admin: false,
    overrides: { ...NO_OVERRIDES, on: ['face_albums'] },
    available: ALL,
    ...over,
  });
  const state = {
    eventDate: '2026-09-26',
    timezone: 'Asia/Jerusalem',
    gallery: true,
    photos: 12,
    scanned: 4,
    faces: 9,
    excluded: 1,
    optouts: 1,
  };
  function host(over: Partial<FeatureInput> = {}, st = state) {
    const db = {
      ownerState: vi.fn(async () => st),
      ownerPending: vi.fn(async () => [
        { id: randomUUID(), displayPath: `${INV}/a/display.jpg`, width: 800, height: 600 },
      ]),
      ownerIndex: vi.fn(async () => ({ done: 1, faces: 2, excluded: 0, invalid: 0 })),
      ownerErase: vi.fn(async () => ({ faces: 9, scans: 4, optouts: 1 })),
    };
    const deps: FaceHostDeps = {
      db,
      storage: {
        signRead: vi.fn(
          async (_b, paths: string[]) => new Map(paths.map((p) => [p, `https://db.test/${p}`])),
        ),
      },
      featureInput: vi.fn(async () => input(over)),
      now: () => NOW,
    };
    return { deps, db };
  }

  it('shows where it stands; the next photos only while it is on, open and has a gallery', async () => {
    const on = host();
    const res = await api.getFaces(OWNER, INV, on.deps);
    expect(res.status).toBe(200);
    expect((res.body.pending as unknown[]).length).toBe(1);
    expect(res.body.view).toMatchObject({
      feature: { on: true },
      window: { open: true, until: '2026-10-26' },
    });
    const plan = host({ plan: 'pro' });
    const r2 = await api.getFaces(OWNER, INV, plan.deps);
    expect(r2.body).toMatchObject({
      view: { feature: { on: false, why: 'plan', plan: 'business' } },
      pending: [],
    });
    expect(plan.db.ownerPending).not.toHaveBeenCalled();
    // not the host's: nothing
    expect((await api.getFaces(randomUUID(), INV, on.deps)).status).toBe(404);
    expect((await api.getFaces(OWNER, 'not-a-uuid', on.deps)).status).toBe(404);
  });

  it('takes what the host’s browser found only while it is on and open', async () => {
    const faces: Face[] = [{ box: [0.1, 0.1, 0.2, 0.25], score: 0.93, descriptor: descriptor(2) }];
    const body = { results: [{ id: randomUUID(), faces }] };
    const on = host();
    expect(await api.postFaces(OWNER, INV, body, on.deps)).toMatchObject({
      status: 200,
      body: { done: 1, faces: 2 },
    });
    expect(on.db.ownerIndex).toHaveBeenCalledWith(INV, OWNER, body.results, FACES.match.exclude);
    const off = host({ overrides: { off: ['face_albums'], grant: [] } });
    expect(await api.postFaces(OWNER, INV, body, off.deps)).toMatchObject({
      status: 403,
      body: { code: 'feature_off', reason: 'switched_off' },
    });
    const late = host({}, { ...state, eventDate: '2026-07-01' });
    expect((await api.postFaces(OWNER, INV, body, late.deps)).status).toBe(410);
    expect((await api.postFaces(OWNER, INV, { results: [] }, on.deps)).status).toBe(400);
  });

  it('erases everything now, whatever the feature says', async () => {
    const off = host({ available: new Set(FEATURES.filter((f) => f !== 'face_albums')) });
    expect(await api.eraseFaces(OWNER, INV, off.deps)).toMatchObject({ status: 200, body: { faces: 9 } });
    expect((await api.eraseFaces(randomUUID(), INV, off.deps)).status).toBe(404);
  });
});

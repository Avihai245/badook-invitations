import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { seedDocument } from '@/features/invitations/templates/seed-document';

/**
 * The AI photos' server side over fake dependencies: the worker (a photo started and stored, started
 * in the background and checked later, refused, retried, nothing to make it from), the guests' API
 * (the feature and the gallery's link, the limits' answers, who is in the photo when the guest chose
 * nobody, the phone's photo re-encoded and stored, adding a finished photo to the gallery as the
 * guest's upload) and the hosts' (the people of honor with their photo, the settings' rules).
 */

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));
const env = {
  INVITES_GALLERY_SECRET: 'unit-gallery-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.test/',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));

const worker = await import('@/features/ai-photos/server/worker');
const guest = await import('@/features/ai-photos/server/guest-api');
const host = await import('@/features/ai-photos/server/host-api');
const tokens = await import('@/features/live-gallery/server/tokens');

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const AVIV = '11111111-1111-4111-8111-111111111111';
const RONI = '22222222-2222-4222-8222-222222222222';
const PHOTO = '33333333-3333-4333-8333-333333333333';
const UPLOADER = 'device-abcdefghijklmnop';
const ALL = new Set<Feature>(FEATURES);

const { manifest, defaults } = TEMPLATES.get('sahar-bordeaux')!;
const doc = seedDocument(manifest, defaults, {
  eventType: 'wedding',
  locales: ['he', 'en'],
  defaultLocale: 'he',
  hosts: { primary: { he: 'אביב', en: 'Aviv' }, secondary: { he: 'רוני', en: 'Roni' } },
  date: '2027-06-17',
  startTime: '19:30',
  endTime: '01:00',
  timezone: 'Asia/Jerusalem',
});

const person = (id: string, role: 'groom' | 'bride', he: string, en: string) => ({
  id,
  seq: 0,
  role,
  name: { he, en },
  description: null,
  photoPath: `${INV}/people/${id}/photo.jpg`,
  updatedAt: '2027-06-01T00:00:00Z',
});

const row = (over: Record<string, unknown> = {}) => ({
  id: PHOTO,
  status: 'queued' as const,
  error: null,
  prompt: 'תוסיף את אביב לתמונה',
  people: [AVIV],
  locale: 'he',
  guestName: 'דנה',
  guestId: null,
  sourcePath: `${INV}/photos/${PHOTO}/source.jpg`,
  resultPath: null,
  thumbPath: null,
  width: null,
  height: null,
  externalId: null,
  attempts: 1,
  galleryItemId: null,
  createdAt: '2027-06-17T18:00:00Z',
  finishedAt: null,
  ...over,
});

// ─── the worker ─────────────────────────────────────────────────────────────────────────────────

function workerDeps(over: Partial<import('@/features/ai-photos/server/worker').WorkerDeps> = {}) {
  const calls: string[] = [];
  const deps: import('@/features/ai-photos/server/worker').WorkerDeps = {
    db: {
      claim: vi.fn(async () => [
        { ...row(), invitationId: INV, document: doc, persons: [person(AVIV, 'groom', 'אביב', 'Aviv')] },
      ]),
      checks: vi.fn(async () => []),
      started: vi.fn(async (id, ext) => (calls.push(`started ${id} ${ext}`), true)),
      done: vi.fn(
        async (id, result, thumb, w, h) => (calls.push(`done ${id} ${result} ${thumb} ${w}x${h}`), true),
      ),
      fail: vi.fn(async (id, status, error) => (calls.push(`fail ${id} ${status} ${error}`), true)),
      retry: vi.fn(async (id, error) => (calls.push(`retry ${id} ${error}`), true)),
    },
    download: vi.fn(async (path: string) => new TextEncoder().encode(`bytes of ${path}`)),
    upload: vi.fn(async (path: string) => void calls.push(`upload ${path}`)),
    start: vi.fn(async () => ({ status: 'done' as const, image: new Uint8Array([1, 2, 3]) })),
    check: vi.fn(async (externalId: string) => ({ status: 'pending' as const, externalId })),
    finish: vi.fn(async () => ({
      result: new Uint8Array([9]),
      thumb: new Uint8Array([8]),
      width: 1024,
      height: 1536,
    })),
    measure: vi.fn(async () => ({ width: 1080, height: 1920 })),
    ...over,
  };
  return { deps, calls };
}

describe('the worker', () => {
  it('starts a queued photo: the guest’s photo first, each person’s, the request; stores the result', async () => {
    const { deps, calls } = workerDeps();
    const out = await worker.processAiPhotos(null, deps);
    expect(out).toMatchObject({ started: 1, done: 1, failed: 0 });
    const req = vi.mocked(deps.start).mock.calls[0]![0];
    expect(req.images.map((i) => i.name)).toEqual(['photo.jpg', 'person-1.jpg']);
    expect(req.size).toBe('1024x1536');
    expect(req.prompt).toContain('Image 2: אביב, the groom.');
    expect(req.prompt).toContain('"""תוסיף את אביב לתמונה"""');
    expect(calls).toEqual([
      `upload ${INV}/photos/${PHOTO}/result.jpg`,
      `upload ${INV}/photos/${PHOTO}/thumb.jpg`,
      `done ${PHOTO} ${INV}/photos/${PHOTO}/result.jpg ${INV}/photos/${PHOTO}/thumb.jpg 1024x1536`,
    ]);
  });

  it('started in the background: its id kept; checked later and stored when done', async () => {
    const { deps, calls } = workerDeps({
      start: vi.fn(async () => ({ status: 'pending' as const, externalId: 'resp_1' })),
    });
    expect(await worker.processAiPhotos(INV, deps)).toMatchObject({ started: 1, pending: 1 });
    expect(calls).toEqual([`started ${PHOTO} resp_1`]);
    const later = workerDeps({
      db: {
        ...deps.db,
        claim: vi.fn(async () => []),
        checks: vi.fn(async () => [
          { ...row({ status: 'running', externalId: 'resp_1' }), invitationId: INV },
        ]),
      },
      check: vi.fn(async () => ({ status: 'done' as const, image: new Uint8Array([1]) })),
    });
    expect(await worker.processAiPhotos(INV, later.deps, { starts: 0 })).toMatchObject({ done: 1 });
    expect(later.deps.db.claim).not.toHaveBeenCalled();
  });

  it('refused by the content rules: blocked; a temporary failure: tried again; nothing to make it from: failed', async () => {
    const blocked = workerDeps({
      start: vi.fn(async () => ({ status: 'blocked' as const, error: 'safety' })),
    });
    await worker.processAiPhotos(null, blocked.deps);
    expect(blocked.calls).toEqual([`fail ${PHOTO} blocked safety`]);
    const busy = workerDeps({
      start: vi.fn(async () => ({ status: 'error' as const, error: '429', retryable: true })),
    });
    await worker.processAiPhotos(null, busy.deps);
    expect(busy.calls).toEqual([`retry ${PHOTO} 429`]);
    const key = workerDeps({
      start: vi.fn(async () => ({ status: 'error' as const, error: '401', retryable: false })),
    });
    await worker.processAiPhotos(null, key.deps);
    expect(key.calls).toEqual([`fail ${PHOTO} failed 401`]);
    const gone = workerDeps({ download: vi.fn(async () => null) });
    await worker.processAiPhotos(null, gone.deps);
    expect(gone.calls).toEqual([`fail ${PHOTO} failed nothing to make it from`]);
    expect(gone.deps.start).not.toHaveBeenCalled();
  });
});

// ─── the guests ─────────────────────────────────────────────────────────────────────────────────

const TOKEN = tokens.deriveToken('upload', INV, 'nonce-nonce-nonce-01');
function guestDeps(
  features: Set<Feature> = ALL,
  over: Partial<import('@/features/ai-photos/server/guest-api').AiGuestDeps> = {},
) {
  const uploads: string[] = [];
  const removed: string[] = [];
  const settings = {
    enabled: true,
    perGuest: 3,
    perEvent: 100,
    toGallery: true,
    consentAt: '2027-06-01T00:00:00Z',
  };
  const deps: import('@/features/ai-photos/server/guest-api').AiGuestDeps = {
    gallery: {
      db: {
        byToken: vi.fn(async () => ({
          gallery: {
            invitationId: INV,
            enabled: true,
            mode: 'instant',
            paused: false,
            opensAt: null,
            closesAt: null,
            hasCode: false,
            uploadTokenHash: tokens.sha256Hex(TOKEN),
            uploadTokenNonce: 'nonce-nonce-nonce-01',
            projectorTokenHash: 'p',
            projectorTokenNonce: 'p',
            channel: 'chan-chan-chan-chan',
            createdAt: '',
            updatedAt: '',
            accessCodeHash: null,
            accessCodeSalt: null,
          },
          invitation: {
            id: INV,
            slug: 'aviv-and-roni',
            status: 'published',
            eventType: 'wedding',
            templateId: 'sahar-bordeaux',
            hosts: null,
            date: '2027-06-17',
            timezone: 'Asia/Jerusalem',
            locales: ['he', 'en'],
            defaultLocale: 'he',
            palette: null,
          },
        })),
        rateHit: vi.fn(async () => true),
        guestByToken: vi.fn(async () => null),
      } as never,
      features: async () => features,
      now: () => Date.parse('2027-06-17T18:00:00Z'),
      swept: vi.fn(async () => undefined),
    } as never,
    db: {
      guestState: vi.fn(async () => ({
        settings,
        people: [
          { id: AVIV, role: 'groom' as const, name: { he: 'אביב', en: 'Aviv' } },
          { id: RONI, role: 'bride' as const, name: { he: 'רוני', en: 'Roni' } },
        ],
        used: { guest: 1, event: 10 },
        mine: [],
      })),
      create: vi.fn(async () => ({ ok: true as const, left: 1 })),
      guestGet: vi.fn(async () =>
        row({
          status: 'done',
          resultPath: `${INV}/photos/${PHOTO}/result.jpg`,
          thumbPath: `${INV}/photos/${PHOTO}/thumb.jpg`,
          width: 1024,
          height: 1536,
        }),
      ),
      guestDelete: vi.fn(async () => true),
      share: vi.fn(async () => ({ ok: true as const, status: 'published' as const, itemId: 'item-1' })),
    },
    signRead: vi.fn(async (_b, paths: string[]) => new Map(paths.map((p) => [p, `https://signed/${p}`]))),
    download: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
    upload: vi.fn(async (bucket, path) => void uploads.push(`${bucket}:${path}`)),
    remove: vi.fn(
      async (bucket, paths: string[]) => void removed.push(...paths.map((p) => `${bucket}:${p}`)),
    ),
    normalize: vi.fn(async (bytes: Uint8Array) => (bytes.length > 2 ? new Uint8Array([7, 7]) : null)),
    thumbnail: vi.fn(async () => new Uint8Array([5])),
    kick: vi.fn(),
    advance: vi.fn(async () => undefined),
    broadcast: vi.fn(async () => undefined),
    dailyLimit: 1000,
    ...over,
  };
  return { deps, uploads, removed };
}

const photoB64 = Buffer.from([1, 2, 3, 4, 5]).toString('base64');

describe('the guests', () => {
  it('the page’s state: the people, what this phone may still make; null when the hosts haven’t turned it on', async () => {
    const { deps } = guestDeps();
    const res = await guest.aiState({ t: TOKEN, uploader: UPLOADER }, null, deps);
    expect(res.status).toBe(200);
    expect(res.body.ai).toMatchObject({ perGuest: 3, left: 2, eventFull: false, toGallery: true });
    const off = guestDeps();
    vi.mocked(off.deps.db.guestState).mockResolvedValueOnce({
      settings: { enabled: false, perGuest: 3, perEvent: 100, toGallery: true, consentAt: null },
      people: [],
      used: { guest: 0, event: 0 },
      mine: [],
    });
    expect((await guest.aiState({ t: TOKEN, uploader: UPLOADER }, null, off.deps)).body.ai).toBeNull();
  });

  it('refused without the feature, or with a link that opens nothing', async () => {
    const noFeature = new Set(FEATURES.filter((f) => f !== 'ai_photos'));
    expect(
      (await guest.aiState({ t: TOKEN, uploader: UPLOADER }, null, guestDeps(noFeature).deps)).status,
    ).toBe(403);
    expect(
      (await guest.aiState({ t: 'not-a-token', uploader: UPLOADER }, null, guestDeps().deps)).status,
    ).toBe(404);
  });

  it('asking for a photo: the phone’s photo stored re-encoded, the request queued, the worker started', async () => {
    const { deps, uploads } = guestDeps();
    const res = await guest.aiCreate(
      {
        t: TOKEN,
        uploader: UPLOADER,
        prompt: 'תוסיף את אביב לתמונה',
        people: [AVIV],
        photo: `data:image/jpeg;base64,${photoB64}`,
        lang: 'he',
        name: 'דנה',
      },
      '1.2.3.4',
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, left: 1 });
    const id = res.body.id as string;
    expect(uploads).toEqual([`ai-photos:${INV}/photos/${id}/source.jpg`]);
    const [inv, hash, guestId, name, photo, daily] = vi.mocked(deps.db.create).mock.calls[0]!;
    expect([inv, guestId, name, daily]).toEqual([INV, null, 'דנה', 1000]);
    expect(hash).toBe(tokens.uploaderHash(INV, UPLOADER));
    expect(photo).toEqual({
      id,
      prompt: 'תוסיף את אביב לתמונה',
      people: [AVIV],
      locale: 'he',
      sourcePath: `${INV}/photos/${id}/source.jpg`,
    });
    expect(deps.kick).toHaveBeenCalledWith(INV);
  });

  it('nobody chosen: the people the words name, else everyone; a new scene stores nothing', async () => {
    const named = guestDeps();
    await guest.aiCreate(
      { t: TOKEN, uploader: UPLOADER, prompt: 'רוני רוקדת', people: [], lang: 'he' },
      null,
      named.deps,
    );
    expect(vi.mocked(named.deps.db.create).mock.calls[0]![4].people).toEqual([RONI]);
    expect(named.uploads).toEqual([]);
    const nobody = guestDeps();
    await guest.aiCreate(
      { t: TOKEN, uploader: UPLOADER, prompt: 'מרימים כוסית', people: [], lang: 'he' },
      null,
      nobody.deps,
    );
    expect(vi.mocked(nobody.deps.db.create).mock.calls[0]![4].people).toEqual([AVIV, RONI]);
  });

  it('the limits’ answers (the photo removed again); not a photo; rate limits', async () => {
    const full = guestDeps();
    vi.mocked(full.deps.db.create).mockResolvedValueOnce({ ok: false, code: 'guest_limit', limit: 3 });
    const res = await guest.aiCreate(
      { t: TOKEN, uploader: UPLOADER, prompt: 'x y', people: [AVIV], photo: photoB64, lang: 'he' },
      null,
      full.deps,
    );
    expect(res).toEqual({ status: 429, body: { ok: false, code: 'guest_limit', limit: 3 } });
    expect(full.removed).toHaveLength(1);
    expect(full.deps.kick).not.toHaveBeenCalled();
    const bad = guestDeps();
    const tiny = Buffer.from([1]).toString('base64');
    expect(
      (
        await guest.aiCreate(
          { t: TOKEN, uploader: UPLOADER, prompt: 'x y', people: [AVIV], photo: tiny, lang: 'he' },
          null,
          bad.deps,
        )
      ).body.code,
    ).toBe('unsupported_type');
    const rate = guestDeps();
    vi.mocked(rate.deps.gallery.db.rateHit).mockResolvedValueOnce(false);
    expect(
      (
        await guest.aiCreate(
          { t: TOKEN, uploader: UPLOADER, prompt: 'x y', people: [AVIV], lang: 'he' },
          null,
          rate.deps,
        )
      ).status,
    ).toBe(429);
  });

  it('a photo working in the background is checked when the page asks; a queued one is started again', async () => {
    const running = guestDeps();
    vi.mocked(running.deps.db.guestGet)
      .mockResolvedValueOnce(row({ status: 'running', externalId: 'resp_1' }))
      .mockResolvedValueOnce(row({ status: 'done', resultPath: 'r', thumbPath: 't' }));
    const res = await guest.aiStatus({ t: TOKEN, uploader: UPLOADER, id: PHOTO }, null, running.deps);
    expect(running.deps.advance).toHaveBeenCalledWith(INV);
    expect(res.body.photo).toMatchObject({
      status: 'done',
      result: 'https://signed/r',
      thumb: 'https://signed/t',
    });
    const queued = guestDeps();
    vi.mocked(queued.deps.db.guestGet).mockResolvedValueOnce(row({ status: 'queued' }));
    await guest.aiStatus({ t: TOKEN, uploader: UPLOADER, id: PHOTO }, null, queued.deps);
    expect(queued.deps.kick).toHaveBeenCalledWith(INV);
  });

  it('into the gallery: the result copied as the guest’s upload, the feed told', async () => {
    const { deps, uploads } = guestDeps();
    const res = await guest.aiShare({ t: TOKEN, uploader: UPLOADER, id: PHOTO }, null, deps);
    expect(res.body).toMatchObject({ ok: true, status: 'published' });
    const item = vi.mocked(deps.db.share).mock.calls[0]![3] as Record<string, unknown>;
    const folder = `${INV}/${item.id}`;
    expect(uploads.sort()).toEqual(
      [
        `gallery-media:${folder}/display.jpg`,
        `gallery-media:${folder}/thumb.jpg`,
        `gallery-originals:${folder}/original.jpg`,
      ].sort(),
    );
    expect(item).toMatchObject({ width: 1024, height: 1536, originalSize: 4, thumbSize: 1 });
    expect(deps.broadcast).toHaveBeenCalledWith('chan-chan-chan-chan', 'items');
    const refused = guestDeps();
    vi.mocked(refused.deps.db.share).mockResolvedValueOnce({ ok: false, code: 'no_gallery' });
    expect(
      (await guest.aiShare({ t: TOKEN, uploader: UPLOADER, id: PHOTO }, null, refused.deps)).status,
    ).toBe(409);
    expect(refused.removed).toHaveLength(3);
  });
});

// ─── the hosts ──────────────────────────────────────────────────────────────────────────────────

function input(features: Feature[] | null = null): FeatureInput & { ownerId: string } {
  return {
    ownerId: OWNER,
    plan: 'business',
    admin: false,
    overrides: NO_OVERRIDES,
    available: new Set(features ?? FEATURES),
  };
}

function hostDeps(features: Feature[] | null = null) {
  const deps: import('@/features/ai-photos/server/host-api').AiHostDeps = {
    db: {
      ownerGet: vi.fn(async () => ({
        slug: 'aviv-and-roni',
        document: doc,
        settings: { enabled: false, perGuest: 3, perEvent: 100, toGallery: true, consentAt: null },
        people: [person(AVIV, 'groom', 'אביב', 'Aviv')],
        counts: { done: 0, used: 0, blocked: 0 },
        gallery: true,
      })),
      ownerSettings: vi.fn(async () => ({ ok: true as const })),
      personSave: vi.fn(async () => person(RONI, 'bride', 'רוני', 'Roni')),
      personDelete: vi.fn(async () => true),
      ownerList: vi.fn(async () => []),
      ownerDelete: vi.fn(async () => 1),
    },
    featureInput: vi.fn(async () => input(features)),
    sign: vi.fn(async (paths: string[]) => new Map(paths.map((p) => [p, `https://signed/${p}`]))),
    upload: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    portrait: vi.fn(async (bytes: Uint8Array) => (bytes.length > 2 ? new Uint8Array([4, 4, 4]) : null)),
    sweep: vi.fn(async () => undefined),
  };
  return deps;
}

describe('the hosts', () => {
  it('the view: the people with their photo, the roles and who the invitation celebrates', async () => {
    const view = await host.aiHostView(OWNER, INV, hostDeps());
    expect(view?.people[0]).toMatchObject({
      id: AVIV,
      photo: `https://signed/${INV}/people/${AVIV}/photo.jpg`,
    });
    expect(view?.roles.slice(0, 2)).toEqual(['groom', 'bride']);
    expect(view?.suggested).toEqual([
      { role: 'partner', name: { he: 'אביב', en: 'Aviv' } },
      { role: 'partner', name: { he: 'רוני', en: 'Roni' } },
    ]);
    expect(await host.aiHostView('someone-else', INV, hostDeps())).toBeNull();
  });

  it('a person with a photo: re-encoded and stored in the invitation’s folder; the empty names dropped', async () => {
    const deps = hostDeps();
    const res = await host.savePerson(
      OWNER,
      INV,
      { role: 'bride', name: { he: 'רוני', en: ' ' }, photo: photoB64 },
      deps,
    );
    expect(res.status).toBe(200);
    const path = vi.mocked(deps.upload).mock.calls[0]![0];
    expect(path).toMatch(new RegExp(`^${INV}/people/[0-9a-f-]{36}/photo\\.jpg$`));
    expect(vi.mocked(deps.db.personSave).mock.calls[0]![2]).toEqual({
      role: 'bride',
      name: { he: 'רוני' },
      photoPath: path,
      photoSize: 3,
    });
    expect(deps.sweep).toHaveBeenCalled();
  });

  it('full: the photo removed again; no name: refused; without the feature: refused', async () => {
    const deps = hostDeps();
    vi.mocked(deps.db.personSave).mockResolvedValueOnce({ error: 'full' });
    expect(
      (await host.savePerson(OWNER, INV, { role: 'bride', name: { he: 'רוני' }, photo: photoB64 }, deps)).body
        .code,
    ).toBe('full');
    expect(deps.remove).toHaveBeenCalled();
    expect((await host.savePerson(OWNER, INV, { role: 'bride', name: { he: ' ' } }, hostDeps())).status).toBe(
      400,
    );
    const off = hostDeps(FEATURES.filter((f) => f !== 'ai_photos'));
    expect((await host.savePerson(OWNER, INV, { role: 'bride', name: { he: 'רוני' } }, off)).status).toBe(
      403,
    );
  });

  it('settings: the database’s rules come back as codes; turning off is always allowed', async () => {
    const deps = hostDeps();
    vi.mocked(deps.db.ownerSettings).mockResolvedValueOnce({ ok: false, code: 'consent' });
    expect(await host.updateAiSettings(OWNER, INV, { enabled: true }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'consent' },
    });
    expect((await host.updateAiSettings(OWNER, INV, { perGuest: 99 }, deps)).status).toBe(400);
    const off = hostDeps(FEATURES.filter((f) => f !== 'ai_photos'));
    expect((await host.updateAiSettings(OWNER, INV, { enabled: true }, off)).status).toBe(403);
    expect((await host.updateAiSettings(OWNER, INV, { enabled: false }, off)).status).toBe(200);
  });
});

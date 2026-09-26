import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { FilmDeps, FilmInvitation } from '@/features/film/server/api';
import { GALLERY } from '@/features/live-gallery/config';
import type { GallerySettings, ItemRow, OwnerGallery } from '@/features/live-gallery/server/db';
import type { GalleryNotifyDeps } from '@/features/live-gallery/server/notices-api';
import type { ClaimedGalleryNotice } from '@/features/live-gallery/server/notices-db';
import type { GalleryStorage } from '@/features/live-gallery/server/storage';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { seedDocument } from '@/features/invitations/templates/seed-document';

/**
 * The highlights film's server side and "send guests the gallery link" over fake dependencies: what
 * the film studio gets (only the host's, photos only with the feature, signed), the film joining the
 * gallery (its type and sizes checked before anything is signed; its files checked in storage; shown
 * to guests only when asked), and the gallery link — the flag, the gallery, credits, the system's
 * number or the host's own, the template's words and button.
 */

vi.mock('server-only', () => ({}));
const env = {
  INVITES_GALLERY_SECRET: 'unit-gallery-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.test/',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'unit-anon-key',
  INVITES_WHATSAPP_TOKEN: 'wa-token',
  INVITES_WHATSAPP_PHONE_NUMBER_ID: '100000000000001',
  INVITES_WHATSAPP_GALLERY_TEMPLATE: 'badook_gallery',
  INVITES_WHATSAPP_TEMPLATE_LANG: 'he',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));

const film = await import('@/features/film/server/api');
const tokens = await import('@/features/live-gallery/server/tokens');
const notices = await import('@/features/live-gallery/server/notices-api');
const notify = await import('@/features/live-gallery/server/notify');

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const NOW = Date.parse('2026-09-27T18:00:00.000Z');
const ALL = new Set<Feature>(FEATURES);

const { manifest, defaults } = TEMPLATES.get('sahar-bordeaux')!;
const doc = seedDocument(manifest, defaults, {
  eventType: 'wedding',
  locales: ['he', 'en'],
  defaultLocale: 'he',
  hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
  date: '2027-06-17',
  startTime: '19:30',
  endTime: '01:00',
  timezone: 'Asia/Jerusalem',
});

const input = (over: Partial<FeatureInput> = {}): FeatureInput & { ownerId: string } => ({
  ownerId: OWNER,
  plan: 'business',
  admin: false,
  overrides: NO_OVERRIDES,
  available: ALL,
  ...over,
});

function gallerySettings(): GallerySettings {
  const link = tokens.newLink('upload', INV);
  const screen = tokens.newLink('projector', INV);
  return {
    invitationId: INV,
    enabled: true,
    mode: 'instant',
    paused: false,
    opensAt: null,
    closesAt: null,
    hasCode: false,
    uploadTokenHash: link.hash,
    uploadTokenNonce: link.nonce,
    projectorTokenHash: screen.hash,
    projectorTokenNonce: screen.nonce,
    channel: 'gallery-channel-unit',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };
}

type FilmRow = ItemRow & { faces: [number, number, number, number][] | null };
function itemRow(over: Partial<FilmRow> = {}): FilmRow {
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
    width: 3000,
    height: 4000,
    durationMs: null,
    takenAt: '2026-09-26T19:00:00.000Z',
    sharpness: 180,
    brightness: 0.5,
    enhanced: false,
    aiNsfw: null,
    aiQuality: 0.8,
    phash: '0f0f0f0f0f0f0f0f',
    name: null,
    guestId: null,
    createdAt: '2026-09-26T19:00:00.000Z',
    completedAt: '2026-09-26T19:00:00.000Z',
    publishedAt: '2026-09-26T19:01:00.000Z',
    updatedAt: '2026-09-26T19:01:00.000Z',
    faces: null,
    ...over,
  };
}

function filmWorld(opts: { input?: Partial<FeatureInput>; gallery?: boolean } = {}) {
  const files = new Map<string, number>();
  const storage: GalleryStorage = {
    signUpload: vi.fn(async (bucket, path) => ({
      path,
      token: `tok.${path}`,
      url: `https://db.test/upload/${bucket}/${path}`,
    })),
    signRead: vi.fn(
      async (bucket, paths: string[]) =>
        new Map(paths.map((p) => [p, `https://db.test/sign/${bucket}/${p}`])),
    ),
    list: vi.fn(async (bucket, folder) =>
      [...files.entries()]
        .filter(([k]) => k.startsWith(`${bucket}:${folder}/`))
        .map(([k, size]) => ({ name: k.slice(`${bucket}:${folder}/`.length), size, type: null })),
    ),
    download: vi.fn(async () => null),
    remove: vi.fn(async () => undefined),
    resumable: () => ({
      endpoint: 'https://db.test/storage/v1/upload/resumable/sign',
      apiKey: 'unit-anon-key',
    }),
  };
  const photo = itemRow({ faces: [[0.4, 0.2, 0.2, 0.15]] });
  const clip = itemRow({ kind: 'video', originalPath: `${INV}/c/original.mp4`, durationMs: 9000 });
  const owned: OwnerGallery = {
    slug: 'noa-itay',
    status: 'published',
    timezone: 'Asia/Jerusalem',
    gallery: opts.gallery === false ? null : gallerySettings(),
    counts: null,
  };
  const invitation: FilmInvitation = {
    slug: 'noa-itay',
    doc,
    palette: manifest.tokens.palette,
    fonts: { display: { he: 'Suez One', en: 'Playfair' }, heading: { he: 'Heebo', en: 'Inter' } },
    musicUrl: 'https://db.test/templates/song.mp3',
  };
  const db = {
    ownerGet: vi.fn(async (_id: string, userId: string) => (userId === OWNER ? owned : null)),
    ownerFilm: vi.fn(async () => [photo, clip]),
    ownerAdd: vi.fn(
      async (): Promise<{ ok: true } | { ok: false; code: 'full' | 'not_found'; left?: number }> => ({
        ok: true,
      }),
    ),
    ownerAddDone: vi.fn(async (_id: string, _o: string, itemId: string, show: boolean) =>
      itemRow({
        id: itemId,
        kind: 'video',
        status: show ? 'published' : 'hidden',
        originalPath: `${INV}/${itemId}/original.mp4`,
      }),
    ),
  };
  const deps: FilmDeps = {
    db,
    storage,
    featureInput: vi.fn(async () => input(opts.input)),
    invitation: vi.fn(async (_id, userId) => (userId === OWNER ? invitation : null)),
    broadcast: vi.fn(async () => true),
    now: () => NOW,
  };
  return { deps, db, storage, files, photo, clip };
}

const reserveBody = (over: Record<string, unknown> = {}) => ({
  step: 'reserve',
  original: { type: 'video/mp4', size: 24_000_000 },
  display: { type: 'image/jpeg', size: 180_000 },
  thumb: { type: 'image/jpeg', size: 30_000 },
  width: 1080,
  height: 1920,
  durationMs: 61_000,
  ...over,
});

describe('the film studio’s view', () => {
  it('gives the host the gallery’s photos and clips, signed, with the invitation’s look and song', async () => {
    const w = filmWorld();
    const view = await film.filmView(OWNER, INV, w.deps);
    expect(view).not.toBeNull();
    expect(view!.feature.on).toBe(true);
    expect(view!.items.map((i) => i.id)).toEqual([w.photo.id, w.clip.id]);
    expect(view!.items[0]!.display).toContain('https://db.test/sign/gallery-media/');
    expect(view!.items[1]!.video).toContain('https://db.test/sign/gallery-originals/');
    expect(view!.items[0]!.faces).toEqual([[0.4, 0.2, 0.2, 0.15]]);
    expect(view!.items[0]!.at).toBe(w.photo.takenAt);
    expect(view!.event).toMatchObject({
      locales: ['he', 'en'],
      defaultLocale: 'he',
      names: { he: 'נועה & איתי', en: 'Noa & Itay' },
      date: '2027-06-17',
    });
    expect(view!.music.url).toBe('https://db.test/templates/song.mp3');
    expect(view!.expiresAt).toBe(NOW + GALLERY.urls.signedTtlSeconds * 1000);
  });

  it('shows the package (and no photos) without the feature; nothing for someone else', async () => {
    const plan = filmWorld({ input: { plan: 'pro' } });
    const view = await film.filmView(OWNER, INV, plan.deps);
    expect(view!.feature).toMatchObject({ on: false, why: 'plan', plan: 'business' });
    expect(view!.items).toEqual([]);
    expect(plan.db.ownerFilm).not.toHaveBeenCalled();
    const w = filmWorld();
    expect(await film.filmView(randomUUID(), INV, w.deps)).toBeNull();
    expect((await film.getFilm(randomUUID(), INV, w.deps)).status).toBe(404);
    expect((await film.getFilm(OWNER, 'nope', w.deps)).status).toBe(404);
    const noGallery = filmWorld({ gallery: false });
    expect((await film.filmView(OWNER, INV, noGallery.deps))!.gallery).toBe(false);
  });
});

describe('the film joins the gallery', () => {
  it('reserves its place and signs its three files (a big film resumably)', async () => {
    const w = filmWorld();
    const res = await film.postFilm(OWNER, INV, reserveBody(), w.deps);
    expect(res.status).toBe(200);
    const item = res.body.item as { id: string; parts: Record<string, { path: string; resumable: unknown }> };
    expect(Object.keys(item.parts).sort()).toEqual(['display', 'original', 'thumb']);
    expect(item.parts.original!.path).toBe(`${INV}/${item.id}/original.mp4`);
    expect(item.parts.original!.resumable).not.toBeNull();
    expect(item.parts.thumb!.resumable).toBeNull();
    const [, , reserved] = w.db.ownerAdd.mock.calls[0]! as unknown as [
      string,
      string,
      { kind: string; durationMs: number },
    ];
    expect(reserved).toMatchObject({ kind: 'video', durationMs: 61_000 });
    // a recorded WebM too
    const webm = await film.postFilm(
      OWNER,
      INV,
      reserveBody({ original: { type: 'video/webm', size: 5_000_000 } }),
      w.deps,
    );
    expect((webm.body.item as { parts: { original: { path: string } } }).parts.original.path).toMatch(
      /original\.webm$/,
    );
  });

  it('refuses what isn’t a film, what is too big, without the feature, and a full gallery', async () => {
    const w = filmWorld();
    expect(
      (await film.postFilm(OWNER, INV, reserveBody({ original: { type: 'image/jpeg', size: 10 } }), w.deps))
        .status,
    ).toBe(400);
    expect(
      (
        await film.postFilm(
          OWNER,
          INV,
          reserveBody({ original: { type: 'video/mp4', size: GALLERY.limits.videoBytes + 1 } }),
          w.deps,
        )
      ).status,
    ).toBe(400);
    expect(
      (await film.postFilm(OWNER, INV, reserveBody({ display: { type: 'image/gif', size: 10 } }), w.deps))
        .status,
    ).toBe(400);
    expect((await film.postFilm(OWNER, INV, reserveBody({ durationMs: 10 * 60_000 }), w.deps)).status).toBe(
      400,
    );
    expect(w.db.ownerAdd).not.toHaveBeenCalled();
    const off = filmWorld({ input: { overrides: { off: ['auto_reel'], grant: [] } } });
    expect(await film.postFilm(OWNER, INV, reserveBody(), off.deps)).toMatchObject({
      status: 403,
      body: { code: 'feature_off', reason: 'switched_off' },
    });
    w.db.ownerAdd.mockResolvedValueOnce({ ok: false, code: 'full', left: 0 });
    expect(await film.postFilm(OWNER, INV, reserveBody(), w.deps)).toMatchObject({
      status: 409,
      body: { code: 'full' },
    });
    expect((await film.postFilm(randomUUID(), INV, reserveBody(), w.deps)).status).toBe(404);
  });

  it('finishes only when its files are in storage, and tells the gallery’s pages', async () => {
    const w = filmWorld();
    const id = randomUUID();
    const folder = `${INV}/${id}`;
    expect(await film.postFilm(OWNER, INV, { step: 'done', id, show: true }, w.deps)).toMatchObject({
      status: 409,
      body: { code: 'missing_files' },
    });
    w.files.set(`gallery-originals:${folder}/original.mp4`, 24_000_000);
    w.files.set(`gallery-media:${folder}/display.jpg`, 180_000);
    w.files.set(`gallery-media:${folder}/thumb.jpg`, 30_000);
    const done = await film.postFilm(OWNER, INV, { step: 'done', id, show: false }, w.deps);
    expect(done).toMatchObject({ status: 200, body: { item: { id, status: 'hidden' } } });
    expect(w.db.ownerAddDone).toHaveBeenCalledWith(INV, OWNER, id, false, {
      original: 24_000_000,
      display: 180_000,
      thumb: 30_000,
    });
    expect(w.deps.broadcast).toHaveBeenCalledWith('gallery-channel-unit', 'items');
    // a file grown past its cap in storage
    w.files.set(`gallery-media:${folder}/thumb.jpg`, GALLERY.limits.thumbBytes + 1);
    expect((await film.postFilm(OWNER, INV, { step: 'done', id, show: true }, w.deps)).status).toBe(400);
    // not the host's own item waiting for its files
    w.files.set(`gallery-media:${folder}/thumb.jpg`, 30_000);
    w.db.ownerAddDone.mockResolvedValueOnce(null as never);
    expect((await film.postFilm(OWNER, INV, { step: 'done', id, show: true }, w.deps)).status).toBe(404);
    expect((await film.postFilm(OWNER, INV, { step: 'done', id: 'x', show: true }, w.deps)).status).toBe(400);
  });
});

// ─── sending guests the gallery link ────────────────────────────────────────────────────────────

function noticesWorld(
  opts: {
    input?: Partial<FeatureInput>;
    ready?: boolean;
    credits?: number;
    admin?: boolean;
    enabled?: boolean;
  } = {},
) {
  const settings = { ...gallerySettings(), enabled: opts.enabled ?? true };
  const db = {
    state: vi.fn(async () => ({ gallery: true, rows: [] })),
    queue: vi.fn(async (_id: string, _o: string, ids: string[]) =>
      (opts.credits ?? 100) < ids.length
        ? { ok: false as const, code: 'credits' as const, needed: ids.length, balance: opts.credits ?? 0 }
        : { ok: true as const, queued: ids.length, balance: 100 - ids.length },
    ),
    mark: vi.fn(async (_id: string, _o: string, ids: string[]) => ids.length),
    pending: vi.fn(async () => 0),
  };
  const deps: GalleryNotifyDeps = {
    db,
    gallery: {
      ownerGet: vi.fn(async () => ({
        slug: 'noa-itay',
        status: 'published' as const,
        timezone: 'Asia/Jerusalem',
        gallery: settings,
        counts: null,
      })),
    },
    featureInput: vi.fn(async () => input({ plan: 'pro', ...opts.input })),
    invitation: vi.fn(async () => ({ hosts: 'נועה & איתי', locale: 'he' as const })),
    ready: () => opts.ready ?? true,
    priceUsd: 0.04,
    send: vi.fn(async () => ({ sent: 2, failed: 0, retried: 0 })),
    account: vi.fn(async () => ({ credits: opts.credits ?? 100, admin: opts.admin ?? false })),
    addCredits: vi.fn(async () => undefined),
  };
  return { deps, db, settings };
}

describe('sending guests the gallery link', () => {
  const guests = [randomUUID(), randomUUID()];

  it('lists every guest with the gallery’s link, while the gallery is on', async () => {
    const w = noticesWorld();
    const res = await notices.galleryNoticesState(OWNER, INV, 'https://invitations.badooks.com', w.deps);
    const token = tokens.linkToken('upload', INV, w.settings.uploadTokenNonce, w.settings.uploadTokenHash);
    expect(res).toMatchObject({
      status: 200,
      body: {
        ready: true,
        link: `https://invitations.badooks.com/e/noa-itay/upload?t=${token}`,
        own: { hosts: 'נועה & איתי' },
      },
    });
    const off = noticesWorld({ enabled: false });
    expect((await notices.galleryNoticesState(OWNER, INV, 'https://x', off.deps)).status).toBe(409);
    const plan = noticesWorld({ input: { plan: 'free' } });
    expect(await notices.galleryNoticesState(OWNER, INV, 'https://x', plan.deps)).toMatchObject({
      status: 403,
      body: { code: 'feature_off', feature: 'live_gallery' },
    });
    expect((await notices.galleryNoticesState(randomUUID(), INV, 'https://x', w.deps)).status).toBe(404);
  });

  it('sends from the system’s number (a credit each), marks what the host sent, and waits for the template', async () => {
    const w = noticesWorld();
    expect(
      await notices.sendGalleryNotices(OWNER, INV, { action: 'send', guestIds: guests }, w.deps),
    ).toMatchObject({
      status: 200,
      body: { queued: 2, sent: 2 },
    });
    expect(w.db.queue).toHaveBeenCalledWith(INV, OWNER, guests, 0.04);
    expect(
      await notices.sendGalleryNotices(
        OWNER,
        INV,
        { action: 'mark', guestIds: [guests[0], guests[0]] },
        w.deps,
      ),
    ).toMatchObject({
      status: 200,
      body: { marked: 1 },
    });
    const notReady = noticesWorld({ ready: false });
    expect(
      (await notices.sendGalleryNotices(OWNER, INV, { action: 'send', guestIds: guests }, notReady.deps))
        .status,
    ).toBe(503);
    // marking needs no template
    expect(
      (await notices.sendGalleryNotices(OWNER, INV, { action: 'mark', guestIds: guests }, notReady.deps))
        .status,
    ).toBe(200);
    const poor = noticesWorld({ credits: 1 });
    expect(
      await notices.sendGalleryNotices(OWNER, INV, { action: 'send', guestIds: guests }, poor.deps),
    ).toMatchObject({
      status: 402,
      body: { code: 'credits', needed: 2, balance: 1 },
    });
    // the platform's admins never run out
    const admin = noticesWorld({ credits: 0, admin: true });
    await notices.sendGalleryNotices(OWNER, INV, { action: 'send', guestIds: guests }, admin.deps);
    expect(admin.deps.addCredits).toHaveBeenCalledWith(OWNER, 2, `gallery:${INV}`);
    expect(
      (await notices.sendGalleryNotices(OWNER, INV, { action: 'send', guestIds: [] }, w.deps)).status,
    ).toBe(400);
  });

  it('the template: the guest’s name, the hosts, and a button to their own gallery link', () => {
    const s = gallerySettings();
    const claimed: ClaimedGalleryNotice = {
      id: randomUUID(),
      invitationId: INV,
      toPhone: '972501234567',
      attempts: 1,
      guestName: 'דנה',
      guestToken: 'GuestToken_0123456789',
      slug: 'noa-itay',
      document: doc,
      uploadTokenHash: s.uploadTokenHash,
      uploadTokenNonce: s.uploadTokenNonce,
    };
    const upload = tokens.linkToken('upload', INV, s.uploadTokenNonce, s.uploadTokenHash)!;
    expect(notify.galleryTemplateReady()).toBe(true);
    expect(notify.galleryNoticeMessage(claimed, doc)).toEqual({
      to: '972501234567',
      template: 'badook_gallery',
      lang: 'he',
      body: ['דנה', 'נועה & איתי'],
      button: `noa-itay/upload?t=${upload}&g=GuestToken_0123456789`,
      ref: claimed.id,
    });
    expect(notify.galleryNoticeMessage({ ...claimed, guestToken: null }, doc)).toBeNull();
    expect(notify.galleryNoticeMessage({ ...claimed, uploadTokenHash: null }, doc)).toBeNull();
  });

  it('the queue: sent, retried when it may help, failed (refunded by the database) otherwise', async () => {
    const s = gallerySettings();
    const make = (over: Partial<ClaimedGalleryNotice> = {}): ClaimedGalleryNotice => ({
      id: randomUUID(),
      invitationId: INV,
      toPhone: '972501234567',
      attempts: 1,
      guestName: 'דנה',
      guestToken: 'GuestToken_0123456789',
      slug: 'noa-itay',
      document: doc,
      uploadTokenHash: s.uploadTokenHash,
      uploadTokenNonce: s.uploadTokenNonce,
      ...over,
    });
    const ok = make();
    const busy = make();
    const bad = make();
    const gone = make({ guestToken: null, document: null });
    const db = {
      claim: vi.fn(async () => [ok, busy, bad, gone]),
      result: vi.fn(async () => undefined),
      requeue: vi.fn(async () => true),
    };
    const send = vi.fn(async (m: { ref: string }) =>
      m.ref === ok.id
        ? { ok: true as const, id: 'wamid.1' }
        : m.ref === busy.id
          ? { ok: false as const, retryable: true, error: 'rate' }
          : { ok: false as const, retryable: false, error: 'invalid_number' },
    );
    const result = await notify.processGalleryNoticeQueue(INV, 25, send as never, db as never);
    expect(result).toEqual({ sent: 1, failed: 2, retried: 1 });
    expect(db.result).toHaveBeenCalledWith(ok.id, 'wamid.1', null);
    expect(db.result).toHaveBeenCalledWith(bad.id, null, 'invalid_number');
    expect(db.result).toHaveBeenCalledWith(gone.id, null, 'no_guest');
    expect(db.requeue).toHaveBeenCalledWith(busy.id, 'rate', expect.any(Number));
  });
});

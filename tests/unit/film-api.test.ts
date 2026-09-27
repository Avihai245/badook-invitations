import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { FilmDeps, FilmInvitation } from '@/features/film/server/api';
import { GALLERY } from '@/features/live-gallery/config';
import type { GallerySettings, ItemRow, OwnerGallery } from '@/features/live-gallery/server/db';
import type { GalleryNotifyDeps } from '@/features/live-gallery/server/notices-api';
import type { ClaimedGalleryNotice, GalleryNoticeRow } from '@/features/live-gallery/server/notices-db';
import type { GalleryStorage } from '@/features/live-gallery/server/storage';
import { scriptFamily } from '@/features/invitations/fonts';
import { resolveFontPair } from '@/features/invitations/renderer/theme';
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
  INVITES_WHATSAPP_TEMPLATE_LANGS: '',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));

const film = await import('@/features/film/server/api');
const filmServer = await import('@/features/film/server/deps');
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

/** The same wedding in five languages, three scripts beyond Hebrew and Latin among them. */
const doc5 = seedDocument(manifest, defaults, {
  eventType: 'wedding',
  locales: ['he', 'en', 'ru', 'ar', 'am'],
  defaultLocale: 'he',
  hosts: {
    primary: { he: 'נועה', en: 'Noa', ru: 'Ноа', ar: 'نوعا', am: 'ኖዓ' },
    secondary: { he: 'איתי', en: 'Itay', ru: 'Итай', ar: 'إيتاي', am: 'ኢታይ' },
  },
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

function filmWorld(opts: { input?: Partial<FeatureInput>; gallery?: boolean; doc?: typeof doc } = {}) {
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
    doc: opts.doc ?? doc,
    palette: manifest.tokens.palette,
    fonts: {
      display: { he: '"Suez One", serif', en: '"Playfair", serif' },
      heading: { he: '"Heebo", sans-serif', en: '"Inter", sans-serif' },
      faces: [],
    },
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

  it('the cards can be in any of the invitation’s languages, each with its names', async () => {
    const view = await film.filmView(OWNER, INV, filmWorld({ doc: doc5 }).deps);
    expect(view!.event).toMatchObject({
      locales: ['he', 'en', 'ru', 'ar', 'am'],
      defaultLocale: 'he',
      names: {
        he: 'נועה & איתי',
        en: 'Noa & Itay',
        ru: 'Ноа & Итай',
        ar: 'نوعا & إيتاي',
        am: 'ኖዓ & ኢታይ',
      },
    });
  });

  it('the cards’ fonts are the invitation’s, for every script, and the page declares them', () => {
    const pair = resolveFontPair(manifest, doc5);
    const fonts = filmServer.filmFonts(manifest, doc5);
    const first = (stack: string | undefined) => /^"([^"]+)"/.exec(stack ?? '')?.[1];
    // each language's own script first: the pair's Hebrew and Latin faces, the design's Arabic and
    // Ethiopic faces, and Russian in the Latin face or its Cyrillic stand-in
    expect(first(fonts.display.he)).toBe(pair.display.hebrew);
    expect(first(fonts.display.en)).toBe(pair.display.latin);
    expect(first(fonts.display.ar)).toBe(scriptFamily(pair.display.latin, 'display', 'arabic'));
    expect(first(fonts.display.am)).toBe(scriptFamily(pair.display.latin, 'display', 'ethiopic'));
    expect(first(fonts.heading.ar)).toBe(scriptFamily(pair.heading.latin, 'heading', 'arabic'));
    expect(first(fonts.display.ru)).toBe(pair.display.latin);
    expect(fonts.display.ru).toContain(
      `"${scriptFamily(pair.display.latin, 'display', 'cyrillic') ?? pair.display.latin}"`,
    );
    // a name in another script keeps a designed face: every stack has the others' faces too
    expect(fonts.display.he).toContain(`"${scriptFamily(pair.display.latin, 'display', 'arabic')}"`);
    // the page declares those faces — the Arabic one in its Arabic letters
    const arabic = scriptFamily(pair.display.latin, 'display', 'arabic')!;
    expect(fonts.faces).toContainEqual({ family: arabic, subsets: ['arabic'] });
    expect(filmServer.filmFontCss(fonts)).toContain(`font-family:'${arabic}'`);
    // a Hebrew and English invitation declares no other script's faces
    expect(filmServer.filmFonts(manifest, doc).faces.map((f) => f.family)).not.toContain(arabic);
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
    rows?: GalleryNoticeRow[];
    languages?: Record<string, string | null>;
  } = {},
) {
  const settings = { ...gallerySettings(), enabled: opts.enabled ?? true };
  const db = {
    state: vi.fn(async () => ({ gallery: true, rows: opts.rows ?? [] })),
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
    invitation: vi.fn(async () => ({
      locale: 'he' as const,
      locales: ['he' as const, 'en' as const],
      hosts: { he: 'נועה & איתי', en: 'Noa & Itay' },
    })),
    guestLanguages: vi.fn(async (): Promise<Record<string, string | null>> => opts.languages ?? {}),
    templateLanguages: () => [
      { locale: 'he' as const, code: 'he' },
      { locale: 'en' as const, code: 'en_US' },
    ],
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

  it('lists every guest with the gallery’s link and their language, while the gallery is on', async () => {
    const row = (guestId: string, name: string): GalleryNoticeRow => ({
      guestId,
      name,
      phone: '+972521111111',
      token: `tok-${name}-0123456789`,
      group: null,
      reach: 'ok',
      last: null,
      queued: false,
    });
    const w = noticesWorld({
      rows: [row(guests[0]!, 'Olga'), row(guests[1]!, 'דנה')],
      // a language the invitation lists and one that isn't a language at all
      languages: { [guests[0]!]: 'ru', [guests[1]!]: 'xx' },
    });
    const res = await notices.galleryNoticesState(OWNER, INV, 'https://invitations.badooks.com', w.deps);
    const token = tokens.linkToken('upload', INV, w.settings.uploadTokenNonce, w.settings.uploadTokenHash);
    expect(res).toMatchObject({
      status: 200,
      body: {
        ready: true,
        link: `https://invitations.badooks.com/e/noa-itay/upload?t=${token}`,
        // the messages in each of the invitation's languages, and the template's languages
        own: { locale: 'he', locales: ['he', 'en'], hosts: { he: 'נועה & איתי', en: 'Noa & Itay' } },
        langs: [
          { locale: 'he', code: 'he' },
          { locale: 'en', code: 'en_US' },
        ],
      },
    });
    const rows = res.body.rows as { name: string; language: string | null }[];
    expect(rows.map((r) => [r.name, r.language])).toEqual([
      ['Olga', 'ru'],
      ['דנה', null],
    ]);
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

  describe('in each guest’s language', () => {
    // the five-language invitation; the template approved in Hebrew, English, Russian and Arabic
    const s = gallerySettings();
    const upload = tokens.linkToken('upload', INV, s.uploadTokenNonce, s.uploadTokenHash)!;
    const claimed = (guestLanguage: string | null, id: string = randomUUID()): ClaimedGalleryNotice => ({
      id,
      invitationId: INV,
      toPhone: '972501234567',
      attempts: 1,
      guestName: 'Guest',
      guestToken: 'GuestToken_0123456789',
      guestLanguage,
      slug: 'noa-itay',
      document: doc5,
      uploadTokenHash: s.uploadTokenHash,
      uploadTokenNonce: s.uploadTokenNonce,
    });
    const button = (lang: string | null) =>
      `noa-itay/upload?t=${upload}&g=GuestToken_0123456789${lang ? `&lang=${lang}` : ''}`;
    const withLanguages = async (list: string, run: () => Promise<void> | void) => {
      env.INVITES_WHATSAPP_TEMPLATE_LANGS = list;
      try {
        await run();
      } finally {
        env.INVITES_WHATSAPP_TEMPLATE_LANGS = '';
      }
    };

    it('the template in their language when it is approved in it, the hosts in it, the gallery opening in it', () =>
      withLanguages('he,en_US,ru,ar', () => {
        expect(notify.galleryNoticeMessage(claimed('ru'), doc5)).toMatchObject({
          lang: 'ru',
          body: ['Guest', 'Ноа & Итай'],
          button: button('ru'),
        });
        // Meta's own code for the language, as configured
        expect(notify.galleryNoticeMessage(claimed('en'), doc5)).toMatchObject({
          lang: 'en_US',
          body: ['Guest', 'Noa & Itay'],
          button: button('en'),
        });
        expect(notify.galleryNoticeMessage(claimed('ar'), doc5)).toMatchObject({
          lang: 'ar',
          body: ['Guest', 'نوعا & إيتاي'],
          button: button('ar'),
        });
        // no language of their own: the invitation's, and its link without a language
        expect(notify.galleryNoticeMessage(claimed(null), doc5)).toMatchObject({
          lang: 'he',
          body: ['Guest', 'נועה & איתי'],
          button: button(null),
        });
        // Amharic has no Meta template: the message in the invitation's language, the gallery in Amharic
        expect(notify.galleryNoticeMessage(claimed('am'), doc5)).toMatchObject({
          lang: 'he',
          body: ['Guest', 'נועה & איתי'],
          button: button('am'),
        });
        // a language the invitation doesn't have (French): the invitation's, all of it
        expect(notify.galleryNoticeMessage(claimed('fr'), doc5)).toMatchObject({
          lang: 'he',
          button: button(null),
        });
      }));

    it('Meta has no template in their language yet (132001): the next language of the chain, at once', () =>
      withLanguages('he,en,ru,ar', async () => {
        const sent: { lang: string; body: string[]; button: string }[] = [];
        const send = vi.fn(async (m: { lang: string; body: string[]; button: string; ref: string }) => {
          sent.push(m);
          return m.lang === 'ar'
            ? ({
                ok: false,
                error: '132001 · Template name does not exist in the translation',
                retryable: false,
              } as const)
            : ({ ok: true, id: `wamid.${m.ref}` } as const);
        });
        const ar = claimed('ar', 'notice-ar');
        const ru = claimed('ru', 'notice-ru');
        const db = {
          claim: vi.fn(async () => [ar, ru]),
          result: vi.fn(async () => undefined),
          requeue: vi.fn(async () => true),
        };
        expect(await notify.processGalleryNoticeQueue(INV, 25, send as never, db as never)).toEqual({
          sent: 2,
          failed: 0,
          retried: 0,
        });
        // Arabic refused → Hebrew (the invitation's): the hosts in Hebrew, the gallery still in Arabic
        expect(sent.filter((m) => m.button === button('ar')).map((m) => [m.lang, m.body[1]])).toEqual([
          ['ar', 'نوعا & إيتاي'],
          ['he', 'נועה & איתי'],
        ]);
        expect(sent.filter((m) => m.button === button('ru')).map((m) => m.lang)).toEqual(['ru']);
        expect(db.result).toHaveBeenCalledWith('notice-ar', 'wamid.notice-ar', null);
        expect(db.result).toHaveBeenCalledWith('notice-ru', 'wamid.notice-ru', null);
        // a refusal in every language fails the message (its credit comes back in the database)
        sent.length = 0;
        const none = vi.fn(async () => ({ ok: false, error: '132001 · no', retryable: false }) as const);
        db.claim.mockResolvedValueOnce([claimed('ar', 'notice-none')]);
        expect(await notify.processGalleryNoticeQueue(INV, 25, none as never, db as never)).toEqual({
          sent: 0,
          failed: 1,
          retried: 0,
        });
        expect(none.mock.calls.map((c) => (c as unknown as [{ lang: string }])[0].lang)).toEqual([
          'ar',
          'he',
          'en',
          'ru',
        ]);
        expect(db.result).toHaveBeenCalledWith('notice-none', null, '132001 · no');
      }));
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

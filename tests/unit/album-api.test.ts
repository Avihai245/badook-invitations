import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { seedDocument } from '@/features/invitations/templates/seed-document';
import type { ItemRow } from '@/features/live-gallery/server/db';

/**
 * The album's server side over fake dependencies: the hosts' view (the album made with its link once
 * the gallery exists and the event has the feature), their settings (checked, the feature's gate), the
 * guests' page (nothing before the morning after; the photos, the cover and the chapters after), fresh
 * links for a page left open; the thank-you to guests (the flag, the album, credits, the template's
 * words and button in the guest's language) and the morning email.
 */

vi.mock('server-only', () => ({}));
const env = {
  INVITES_GALLERY_SECRET: 'unit-gallery-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.test/',
  INVITES_WHATSAPP_TOKEN: 'wa-token',
  INVITES_WHATSAPP_PHONE_NUMBER_ID: '100000000000001',
  INVITES_WHATSAPP_ALBUM_TEMPLATE: 'badook_album',
  INVITES_WHATSAPP_TEMPLATE_LANGS: 'he,en',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));

const api = await import('@/features/album/server/api');
const notices = await import('@/features/album/server/notices-api');
const notify = await import('@/features/album/server/notify');
const ready = await import('@/features/album/server/ready');
const tokens = await import('@/features/live-gallery/server/tokens');

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const GUEST = '7c2e1b4d-3f5a-4b6c-8d7e-9f0a1b2c3d4e';
const BEFORE = Date.parse('2027-06-17T20:00:00Z');
const AFTER = Date.parse('2027-06-18T06:00:00Z');

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

const link = tokens.newLink('album', INV);
const settings = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  opensAt: null,
  title: null,
  message: null,
  coverItemId: null,
  hiddenItems: [],
  showVideos: true,
  chapters: true,
  tokenHash: link.hash,
  tokenNonce: link.nonce,
  readyMailedAt: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});
const owned = (album: ReturnType<typeof settings> | null = settings()) => ({
  slug: 'aviv-and-roni',
  status: 'published' as const,
  document: doc,
  gallery: { enabled: true },
  album,
  counts: { images: 12, videos: 2 },
});

function item(k: number, over: Partial<ItemRow> = {}): ItemRow {
  const id = `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`;
  return {
    id,
    kind: 'image',
    status: 'published',
    reason: 'ok',
    originalPath: `${INV}/${id}/original.jpg`,
    originalType: 'image/jpeg',
    originalSize: 1000,
    originalDone: true,
    displayPath: `${INV}/${id}/display.jpg`,
    displaySize: 500,
    thumbPath: `${INV}/${id}/thumb.jpg`,
    thumbSize: 100,
    width: 1600,
    height: 1200,
    durationMs: null,
    takenAt: new Date(Date.parse('2027-06-17T17:00:00Z') + k * 60_000).toISOString(),
    sharpness: 100,
    brightness: 0.5,
    enhanced: false,
    aiNsfw: null,
    aiQuality: 0.6,
    phash: null,
    name: k === 1 ? 'דנה' : null,
    guestId: null,
    createdAt: '2027-06-17T17:00:00Z',
    completedAt: null,
    publishedAt: '2027-06-17T17:00:00Z',
    updatedAt: '',
    ...over,
  };
}

function input(features: readonly Feature[] = FEATURES): FeatureInput & { ownerId: string } {
  return { ownerId: OWNER, plan: 'pro', admin: false, overrides: NO_OVERRIDES, available: new Set(features) };
}

function deps(
  over: { now?: number; features?: readonly Feature[]; album?: ReturnType<typeof settings> | null } = {},
) {
  const features = over.features ?? FEATURES;
  const d: import('@/features/album/server/api').AlbumDeps = {
    db: {
      ownerGet: vi.fn(async () => owned(over.album === undefined ? settings() : over.album)),
      ownerEnsure: vi.fn(async () => owned()),
      ownerUpdate: vi.fn(async () => owned(settings({ enabled: false }))),
      ownerRotate: vi.fn(async () => owned()),
      ownerItems: vi.fn(async () => [item(1), { ...item(2), hidden: true }]),
      items: vi.fn(async () => Array.from({ length: 3 }, (_, k) => item(k + 1))),
      byToken: vi.fn(async (hash: string) =>
        hash === link.hash
          ? {
              album: settings(over.album ?? {}),
              gallery: { enabled: true },
              invitation: { id: INV, slug: 'aviv-and-roni', status: 'published' as const, document: doc },
            }
          : null,
      ),
      rateHit: vi.fn(async () => true),
    },
    storage: {
      signRead: vi.fn(async (_b, paths: string[]) => new Map(paths.map((p) => [p, `https://signed/${p}`]))),
    },
    featureInput: vi.fn(async () => input(features)),
    features: vi.fn(async () => new Set(features)),
    qr: vi.fn(async (url: string) => ({ svg: `<svg>${url}</svg>`, png: 'data:image/png;base64,' })),
    design: () => ({
      palette: {
        bg: '#fff',
        surface: '#fff',
        ink: '#000',
        inkMuted: '#555',
        accent: '#a00',
        accentInk: '#fff',
        line: '#ddd',
      },
      fonts: { display: { he: 'serif' }, heading: { he: 'sans-serif' } },
      fontCss: '@font-face{}',
    }),
    revalidateInvitation: vi.fn(),
    now: () => over.now ?? AFTER,
    brand: 'Badook',
  };
  return d;
}

describe('the hosts’ album', () => {
  it('is made with its link once the gallery exists and the event has the feature', async () => {
    const d = deps({ album: null });
    const view = await api.albumHostView(OWNER, INV, 'https://site.test', d);
    expect(d.db.ownerEnsure).toHaveBeenCalledWith(
      INV,
      OWNER,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(String),
    );
    expect(view?.album?.url).toMatch(/^https:\/\/site\.test\/e\/aviv-and-roni\/album\?a=[A-Za-z0-9_-]{24}$/);
    expect(view?.event.phrase).toEqual({ he: 'בחתונה שלנו', en: 'at our wedding' });
    // not without the feature
    const off = deps({ album: null, features: FEATURES.filter((f) => f !== 'album') });
    expect((await api.albumHostView(OWNER, INV, 'https://site.test', off))?.album).toBeNull();
    expect(off.db.ownerEnsure).not.toHaveBeenCalled();
    expect(await api.albumHostView('someone-else', INV, 'https://site.test', deps())).toBeNull();
  });

  it('opens the morning after (08:00 Israel = 05:00 UTC), soon until then', async () => {
    const view = await api.albumHostView(OWNER, INV, 'https://site.test', deps({ now: BEFORE }));
    expect(view?.album).toMatchObject({ state: 'soon', opensAt: '2027-06-18T05:00:00.000Z', custom: false });
    expect((await api.albumHostView(OWNER, INV, 'https://site.test', deps()))?.album?.state).toBe('open');
  });

  it('settings: checked, empty words cleaned; the invitation’s page refreshed when it opens or closes', async () => {
    const d = deps();
    const res = await api.updateAlbum(
      OWNER,
      INV,
      { enabled: false, title: { he: '  ', en: 'Our day' } },
      'https://s',
      d,
    );
    expect(res.status).toBe(200);
    expect(d.db.ownerUpdate).toHaveBeenCalledWith(INV, OWNER, { enabled: false, title: { en: 'Our day' } });
    expect(d.revalidateInvitation).toHaveBeenCalledWith('aviv-and-roni');
    expect((await api.updateAlbum(OWNER, INV, { nonsense: 1 }, 'https://s', deps())).status).toBe(400);
    expect((await api.updateAlbum(OWNER, INV, {}, 'https://s', deps())).status).toBe(400);
    const off = deps({ features: FEATURES.filter((f) => f !== 'album') });
    expect((await api.updateAlbum(OWNER, INV, { enabled: true }, 'https://s', off)).body.code).toBe(
      'feature_off',
    );
  });

  it('the studio: every photo with whether it is left out, and the layout without them', async () => {
    const res = await api.albumStudio(OWNER, INV, deps());
    const items = res.body.items as { id: string; hidden: boolean }[];
    expect(items.map((i) => i.hidden)).toEqual([false, true]);
    expect((res.body.layout as { chapters: { ids: string[] }[] }).chapters.flatMap((c) => c.ids)).toEqual([
      item(1).id,
    ]);
  });
});

describe('the guests’ album', () => {
  const token = tokens.linkToken('album', INV, link.nonce, link.hash)!;

  it('before the morning after: the cover and when it opens, no photos fetched', async () => {
    const d = deps({ now: BEFORE });
    const page = await api.albumPage(token, d);
    expect(page).toMatchObject({ state: 'soon', opensAt: '2027-06-18T05:00:00.000Z', items: [] });
    expect(d.db.items).not.toHaveBeenCalled();
  });

  it('after: the photos with short-lived links, the cover, the chapters, the design', async () => {
    const page = await api.albumPage(token, deps());
    expect(page?.state).toBe('open');
    expect(page?.items).toHaveLength(3);
    expect(page?.items[0]).toMatchObject({ name: 'דנה', thumb: `https://signed/${item(1).thumbPath}` });
    expect(page?.layout.cover).toBeTruthy();
    expect(page?.layout.chapters.flatMap((c) => c.ids)).toHaveLength(3);
    expect(page?.event.names).toEqual({ he: 'אביב & רוני', en: 'Aviv & Roni' });
    expect(page?.fontCss).toBe('@font-face{}');
  });

  it('a wrong link, an album that is off or without the feature', async () => {
    expect(await api.albumPage('A'.repeat(24), deps())).toBeNull();
    expect((await api.albumPage(token, deps({ album: settings({ enabled: false }) })))?.state).toBe('off');
    expect(
      (await api.albumPage(token, deps({ features: FEATURES.filter((f) => f !== 'album') })))?.state,
    ).toBe('off');
  });

  it('fresh links for a page left open — only when open, within the rate limit', async () => {
    expect((await api.albumRefresh({ a: token }, '1.1.1.1', deps())).status).toBe(200);
    expect((await api.albumRefresh({ a: token }, '1.1.1.1', deps({ now: BEFORE }))).body.code).toBe('soon');
    const rate = deps();
    vi.mocked(rate.db.rateHit).mockResolvedValueOnce(false);
    expect((await api.albumRefresh({ a: token }, '1.1.1.1', rate)).status).toBe(429);
  });
});

describe('the thank-you to guests', () => {
  function notifyDeps(features: readonly Feature[] = FEATURES) {
    const d: import('@/features/album/server/notices-api').AlbumNotifyDeps = {
      db: {
        state: vi.fn(async () => ({
          album: true,
          rows: [
            {
              guestId: GUEST,
              name: 'דנה',
              phone: '+972501234567',
              token: 'g'.repeat(20),
              group: null,
              reach: 'ok' as const,
              last: null,
              queued: false,
            },
          ],
        })),
        queue: vi.fn(async () => ({ ok: true as const, queued: 1, balance: 9 })),
        mark: vi.fn(async () => 1),
        pending: vi.fn(async () => 0),
      },
      album: { ownerGet: vi.fn(async () => owned()) },
      featureInput: vi.fn(async () => input(features)),
      invitation: vi.fn(async () => ({
        locale: 'he' as const,
        locales: ['he' as const, 'en' as const],
        hosts: { he: 'אביב & רוני', en: 'Aviv & Roni' },
        phrase: { he: 'בחתונה שלנו', en: 'at our wedding' },
      })),
      guestLanguages: vi.fn(async () => ({ [GUEST]: 'en' })),
      templateLanguages: () => [
        { locale: 'he' as const, code: 'he' },
        { locale: 'en' as const, code: 'en' },
      ],
      ready: () => true,
      priceUsd: 0.0353,
      send: vi.fn(async () => ({ sent: 1, failed: 0, retried: 0 })),
      account: vi.fn(async () => ({ credits: 10, admin: false })),
      addCredits: vi.fn(async () => undefined),
    };
    return d;
  }

  it('the dialog: every guest with their language, the album’s link', async () => {
    const res = await notices.albumNoticesState(OWNER, INV, 'https://site.test', notifyDeps());
    expect(res.status).toBe(200);
    expect(res.body.link).toMatch(/^https:\/\/site\.test\/e\/aviv-and-roni\/album\?a=/);
    expect((res.body.rows as { language: string }[])[0]!.language).toBe('en');
    expect((res.body.own as { phrase: unknown }).phrase).toEqual({ he: 'בחתונה שלנו', en: 'at our wedding' });
  });

  it('send: queued (a credit each) and the first batch sent; without the feature: refused', async () => {
    const d = notifyDeps();
    const res = await notices.sendAlbumNotices(OWNER, INV, { action: 'send', guestIds: [GUEST] }, d);
    expect(res.body).toMatchObject({ ok: true, queued: 1, sent: 1 });
    expect(d.db.queue).toHaveBeenCalledWith(INV, OWNER, [GUEST], 0.0353);
    const off = await notices.sendAlbumNotices(
      OWNER,
      INV,
      { action: 'send', guestIds: [GUEST] },
      notifyDeps(FEATURES.filter((f) => f !== 'album')),
    );
    expect(off.body.code).toBe('feature_off');
  });

  it('the template: the guest, where they celebrated and the hosts in the guest’s language; the button opens the album in it', async () => {
    const claimed = {
      id: 'n1',
      invitationId: INV,
      toPhone: '+972501234567',
      attempts: 1,
      guestName: 'Dana',
      guestToken: 'g'.repeat(20),
      guestLanguage: 'en',
      slug: 'aviv-and-roni',
      document: doc,
      albumTokenHash: link.hash,
      albumTokenNonce: link.nonce,
      albumEnabled: true,
    };
    const sent: unknown[] = [];
    const db = {
      claim: vi.fn(async () => [claimed]),
      result: vi.fn(async () => undefined),
      requeue: vi.fn(async () => true),
    };
    const out = await notify.processAlbumNoticeQueue(
      INV,
      10,
      async (m) => (sent.push(m), { ok: true, id: 'wamid.1' }),
      db,
      () => true,
    );
    expect(out).toEqual({ sent: 1, failed: 0, retried: 0 });
    const token = tokens.linkToken('album', INV, link.nonce, link.hash);
    expect(sent[0]).toEqual({
      to: '+972501234567',
      template: 'badook_album',
      lang: 'en',
      body: ['Dana', 'at our wedding', 'Aviv & Roni'],
      button: `aviv-and-roni/album?a=${token}&lang=en`,
      ref: 'n1',
    });
    expect(db.result).toHaveBeenCalledWith('n1', 'wamid.1', null);
    // the album went: nothing to link to (refunded by the database)
    const gone = {
      ...db,
      claim: vi.fn(async () => [{ ...claimed, albumEnabled: false }]),
      result: vi.fn(async () => undefined),
    };
    await notify.processAlbumNoticeQueue(
      INV,
      10,
      async () => ({ ok: true, id: 'x' }),
      gone,
      () => true,
    );
    expect(gone.result).toHaveBeenCalledWith('n1', null, 'no_album');
  });
});

describe('the morning email', () => {
  const candidate = (over: Record<string, unknown> = {}) => ({
    invitationId: INV,
    ownerId: OWNER,
    email: 'host@example.com',
    slug: 'aviv-and-roni',
    document: doc,
    album: null,
    photos: 120,
    ...over,
  });
  function readyDeps(list: unknown[]) {
    const sent: { to: string; subject: string; text: string }[] = [];
    const d: import('@/features/album/server/ready').ReadyDeps = {
      db: {
        readyCandidates: vi.fn(async () => list as never),
        readyMark: vi.fn(async () => true),
        ownerEnsure: vi.fn(async () => owned()),
      },
      hasAlbum: vi.fn(async () => true),
      send: vi.fn(async (e) => (sent.push(e), true)),
      base: 'https://site.test',
      brand: 'Badook',
    };
    return { d, sent };
  }

  it('the morning after: the album made if needed, one email with its link, marked', async () => {
    const { d, sent } = readyDeps([candidate()]);
    const out = await ready.sendAlbumReadyEmails(new Date(AFTER), d);
    expect(out).toEqual({ checked: 1, sent: 1 });
    expect(d.db.ownerEnsure).toHaveBeenCalled();
    expect(sent[0]!.to).toBe('host@example.com');
    expect(sent[0]!.subject).toContain('אביב & רוני');
    expect(sent[0]!.text).toMatch(/https:\/\/site\.test\/e\/aviv-and-roni\/album\?a=/);
    expect(sent[0]!.text).toContain(`https://site.test/app/invitations/${INV}/gallery/album`);
    expect(d.db.readyMark).toHaveBeenCalledWith(INV);
  });

  it('not yet: before it opens, without the feature, an album that is off', async () => {
    const early = readyDeps([candidate()]);
    expect((await ready.sendAlbumReadyEmails(new Date(BEFORE), early.d)).sent).toBe(0);
    const noFeature = readyDeps([candidate()]);
    vi.mocked(noFeature.d.hasAlbum).mockResolvedValue(false);
    expect((await ready.sendAlbumReadyEmails(new Date(AFTER), noFeature.d)).sent).toBe(0);
    const off = readyDeps([candidate({ album: settings({ enabled: false }) })]);
    expect((await ready.sendAlbumReadyEmails(new Date(AFTER), off.d)).sent).toBe(0);
    expect(off.d.db.readyMark).not.toHaveBeenCalled();
  });
});

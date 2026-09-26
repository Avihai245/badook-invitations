import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The live gallery (supabase/migrations/*_live_gallery.sql): galleries found by their links' hashes,
// items reserved under a per-event cap, completed with their checks, the feed and what changed, the
// host's decisions, deleted files queued for storage, housekeeping — and nothing for anyone but the
// service role.

const OWNER = '55555555-5555-4555-8555-555555555551';
const OTHER = '55555555-5555-4555-8555-555555555552';
const hex = (c: string) => c.repeat(64);
const UPLOADER = hex('c');
const SOMEONE = hex('d');

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let otherInv: string;

async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}

const links = (u: string, p: string, ch: string) => [
  hex(u),
  `nonce-${u}-0123456789ab`,
  hex(p),
  `nonce-${p}-0123456789ab`,
  `chan-${ch}-0123456789abcdef`,
];

function item(invitation: string, overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const folder = `${invitation}/${id}`;
  return {
    id,
    kind: 'image',
    originalPath: `${folder}/original.jpg`,
    originalType: 'image/jpeg',
    originalSize: 3_000_000,
    displayPath: `${folder}/display.jpg`,
    displaySize: 900_000,
    thumbPath: `${folder}/thumb.jpg`,
    thumbSize: 40_000,
    width: 4000,
    height: 3000,
    durationMs: null,
    takenAt: '2027-06-17T18:30:00Z',
    ...overrides,
  };
}

async function reserve(
  items: Record<string, unknown>[],
  uploader = UPLOADER,
  max = 3000,
  name: string | null = 'דנה',
) {
  return commit<{ ok: boolean; code?: string; left?: number }>('gallery_reserve', [
    inv,
    uploader,
    null,
    name,
    JSON.stringify(items),
    max,
  ]);
}

async function complete(
  id: string,
  status: string | null,
  extra: Partial<{
    metrics: object;
    checks: object[];
    sizes: object;
    originalDone: boolean;
    uploader: string;
    reason: string;
  }> = {},
) {
  return commit<{ status: string; reason: string | null; originalDone: boolean; first: boolean } | null>(
    'gallery_complete',
    [
      inv,
      id,
      extra.uploader ?? UPLOADER,
      status,
      extra.reason ?? (status ? 'ok' : null),
      JSON.stringify(extra.metrics ?? {}),
      JSON.stringify(extra.checks ?? []),
      JSON.stringify(extra.sizes ?? {}),
      extra.originalDone ?? false,
    ],
  );
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'gallery-owner@example.com'), ($2, 'other@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [
      OWNER,
      'sahar-bordeaux',
      'wedding',
      'gallery-test',
      doc,
    ])
  ).id;
  otherInv = (
    await commit<{ id: string }>('create_invitation', [
      OTHER,
      'sahar-bordeaux',
      'wedding',
      'gallery-other',
      doc,
    ])
  ).id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('galleries', () => {
  it('the host turns it on (once: the links stay), nobody else can', async () => {
    expect(await commit('gallery_owner_get', [inv, OWNER])).toMatchObject({
      slug: 'gallery-test',
      status: 'draft',
      gallery: null,
      counts: null,
    });
    expect(await commit('gallery_owner_create', [inv, OTHER, ...links('a', 'b', 'x')])).toBeNull();
    const created = await commit<{ gallery: Record<string, unknown>; counts: Record<string, number> }>(
      'gallery_owner_create',
      [inv, OWNER, ...links('a', 'b', 'x')],
    );
    expect(created.gallery).toMatchObject({
      enabled: true,
      mode: 'instant',
      paused: false,
      hasCode: false,
      uploadTokenHash: hex('a'),
      projectorTokenHash: hex('b'),
      channel: 'chan-x-0123456789abcdef',
    });
    expect(created.counts).toMatchObject({ total: 0, pending: 0, uploaders: 0 });
    // off, then on again: the same links
    await commit('gallery_owner_update', [inv, OWNER, JSON.stringify({ enabled: false })]);
    const again = await commit<{ gallery: Record<string, unknown> }>('gallery_owner_create', [
      inv,
      OWNER,
      ...links('e', 'f', 'y'),
    ]);
    expect(again.gallery).toMatchObject({ enabled: true, uploadTokenHash: hex('a') });
    expect(await commit('gallery_owner_get', [inv, OTHER])).toBeNull();
  });

  it('a link finds its gallery by hash and kind, with what the pages show', async () => {
    const found = await call<{ gallery: Record<string, unknown>; invitation: Record<string, unknown> }>(
      'gallery_by_token',
      [hex('a'), 'upload'],
    );
    expect(found.invitation).toMatchObject({
      id: inv,
      slug: 'gallery-test',
      status: 'draft',
      templateId: 'sahar-bordeaux',
    });
    expect(found.invitation.hosts).toBeTruthy();
    expect(found.gallery).toMatchObject({ accessCodeHash: null, accessCodeSalt: null });
    expect(await call('gallery_by_token', [hex('b'), 'projector'])).toMatchObject({
      invitation: { id: inv },
    });
    // the projector's link doesn't open the upload page, and the other way round
    expect(await call('gallery_by_token', [hex('b'), 'upload'])).toBeNull();
    expect(await call('gallery_by_token', [hex('a'), 'projector'])).toBeNull();
    expect(await call('gallery_by_token', [hex('9'), 'upload'])).toBeNull();
    expect(await call('gallery_slug_locale', ['gallery-test'])).toMatchObject({ defaultLocale: 'he' });
    expect(await call('gallery_slug_locale', ['gallery-other'])).toBeNull();
  });

  it('settings: only what is sent changes; the window and the code stay consistent', async () => {
    const updated = await commit<{ gallery: Record<string, unknown> }>('gallery_owner_update', [
      inv,
      OWNER,
      JSON.stringify({
        mode: 'approval',
        paused: true,
        opensAt: '2027-06-17T16:00:00Z',
        closesAt: '2027-06-18T02:00:00Z',
        accessCode: { hash: hex('1'), salt: 'salt-0123456789abcdef' },
      }),
    ]);
    expect(updated.gallery).toMatchObject({
      mode: 'approval',
      paused: true,
      hasCode: true,
      opensAt: '2027-06-17T16:00:00+00:00',
      closesAt: '2027-06-18T02:00:00+00:00',
    });
    const found = await call<{ gallery: Record<string, unknown> }>('gallery_by_token', [hex('a'), 'upload']);
    expect(found.gallery).toMatchObject({
      accessCodeHash: hex('1'),
      accessCodeSalt: 'salt-0123456789abcdef',
    });
    // closing before opening, an unknown mode: refused
    await expect(
      call('gallery_owner_update', [inv, OWNER, JSON.stringify({ closesAt: '2027-06-17T10:00:00Z' })]),
    ).rejects.toThrow(/check/);
    await expect(
      call('gallery_owner_update', [inv, OWNER, JSON.stringify({ mode: 'sometimes' })]),
    ).rejects.toThrow(/check/);
    const back = await commit<{ gallery: Record<string, unknown> }>('gallery_owner_update', [
      inv,
      OWNER,
      JSON.stringify({ mode: 'instant', paused: false, opensAt: null, closesAt: null, accessCode: null }),
    ]);
    expect(back.gallery).toMatchObject({
      mode: 'instant',
      paused: false,
      opensAt: null,
      closesAt: null,
      hasCode: false,
    });
    expect(await commit('gallery_owner_update', [inv, OTHER, JSON.stringify({ paused: true })])).toBeNull();
  });

  it('a new link retires the old one (and the channel changes)', async () => {
    const rotated = await call<{ gallery: Record<string, unknown> }>('gallery_owner_rotate', [
      inv,
      OWNER,
      'upload',
      hex('2'),
      'nonce-2-0123456789abcd',
      'chan-z-0123456789abcdef',
    ]);
    expect(rotated.gallery).toMatchObject({
      uploadTokenHash: hex('2'),
      projectorTokenHash: hex('b'),
      channel: 'chan-z-0123456789abcdef',
    });
    await expect(
      call('gallery_owner_rotate', [
        inv,
        OWNER,
        'admin',
        hex('2'),
        'nonce-2-0123456789abcd',
        'chan-z-0123456789abcdef',
      ]),
    ).rejects.toThrow(/bad link kind/);
    expect(
      await call('gallery_owner_rotate', [
        inv,
        OTHER,
        'upload',
        hex('3'),
        'nonce-3-0123456789abcd',
        'chan-w-0123456789abcdef',
      ]),
    ).toBeNull();
  });
});

describe('items', () => {
  let a: ReturnType<typeof item>;
  let b: ReturnType<typeof item>;

  it('reserving: inside the item’s own folder only, and never past the event’s cap', async () => {
    a = item(inv);
    b = item(inv, { kind: 'video', originalType: 'video/mp4', originalPath: undefined });
    b.originalPath = `${inv}/${b.id}/original.mp4`;
    expect(await reserve([a, b])).toEqual({ ok: true });
    expect(
      await call('gallery_reserve', [inv, UPLOADER, null, null, JSON.stringify([item(inv), item(inv)]), 3]),
    ).toEqual({
      ok: false,
      code: 'full',
      left: 1,
    });
    const stray = item(inv);
    stray.originalPath = `${otherInv}/${stray.id}/original.jpg`;
    await expect(
      call('gallery_reserve', [inv, UPLOADER, null, null, JSON.stringify([stray]), 10]),
    ).rejects.toThrow(/check/);
    // a guest of another invitation isn't taken
    await c.query(
      `insert into invitation_guests (invitation_id, name, token) values ($1, 'אורח זר', 'stranger-token-0123456789')`,
      [otherInv],
    );
    const stranger = (
      await c.query(`select id from invitation_guests where token = 'stranger-token-0123456789'`)
    ).rows[0].id;
    const c1 = item(inv);
    expect(
      await commit('gallery_reserve', [inv, UPLOADER, stranger, null, JSON.stringify([c1]), 10]),
    ).toEqual({ ok: true });
    expect(
      (await c.query(`select guest_id from gallery_items where id = $1`, [c1.id])).rows[0].guest_id,
    ).toBeNull();
    expect(await call('gallery_uploader_items', [inv, UPLOADER])).toHaveLength(3);
  });

  it('only this device sees its item; the nearest hash distance comes with it', async () => {
    expect(await call('gallery_item_for_uploader', [inv, a.id, SOMEONE, null])).toBeNull();
    const own = await call<Record<string, unknown>>('gallery_item_for_uploader', [
      inv,
      a.id,
      UPLOADER,
      'ffffffffffffffff',
    ]);
    expect(own).toMatchObject({ id: a.id, status: 'uploading', nearest: null, name: 'דנה' });
  });

  it('completing records the outcome, the scores and every check — once', async () => {
    const first = await complete(a.id, 'published', {
      metrics: {
        sharpness: 142.5,
        brightness: 0.46,
        phash: '0f0f0f0f0f0f0f0f',
        enhanced: true,
        aiNsfw: 0.02,
        aiQuality: 0.9,
      },
      checks: [
        { check: 'blur', result: 'pass', score: 142.5, decidedBy: 'browser' },
        {
          check: 'ai',
          result: 'pass',
          score: 0.02,
          detail: { quality: 0.9, reason: 'guests dancing' },
          decidedBy: 'ai',
        },
        { check: 'mode', result: 'published', detail: { mode: 'instant' }, decidedBy: 'server' },
      ],
      sizes: { display: 880_000, thumb: 39_000 },
    });
    expect(first).toEqual({ status: 'published', reason: 'ok', originalDone: false, first: true });
    const row = (await c.query(`select * from gallery_items where id = $1`, [a.id])).rows[0];
    expect(row).toMatchObject({
      sharpness: 142.5,
      phash: '0f0f0f0f0f0f0f0f',
      enhanced: true,
      display_size: 880000,
      original_done: false,
    });
    expect(row.published_at).toBeTruthy();
    expect(
      (
        await c.query(`select check_name, result from gallery_moderation where item_id = $1 order by id`, [
          a.id,
        ])
      ).rows,
    ).toEqual([
      { check_name: 'blur', result: 'pass' },
      { check_name: 'ai', result: 'pass' },
      { check_name: 'mode', result: 'published' },
    ]);
    // again: nothing changes but the original arriving
    expect(await complete(a.id, 'rejected')).toMatchObject({
      status: 'published',
      first: false,
      originalDone: false,
    });
    expect(await complete(a.id, null, { originalDone: true, sizes: { original: 3_100_000 } })).toMatchObject({
      status: 'published',
      originalDone: true,
    });
    expect(
      (await c.query(`select original_size from gallery_items where id = $1`, [a.id])).rows[0].original_size,
    ).toBe('3100000');
    expect(await complete(a.id, 'published', { uploader: SOMEONE })).toBeNull();
    await expect(complete(b.id, 'hidden')).rejects.toThrow(/bad status/);
    // the same photo again is 2 bits from the first
    expect(await call('gallery_item_for_uploader', [inv, b.id, UPLOADER, '0f0f0f0f0f0f0f0c'])).toMatchObject({
      nearest: 2,
    });
    expect(await complete(b.id, 'pending', { reason: 'approval', originalDone: true })).toMatchObject({
      status: 'pending',
      originalDone: true,
    });
  });

  it('the feed has what is published, newest first; what changed since says what came and went', async () => {
    const since = (await c.query(`select now() - interval '1 minute' as t`)).rows[0].t.toISOString();
    const feed = await call<Record<string, unknown>[]>('gallery_feed', [inv, null, null, 30]);
    expect(feed.map((i) => i.id)).toEqual([a.id]);
    expect(await call('gallery_changes', [inv, since, 50])).toMatchObject({
      added: [{ id: a.id }],
      removed: [],
    });
    // the host approves the video, then hides the photo
    expect(await commit('gallery_owner_moderate', [inv, OWNER, [b.id], 'publish'])).toEqual({
      count: 1,
      ids: [b.id],
    });
    expect(await commit('gallery_owner_moderate', [inv, OWNER, [a.id], 'hide'])).toEqual({
      count: 1,
      ids: [a.id],
    });
    const changes = await call<{ added: { id: string }[]; removed: string[] }>('gallery_changes', [
      inv,
      since,
      50,
    ]);
    expect(changes.added.map((i) => i.id)).toEqual([b.id]);
    expect(changes.removed).toEqual([a.id]);
    expect(
      (await call<Record<string, unknown>[]>('gallery_feed', [inv, null, null, 30])).map((i) => i.id),
    ).toEqual([b.id]);
    const decisions = (
      await c.query(
        `select check_name, result, decided_by, actor_id from gallery_moderation where item_id = $1 and check_name = 'host'`,
        [a.id],
      )
    ).rows;
    expect(decisions).toEqual([
      { check_name: 'host', result: 'hidden', decided_by: 'host', actor_id: OWNER },
    ]);
  });

  it('the host’s list: finished items by status, with counts; nobody else’s', async () => {
    expect(
      (await call<Record<string, unknown>[]>('gallery_owner_items', [inv, OWNER, 'all', null, null, 60]))
        .map((i) => i.status)
        .sort(),
    ).toEqual(['hidden', 'published']);
    expect(await call('gallery_owner_items', [inv, OWNER, 'hidden', null, null, 60])).toMatchObject([
      { id: a.id, reason: 'host', name: 'דנה' },
    ]);
    expect(await call('gallery_owner_items', [inv, OTHER, 'all', null, null, 60])).toBeNull();
    expect(await call('gallery_owner_moderate', [inv, OTHER, [a.id], 'delete'])).toBeNull();
    const owned = await call<{ counts: Record<string, number> }>('gallery_owner_get', [inv, OWNER]);
    expect(owned.counts).toMatchObject({
      total: 2,
      published: 1,
      hidden: 1,
      images: 1,
      videos: 1,
      uploading: 1,
      uploaders: 1,
    });
    const originals = await call<{ items: { id: string }[]; total: number; bytes: number }>(
      'gallery_owner_originals',
      [inv, OWNER, 'all', null, null, 100],
    );
    expect(originals.total).toBe(2);
    // oldest first (reserved together: by id)
    expect(originals.items.map((i) => i.id)).toEqual([a.id, b.id].sort());
    expect(
      (await call<{ total: number }>('gallery_owner_originals', [inv, OWNER, 'published', null, null, 100]))
        .total,
    ).toBe(1);
  });

  it('deleting queues the files for storage: soft (host, guest) and outright (the gallery, the invitation)', async () => {
    await c.query('delete from gallery_trash');
    // a guest deletes their own upload (not someone else's)
    expect(await commit('gallery_guest_delete', [inv, b.id, SOMEONE])).toBe(false);
    expect(await commit('gallery_guest_delete', [inv, b.id, UPLOADER])).toBe(true);
    expect((await c.query(`select bucket, path from gallery_trash order by id`)).rows).toEqual([
      { bucket: 'gallery-originals', path: b.originalPath },
      { bucket: 'gallery-media', path: b.displayPath },
      { bucket: 'gallery-media', path: b.thumbPath },
    ]);
    expect(await call('gallery_feed', [inv, null, null, 30])).toEqual([]);
    // the claim is leased: a second sweeper gets nothing
    const claimed = await commit<{ id: number }[]>('gallery_trash_claim', [100]);
    expect(claimed).toHaveLength(3);
    expect(await commit('gallery_trash_claim', [100])).toEqual([]);
    expect(await commit('gallery_trash_done', [claimed.map((f) => f.id)])).toBe(3);
    // the whole gallery: the rest of its files (not the soft-deleted one's again)
    expect(await commit('gallery_owner_delete', [inv, OTHER])).toBe(false);
    expect(await commit('gallery_owner_delete', [inv, OWNER])).toBe(true);
    const paths = (await c.query(`select path from gallery_trash order by id`)).rows.map((r) => r.path);
    expect(paths).toContain(a.originalPath);
    expect(paths).not.toContain(b.originalPath);
    expect(
      (await c.query(`select count(*)::int as n from gallery_items where invitation_id = $1`, [inv])).rows[0]
        .n,
    ).toBe(0);
    // an invitation deleted with its gallery
    await commit('gallery_owner_create', [otherInv, OTHER, ...links('7', '8', 'q')]);
    const own = item(otherInv);
    await commit('gallery_reserve', [otherInv, UPLOADER, null, null, JSON.stringify([own]), 10]);
    await c.query('delete from invitations where id = $1', [otherInv]);
    expect(
      (await c.query(`select count(*)::int as n from gallery_trash where path like $1`, [`${otherInv}/%`]))
        .rows[0].n,
    ).toBe(3);
  });

  it('housekeeping: uploads that never finished, old tombstones, rate rows', async () => {
    await commit('gallery_owner_create', [inv, OWNER, ...links('4', '5', 'r')]);
    const stale = item(inv);
    const gone = item(inv);
    await reserve([stale, gone]);
    await complete(gone.id, 'published');
    await commit('gallery_guest_delete', [inv, gone.id, UPLOADER]);
    await c.query(`update gallery_items set created_at = now() - interval '3 days' where id = $1`, [
      stale.id,
    ]);
    await c.query(`update gallery_items set deleted_at = now() - interval '40 days' where id = $1`, [
      gone.id,
    ]);
    await c.query(
      `insert into gallery_rate_events (key_hash, created_at) values ('old', now() - interval '2 days')`,
    );
    await c.query('delete from gallery_trash');
    expect(await commit('gallery_maintenance', [48, 30])).toEqual({ abandoned: 1, tombstones: 1, rate: 1 });
    // the abandoned upload's files are queued; the tombstone's already were
    expect((await c.query(`select count(*)::int as n from gallery_trash`)).rows[0].n).toBe(3);
  });

  it('rate limits count per key within the window', async () => {
    expect(await commit('gallery_rate_hit', ['k1', 2, 60])).toBe(true);
    expect(await commit('gallery_rate_hit', ['k1', 2, 60])).toBe(true);
    expect(await commit('gallery_rate_hit', ['k1', 2, 60])).toBe(false);
    expect(await commit('gallery_rate_hit', ['k2', 2, 60])).toBe(true);
  });
});

describe('privileges', () => {
  it('nothing for visitors or signed-in users: no tables, no functions', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const table of [
        'galleries',
        'gallery_items',
        'gallery_moderation',
        'gallery_rate_events',
        'gallery_trash',
      ]) {
        await expect(as(c, role, OWNER, () => c.query(`select * from public.${table}`))).rejects.toThrow(
          /permission denied/,
        );
      }
      for (const sql of [
        `select public.gallery_by_token('${hex('a')}', 'upload')`,
        `select public.gallery_owner_get('${inv}', '${OWNER}')`,
        `select public.gallery_feed('${inv}', null, null, 10)`,
        `select public.gallery_rate_hit('x', 1, 1)`,
        `select public.gallery_trash_claim(1)`,
        `select public.gallery_maintenance(48, 30)`,
      ]) {
        await expect(as(c, role, OWNER, () => c.query(sql))).rejects.toThrow(/permission denied/);
      }
    }
  });

  it('the buckets are private', async () => {
    const buckets = (
      await c.query(
        `select id, public, file_size_limit from storage.buckets where id like 'gallery-%' order by id`,
      )
    ).rows;
    expect(buckets).toEqual([
      { id: 'gallery-media', public: false, file_size_limit: '12582912' },
      { id: 'gallery-originals', public: false, file_size_limit: '209715200' },
    ]);
  });
});

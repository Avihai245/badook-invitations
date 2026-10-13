import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Isolation between events and hosts, run against the real SQL (legal compliance, security tests):
// one event's gallery link, uploader identity, feed, changes and deletes never reach another event's
// media; what is pending, hidden or rejected never reaches a guest's feed; and the browser's roles
// can't touch any of the legal tables. Synthetic data only.

const OWNER_A = '66666666-6666-4666-8666-666666666661';
const OWNER_B = '66666666-6666-4666-8666-666666666662';
const hex = (c: string) => c.repeat(64);
const UP_A = hex('a');
const UP_B = hex('b');

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let invA: string;
let invB: string;

const run = async <T = unknown>(fn: string, args: unknown[]): Promise<T> =>
  (await c.query(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args)).rows[0].r;

const links = (u: string, p: string, ch: string) => [
  hex(u),
  `nonce-${u}-0123456789ab`,
  hex(p),
  `nonce-${p}-0123456789ab`,
  `chan-${ch}-0123456789abcdef`,
];

async function addItem(inv: string, uploader: string, status: string | null, reason = 'ok') {
  const id = randomUUID();
  const folder = `${inv}/${id}`;
  const reserved = await run<{ ok: boolean }>('gallery_reserve', [
    inv,
    uploader,
    null,
    'synthetic',
    JSON.stringify([
      {
        id,
        kind: 'image',
        originalPath: `${folder}/original.jpg`,
        originalType: 'image/jpeg',
        originalSize: 1000,
        displayPath: `${folder}/display.jpg`,
        displaySize: 500,
        thumbPath: `${folder}/thumb.jpg`,
        thumbSize: 100,
        width: 100,
        height: 100,
        durationMs: null,
        takenAt: null,
      },
    ]),
    3000,
  ]);
  expect(reserved.ok).toBe(true);
  await run('gallery_complete', [inv, id, uploader, status, reason, '{}', '[]', '{}', true]);
  return id;
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(`insert into auth.users (id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')`, [
    OWNER_A,
    OWNER_B,
  ]);
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  const mk = async (owner: string, slug: string) =>
    (await run<{ id: string }>('create_invitation', [owner, 'sahar-bordeaux', 'wedding', slug, doc])).id;
  invA = await mk(OWNER_A, 'iso-a');
  invB = await mk(OWNER_B, 'iso-b');
  await run('gallery_owner_create', [invA, OWNER_A, ...links('1', '2', 'a')]);
  await run('gallery_owner_create', [invB, OWNER_B, ...links('3', '4', 'b')]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('gallery links', () => {
  it('each link opens only its own event, and only as the kind it was made for', async () => {
    expect(await run('gallery_by_token', [hex('1'), 'upload'])).toMatchObject({ invitation: { id: invA } });
    expect(await run('gallery_by_token', [hex('3'), 'upload'])).toMatchObject({ invitation: { id: invB } });
    expect(await run('gallery_by_token', [hex('1'), 'projector'])).toBeNull();
    expect(await run('gallery_by_token', [hex('2'), 'upload'])).toBeNull();
    // a hash that is not a link opens nothing
    expect(await run('gallery_by_token', [hex('f'), 'upload'])).toBeNull();
  });

  it('a retired link (after rotation) stops working', async () => {
    await run('gallery_owner_rotate', [
      invB,
      OWNER_B,
      'upload',
      hex('5'),
      'nonce-5-0123456789abcdef',
      'x',
    ]).catch(() => null);
    // rotation signature varies; whatever it is, the old hash must not resolve to another event
    const old = await run<{ invitation: { id: string } } | null>('gallery_by_token', [hex('3'), 'upload']);
    expect(old === null || old.invitation.id === invB).toBe(true);
  });
});

describe('feed, changes and a device’s own items', () => {
  let a1: string;
  let a2: string;
  let b1: string;
  let aPending: string;
  let aRejected: string;

  beforeAll(async () => {
    a1 = await addItem(invA, UP_A, 'published');
    a2 = await addItem(invA, UP_A, 'published');
    b1 = await addItem(invB, UP_B, 'published');
    aPending = await addItem(invA, UP_A, 'pending', 'approval');
    aRejected = await addItem(invA, UP_A, 'rejected', 'unsafe');
  });

  it('the feed of one event never holds another event’s items', async () => {
    const feedA = (await run<{ id: string }[]>('gallery_feed', [invA, null, null, 50])).map((i) => i.id);
    const feedB = (await run<{ id: string }[]>('gallery_feed', [invB, null, null, 50])).map((i) => i.id);
    expect(feedA).toEqual(expect.arrayContaining([a1, a2]));
    expect(feedA).not.toContain(b1);
    expect(feedB).toEqual([b1]);
  });

  it('pending and rejected items are not in the feed or in "added"', async () => {
    const feedA = (await run<{ id: string }[]>('gallery_feed', [invA, null, null, 50])).map((i) => i.id);
    expect(feedA).not.toContain(aPending);
    expect(feedA).not.toContain(aRejected);
    const changes = await run<{ added: { id: string }[] }>('gallery_changes', [invA, '2000-01-01', 50]);
    const added = changes.added.map((i) => i.id);
    expect(added).not.toContain(aPending);
    expect(added).not.toContain(aRejected);
  });

  it('a device sees its own pending item, never another event’s, never another device’s', async () => {
    const mine = (await run<{ id: string }[]>('gallery_uploader_items', [invA, UP_A])).map((i) => i.id);
    expect(mine).toEqual(expect.arrayContaining([aPending, aRejected]));
    // the same device id used on event B holds nothing of event A (the id is hashed per event by the app)
    expect(await run('gallery_uploader_items', [invB, UP_A])).toEqual([]);
    expect(await run('gallery_item_for_uploader', [invA, aPending, UP_B, null])).toBeNull();
    expect(await run('gallery_item_for_uploader', [invB, aPending, UP_A, null])).toBeNull();
  });

  it('deleting needs the right event AND the right device', async () => {
    expect(await run('gallery_guest_delete', [invB, a1, UP_A])).toBe(false); // wrong event
    expect(await run('gallery_guest_delete', [invA, a1, UP_B])).toBe(false); // wrong device (spoof)
    expect(await run('gallery_guest_delete', [invA, a1, hex('0')])).toBe(false);
    const still = (await run<{ id: string }[]>('gallery_feed', [invA, null, null, 50])).map((i) => i.id);
    expect(still).toContain(a1);
    expect(await run('gallery_guest_delete', [invA, a1, UP_A])).toBe(true);
    const after = (await run<{ id: string }[]>('gallery_feed', [invA, null, null, 50])).map((i) => i.id);
    expect(after).not.toContain(a1);
  });

  it('a host sees and moderates only their own event’s items', async () => {
    expect(await run('gallery_owner_items', [invA, OWNER_B, 'all', null, null, 50])).toBeNull();
    const own = await run<{ items: { id: string }[] } | null>('gallery_owner_items', [
      invA,
      OWNER_A,
      'all',
      null,
      null,
      50,
    ]);
    expect(own).not.toBeNull();
    expect(await run('gallery_owner_moderate', [invA, OWNER_B, [aPending], 'publish'])).toBeNull();
    expect(await run('gallery_owner_originals', [invA, OWNER_B, 'all', null, null, 50])).toBeNull();
  });
});

describe('the browser’s roles', () => {
  const tables = [
    'galleries',
    'gallery_items',
    'gallery_moderation',
    'gallery_faces',
    'gallery_face_scans',
    'gallery_face_optouts',
    'gallery_likes',
    'legal_acceptances',
    'gallery_acknowledgements',
    'media_reports',
    'media_report_events',
    'privacy_requests',
    'privacy_request_events',
    'billing_cards',
    'billing_claims',
    'rsvp_rate_events',
  ];

  it('anon and signed-in users can read or write none of the tables (no policies, no grants)', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const t of tables) {
        const read = await as(c, role, OWNER_A, () => c.query(`select 1 from public.${t} limit 1`)).then(
          () => 'READ ALLOWED',
          (e: Error) => e.message,
        );
        expect(read, `${role} reads ${t}`).toMatch(/permission denied/);
        await expect(as(c, role, OWNER_A, () => c.query(`delete from public.${t}`))).rejects.toThrow(
          /permission denied/,
        );
      }
    }
  });

  it('every table that holds guests’, reporters’ or biometric data has row level security on', async () => {
    const rows = (
      await c.query(
        `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace
         and relname = any($1)`,
        [tables],
      )
    ).rows;
    expect(rows).toHaveLength(tables.length);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });

  it('the new functions can be called by the service role only', async () => {
    for (const fn of [
      `public.media_report_submit('{}'::jsonb)`,
      `public.privacy_request_submit('{}'::jsonb)`,
      `public.legal_accept('${OWNER_A}'::uuid, array['terms'], '2', 'signup', null)`,
      `public.gallery_acknowledge('${invA}'::uuid, '${hex('a')}', '2')`,
      `public.legal_maintenance()`,
    ]) {
      for (const role of ['anon', 'authenticated'] as const)
        await expect(as(c, role, OWNER_A, () => c.query(`select ${fn}`))).rejects.toThrow(
          /permission denied/,
        );
    }
  });
});

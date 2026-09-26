import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Phase 5B's database functions (supabase/migrations/*_gallery_film_faces.sql, *_gallery_link.sql, *_insights.sql): the host's own gallery
// items (the highlights film) and what the film chooses from; face search — indexing by the uploading
// phone and the host's browser, searching, leaving out, forgetting, the host's view, the triggers and
// the retention; the invitation's link to its gallery and sending it to guests (credits, the queue,
// statuses); the invitation's insights (the beacon counted once, rate limits, the host's report, the
// raw rows' retention). Owner checks everywhere, and nothing for anyone but the service role.

const OWNER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';
const DEMO = '00000000-0000-4000-8000-00000000d3e0';
const hex = (ch: string) => ch.repeat(64);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const UPLOADER = hex('c');
const SOMEONE = hex('d');

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let other: string;

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
async function one<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T> {
  return (await c.query(sql, args)).rows[0] as T;
}
async function all<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  return (await c.query(sql, args)).rows as T[];
}

/** A descriptor (128 numbers): one "person" per seed, moved by `shift` on its first number. */
const face = (seed: number, shift = 0) =>
  Array.from({ length: 128 }, (_, i) =>
    Number((0.08 * Math.sin((i + 1) * (seed + 1)) + (i === 0 ? shift : 0)).toFixed(5)),
  );
const faceJson = (seed: number, shift = 0, box = [0.3, 0.2, 0.2, 0.25]) => ({
  box,
  score: 0.93,
  descriptor: face(seed, shift),
});

function itemSpec(invitation: string, over: Record<string, unknown> = {}) {
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
    width: 3000,
    height: 4000,
    durationMs: null,
    takenAt: '2027-06-17T18:30:00Z',
    ...over,
  };
}

/** A guest's photo, uploaded and finished with `status`. */
async function photo(
  status: 'published' | 'pending' | 'hidden' = 'published',
  over: Record<string, unknown> = {},
  uploader = UPLOADER,
) {
  const spec = itemSpec(inv, over);
  expect(
    await commit('gallery_reserve', [inv, uploader, null, 'דנה', JSON.stringify([spec]), 3000]),
  ).toMatchObject({ ok: true });
  await commit('gallery_complete', [
    inv,
    spec.id,
    uploader,
    status === 'hidden' ? 'published' : status,
    'ok',
    JSON.stringify({ sharpness: 120, brightness: 0.5, phash: '0f0f0f0f0f0f0f0f', enhanced: false }),
    '[]',
    '{}',
    true,
  ]);
  if (status === 'hidden') await commit('gallery_owner_moderate', [inv, OWNER, [spec.id], 'hide']);
  return spec.id as string;
}

const links = (u: string, p: string, ch: string) => [
  hex(u),
  `nonce-${u}-0123456789ab`,
  hex(p),
  `nonce-${p}-0123456789ab`,
  `chan-${ch}-0123456789abcdef`,
];

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'p5b-owner@example.com'), ($2, 'p5b-other@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'p5b-test', doc])
  ).id;
  other = (
    await commit<{ id: string }>('create_invitation', [OTHER, 'sahar-bordeaux', 'wedding', 'p5b-other', doc])
  ).id;
  // published, the event a week from now (face search open)
  await c.query(
    `update invitations set status = 'published', published_at = now(),
       published = jsonb_set(draft, '{event,date}', to_jsonb(to_char(current_date + 7, 'YYYY-MM-DD'))),
       draft = jsonb_set(draft, '{event,date}', to_jsonb(to_char(current_date + 7, 'YYYY-MM-DD')))
     where id in ($1, $2)`,
    [inv, other],
  );
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

// ─── the host's own items ───────────────────────────────────────────────────────────────────────

describe('the host’s own items (the highlights film)', () => {
  it('reserves the host’s film only with a gallery, only for the owner, under the cap', async () => {
    const film = itemSpec(inv, { kind: 'video', originalType: 'video/mp4', durationMs: 61_000 });
    film.originalPath = film.originalPath.replace(/\.jpg$/, '.mp4');
    expect(await commit('gallery_owner_add', [inv, OWNER, JSON.stringify(film), 3000])).toEqual({
      ok: false,
      code: 'not_found',
    });
    await commit('gallery_owner_create', [inv, OWNER, ...links('a', 'b', 'p5b')]);
    await commit('gallery_owner_create', [other, OTHER, ...links('e', 'f', 'p5o')]);
    expect(await commit('gallery_owner_add', [inv, OTHER, JSON.stringify(film), 3000])).toEqual({
      ok: false,
      code: 'not_found',
    });
    expect(await commit('gallery_owner_add', [inv, OWNER, JSON.stringify(film), 3000])).toEqual({ ok: true });
    const row = await one(`select source, status, uploader_hash from gallery_items where id = $1`, [film.id]);
    expect(row).toEqual({ source: 'host', status: 'uploading', uploader_hash: sha(`gallery-host:${inv}`) });
    const n = (
      await one<{ n: number }>(
        `select count(*)::int as n from gallery_items where invitation_id = $1 and deleted_at is null`,
        [inv],
      )
    ).n;
    expect(
      await commit('gallery_owner_add', [inv, OWNER, JSON.stringify(itemSpec(inv, { kind: 'video' })), n]),
    ).toEqual({
      ok: false,
      code: 'full',
      left: 0,
    });
  });

  it('finishes it hidden or shown, once, recorded like the host’s other decisions', async () => {
    const hidden = itemSpec(inv, { kind: 'video', originalType: 'video/mp4', durationMs: 30_000 });
    const shown = itemSpec(inv, { kind: 'video', originalType: 'video/mp4', durationMs: 30_000 });
    await commit('gallery_owner_add', [inv, OWNER, JSON.stringify(hidden), 3000]);
    await commit('gallery_owner_add', [inv, OWNER, JSON.stringify(shown), 3000]);
    expect(await commit('gallery_owner_add_done', [inv, OTHER, hidden.id, false, '{}'])).toBeNull();
    const h = await commit<Record<string, unknown>>('gallery_owner_add_done', [
      inv,
      OWNER,
      hidden.id,
      false,
      JSON.stringify({ original: 24_000_000 }),
    ]);
    expect(h).toMatchObject({
      id: hidden.id,
      status: 'hidden',
      source: 'host',
      originalSize: 24_000_000,
      publishedAt: null,
    });
    expect(await commit('gallery_owner_add_done', [inv, OWNER, hidden.id, true, '{}'])).toBeNull();
    const s = await commit<Record<string, unknown>>('gallery_owner_add_done', [
      inv,
      OWNER,
      shown.id,
      true,
      '{}',
    ]);
    expect(s).toMatchObject({ status: 'published', source: 'host' });
    expect(s.publishedAt).toBeTruthy();
    expect(
      await all(`select check_name, result, decided_by from gallery_moderation where item_id = $1`, [
        shown.id,
      ]),
    ).toEqual([{ check_name: 'host', result: 'published', decided_by: 'host' }]);
    // a guest's upload is never finished this way
    const spec = itemSpec(inv);
    await commit('gallery_reserve', [inv, UPLOADER, null, null, JSON.stringify([spec]), 3000]);
    expect(await commit('gallery_owner_add_done', [inv, OWNER, spec.id, true, '{}'])).toBeNull();
  });

  it('the film chooses among published guests’ photos and clips, with faces where face search looked', async () => {
    const a = await photo('published');
    const b = await photo('published');
    const pending = await photo('pending');
    expect(await commit('gallery_owner_film', [inv, OTHER, 100])).toBeNull();
    let list = await commit<{ id: string; source: string; faces: unknown }[]>('gallery_owner_film', [
      inv,
      OWNER,
      100,
    ]);
    const ids = list.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([a, b]));
    expect(ids).not.toContain(pending);
    expect(list.every((x) => x.source === 'guest')).toBe(true);
    expect(list.find((x) => x.id === a)!.faces).toBeNull();
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([
        { id: a, faces: [faceJson(1)] },
        { id: b, faces: [] },
      ]),
      0.6,
    ]);
    list = await commit('gallery_owner_film', [inv, OWNER, 100]);
    expect(list.find((x) => x.id === a)!.faces).toEqual([[0.3, 0.2, 0.2, 0.25]]);
    expect(list.find((x) => x.id === b)!.faces).toEqual([]);
    // a clean slate for the face search tests
    await commit('gallery_face_owner_erase', [inv, OWNER]);
  });
});

// ─── face search ────────────────────────────────────────────────────────────────────────────────

describe('face search', () => {
  it('the uploading phone indexes its own photo once; bad faces keep nothing', async () => {
    const p = await photo('published');
    expect(
      await commit('gallery_face_index_upload', [inv, p, SOMEONE, JSON.stringify([faceJson(1)]), 0.6]),
    ).toEqual({
      ok: false,
      code: 'not_found',
    });
    // a box past the photo's edge: nothing of the photo is kept
    expect(
      await commit('gallery_face_index_upload', [
        inv,
        p,
        UPLOADER,
        JSON.stringify([faceJson(1, 0, [0.9, 0.1, 0.3, 0.3])]),
        0.6,
      ]),
    ).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(
      await commit('gallery_face_index_upload', [
        inv,
        p,
        UPLOADER,
        JSON.stringify([{ ...faceJson(1), descriptor: face(1).slice(1) }]),
        0.6,
      ]),
    ).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(
      (await one<{ n: number }>(`select count(*)::int as n from gallery_face_scans where item_id = $1`, [p]))
        .n,
    ).toBe(0);
    expect(
      await commit('gallery_face_index_upload', [
        inv,
        p,
        UPLOADER,
        JSON.stringify([faceJson(1), faceJson(2, 0, [0.6, 0.2, 0.2, 0.25])]),
        0.6,
      ]),
    ).toEqual({
      ok: true,
      faces: 2,
      excluded: 0,
    });
    expect(
      await commit('gallery_face_index_upload', [inv, p, UPLOADER, JSON.stringify([faceJson(3)]), 0.6]),
    ).toMatchObject({
      ok: true,
      already: true,
    });
    expect(
      (await one<{ n: number }>(`select count(*)::int as n from gallery_faces where item_id = $1`, [p])).n,
    ).toBe(2);
    // no crops, no names: only the box, the score and the descriptor
    const columns = (
      await all<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = 'gallery_faces' order by ordinal_position`,
      )
    ).map((r) => r.column_name);
    expect(columns).toEqual([
      'id',
      'invitation_id',
      'item_id',
      'box',
      'score',
      'descriptor',
      'excluded_at',
      'created_at',
      'updated_at',
      'deleted_at',
    ]);
  });

  it('search finds the published photos a descriptor matches, and nothing else', async () => {
    const shown = await photo('published');
    const kept = await photo('hidden');
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([
        { id: shown, faces: [faceJson(4)] },
        { id: kept, faces: [faceJson(4)] },
      ]),
      0.6,
    ]);
    const found = await commit<{ id: string; distance: number }[]>('gallery_face_search', [
      inv,
      face(4, 0.2),
      0.52,
      100,
    ]);
    expect(found.map((x) => x.id)).toContain(shown);
    expect(found.map((x) => x.id)).not.toContain(kept);
    expect(found.find((x) => x.id === shown)!.distance).toBeCloseTo(0.2, 3);
    expect(await commit('gallery_face_search', [inv, face(4, 0.9), 0.52, 100])).toEqual([]);
    expect(await commit('gallery_face_search', [other, face(4), 0.52, 100])).toEqual([]);
    expect(await commit('gallery_face_search', [inv, face(4).slice(1), 0.52, 100])).toBeNull();
    expect(await commit('gallery_face_search', [inv, [...face(4).slice(1), 5], 0.52, 100])).toBeNull();
  });

  it('a guest left out: their faces leave search, and so do photos added later', async () => {
    const p = await photo('published');
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([{ id: p, faces: [faceJson(5)] }]),
      0.6,
    ]);
    expect(await commit('gallery_face_leave_out', [inv, face(5, 0.1), 0.6])).toEqual({ excluded: 1 });
    expect(
      await one(
        `select descriptor, excluded_at is not null as excluded from gallery_faces where item_id = $1`,
        [p],
      ),
    ).toEqual({
      descriptor: null,
      excluded: true,
    });
    // the request is kept once
    await commit('gallery_face_leave_out', [inv, face(5, 0.1), 0.6]);
    expect(
      (
        await one<{ n: number }>(
          `select count(*)::int as n from gallery_face_optouts where invitation_id = $1`,
          [inv],
        )
      ).n,
    ).toBe(1);
    expect(await commit('gallery_face_search', [inv, face(5), 0.52, 100])).toEqual([]);
    // a later photo of the same guest: excluded as it is indexed
    const later = await photo('published');
    expect(
      await commit('gallery_face_index_upload', [
        inv,
        later,
        UPLOADER,
        JSON.stringify([faceJson(5, 0.05)]),
        0.6,
      ]),
    ).toEqual({
      ok: true,
      faces: 1,
      excluded: 1,
    });
    expect(await commit('gallery_face_search', [inv, face(5), 0.52, 100])).toEqual([]);
    expect(await commit('gallery_face_leave_out', [inv, face(5).slice(2), 0.6])).toBeNull();
  });

  it('“forget me” erases the guest’s faces and their request to be left out', async () => {
    const p = await photo('published');
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([{ id: p, faces: [faceJson(6), faceJson(7, 0, [0.6, 0.2, 0.2, 0.25])] }]),
      0.6,
    ]);
    await commit('gallery_face_leave_out', [inv, face(8), 0.6]);
    expect(await commit('gallery_face_forget', [inv, face(6, 0.1), 0.6])).toEqual({ erased: 1, optouts: 0 });
    expect(await commit('gallery_face_forget', [inv, face(8), 0.6])).toEqual({ erased: 0, optouts: 1 });
    expect(
      (await one<{ n: number }>(`select count(*)::int as n from gallery_faces where item_id = $1`, [p])).n,
    ).toBe(1);
    expect((await commit<unknown[]>('gallery_face_search', [inv, face(7), 0.52, 100])).length).toBe(1);
  });

  it('the host: where it stands, the next photos, what their browser found, erasing now', async () => {
    await commit('gallery_face_owner_erase', [inv, OWNER]);
    expect(await commit('gallery_face_owner_state', [inv, OTHER])).toBeNull();
    const state = await commit<Record<string, number>>('gallery_face_owner_state', [inv, OWNER]);
    expect(state).toMatchObject({ gallery: true, scanned: 0, faces: 0, excluded: 0, optouts: 0 });
    expect(state.photos).toBeGreaterThan(3);
    expect(await commit('gallery_face_owner_pending', [inv, OTHER, 8])).toBeNull();
    const pending = await commit<{ id: string; displayPath: string }[]>('gallery_face_owner_pending', [
      inv,
      OWNER,
      3,
    ]);
    expect(pending).toHaveLength(3);
    expect(pending[0]!.displayPath).toMatch(/display\.jpg$/);
    expect(
      await commit('gallery_face_owner_index', [
        inv,
        OTHER,
        JSON.stringify([{ id: pending[0]!.id, faces: [] }]),
        0.6,
      ]),
    ).toBeNull();
    const done = await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([
        { id: pending[0]!.id, faces: [faceJson(9)] },
        { id: pending[1]!.id, faces: [] },
        { id: 'not-an-id', faces: [] },
        { id: randomUUID(), faces: [] },
      ]),
      0.6,
    ]);
    expect(done).toEqual({ done: 2, faces: 1, excluded: 0, invalid: 2 });
    const next = await commit<{ id: string }[]>('gallery_face_owner_pending', [inv, OWNER, 50]);
    expect(next.map((x) => x.id)).not.toContain(pending[0]!.id);
    expect(next[0]!.id).toBe(pending[2]!.id);
    expect(await commit('gallery_face_owner_erase', [inv, OTHER])).toBeNull();
    expect(await commit('gallery_face_owner_erase', [inv, OWNER])).toEqual({
      faces: 1,
      scans: 2,
      optouts: 0,
    });
  });

  it('a deleted photo’s descriptors go at once; switching the feature off erases the event’s face data', async () => {
    const p = await photo('published');
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([{ id: p, faces: [faceJson(10)] }]),
      0.6,
    ]);
    await c.query(`update gallery_items set deleted_at = now() where id = $1`, [p]);
    expect(
      await one(
        `select descriptor, deleted_at is not null as deleted from gallery_faces where item_id = $1`,
        [p],
      ),
    ).toEqual({
      descriptor: null,
      deleted: true,
    });
    const q = await photo('published');
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([{ id: q, faces: [faceJson(11)] }]),
      0.6,
    ]);
    await commit('gallery_face_leave_out', [inv, face(12), 0.6]);
    // the host turns it on (never on by default), then off: its data goes at once
    expect(await commit('invitation_feature_on', [inv, OTHER, 'face_albums', true])).toBeNull();
    expect(await commit('invitation_feature_on', [inv, OWNER, 'face_albums', true])).toMatchObject({
      on: ['face_albums'],
      off: [],
    });
    expect(
      (
        await one<{ n: number }>(`select count(*)::int as n from gallery_faces where invitation_id = $1`, [
          inv,
        ])
      ).n,
    ).toBeGreaterThan(0);
    expect(await commit('invitation_feature_on', [inv, OWNER, 'face_albums', false])).toMatchObject({
      on: [],
      off: ['face_albums'],
    });
    for (const t of ['gallery_faces', 'gallery_face_scans', 'gallery_face_optouts'])
      expect(
        (await one<{ n: number }>(`select count(*)::int as n from ${t} where invitation_id = $1`, [inv])).n,
      ).toBe(0);
    await commit('invitation_feature_on', [inv, OWNER, 'face_albums', true]);
    await expect(commit('invitation_feature_on', [inv, OWNER, 'Face Albums!', true])).rejects.toThrow(
      /bad feature/,
    );
  });

  it('keeps face data 30 days after the event, then erases it (and for events without the feature)', async () => {
    const p = await photo('published');
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([{ id: p, faces: [faceJson(13)] }]),
      0.6,
    ]);
    const events = await commit<string[]>('gallery_face_events', []);
    expect(events).toContain(inv);
    // the event is next week: kept
    expect(await commit('gallery_face_maintenance', [30])).toEqual({ events: 0 });
    // 30 days ago: still kept; 31 days ago: erased
    const at = (days: number) =>
      c.query(
        `update invitations set published = jsonb_set(published, '{event,date}', to_jsonb(to_char(current_date - $2::int, 'YYYY-MM-DD'))) where id = $1`,
        [inv, days],
      );
    await at(30);
    expect(await commit('gallery_face_maintenance', [30])).toEqual({ events: 0 });
    await at(31);
    expect(await commit('gallery_face_maintenance', [30])).toEqual({ events: 1 });
    expect(
      (
        await one<{ n: number }>(`select count(*)::int as n from gallery_faces where invitation_id = $1`, [
          inv,
        ])
      ).n,
    ).toBe(0);
    await at(-7);
    // the daily run's list of events that lost the feature
    await commit('gallery_face_owner_index', [
      inv,
      OWNER,
      JSON.stringify([{ id: await photo('published'), faces: [faceJson(14)] }]),
      0.6,
    ]);
    expect(await commit('gallery_face_erase_events', [[inv, other]])).toBe(1);
    expect(await commit('gallery_face_erase_events', [[inv]])).toBe(0);
  });

  it('deleting the gallery takes the face data with it', async () => {
    const doc = (await c.query(`select draft from invitations where id = $1`, [other])).rows[0].draft;
    const third = (
      await commit<{ id: string }>('create_invitation', [
        OTHER,
        'sahar-bordeaux',
        'wedding',
        'p5b-third',
        doc,
      ])
    ).id;
    await commit('gallery_owner_create', [third, OTHER, ...links('1', '2', 'p5t')]);
    const spec = itemSpec(third);
    await commit('gallery_reserve', [third, UPLOADER, null, null, JSON.stringify([spec]), 3000]);
    await commit('gallery_complete', [third, spec.id, UPLOADER, 'published', 'ok', '{}', '[]', '{}', true]);
    await commit('gallery_face_owner_index', [
      third,
      OTHER,
      JSON.stringify([{ id: spec.id, faces: [faceJson(15)] }]),
      0.6,
    ]);
    await commit('gallery_face_leave_out', [third, face(16), 0.6]);
    expect(await commit('gallery_owner_delete', [third, OTHER])).toBe(true);
    for (const t of ['gallery_faces', 'gallery_face_scans', 'gallery_face_optouts'])
      expect(
        (await one<{ n: number }>(`select count(*)::int as n from ${t} where invitation_id = $1`, [third])).n,
      ).toBe(0);
  });
});

// ─── the gallery link ───────────────────────────────────────────────────────────────────────────

describe('the invitation’s link to its gallery, and sending it to guests', () => {
  let dana: { id: string; token: string };
  let levi: { id: string; token: string };
  let nophone: { id: string; token: string };
  const guest = async (name: string, phone: string | null) => {
    const token = `tok_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const { id } = await one<{ id: string }>(
      `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, $2, 2, $3, $4) returning id`,
      [inv, name, phone, token],
    );
    return { id, token };
  };

  beforeAll(async () => {
    dana = await guest('דנה כהן', '+972521111111');
    levi = await guest('משפחת לוי', '+97231234567'); // a landline
    nophone = await guest('יעל', null);
  });

  it('the invitation page gets the gallery’s state and its link’s nonce and hash', async () => {
    const doc = (await c.query(`select draft from invitations where id = $1`, [inv])).rows[0].draft;
    const none = (
      await commit<{ id: string }>('create_invitation', [
        OWNER,
        'sahar-bordeaux',
        'wedding',
        'p5b-nogallery',
        doc,
      ])
    ).id;
    expect(await commit('gallery_invitation_link', [none])).toBeNull();
    expect(await commit('gallery_invitation_link', [inv])).toEqual({
      enabled: true,
      paused: false,
      opensAt: null,
      closesAt: null,
      hasCode: false,
      uploadTokenHash: hex('a'),
      uploadTokenNonce: 'nonce-a-0123456789ab',
    });
  });

  it('lists the guests with who can get a WhatsApp', async () => {
    expect(await commit('gallery_notices_state', [inv, OTHER])).toBeNull();
    const state = await commit<{
      gallery: boolean;
      rows: { guestId: string; reach: string; token: string; last: unknown }[];
    }>('gallery_notices_state', [inv, OWNER]);
    expect(state.gallery).toBe(true);
    const by = Object.fromEntries(state.rows.map((r) => [r.guestId, r]));
    expect(by[dana.id]).toMatchObject({ reach: 'ok', token: dana.token, last: null });
    expect(by[levi.id]!.reach).toBe('landline');
    expect(by[nophone.id]!.reach).toBe('none');
  });

  it('queues a credit each, skipping who can’t get one; refunds a failure once', async () => {
    await c.query(
      `insert into accounts (user_id, message_credits) values ($1, 0) on conflict (user_id) do update set message_credits = 0`,
      [OWNER],
    );
    const everyone = [dana.id, levi.id, nophone.id];
    expect(await commit('gallery_notice_queue', [inv, OTHER, everyone, 0.04])).toBeNull();
    expect(await commit('gallery_notice_queue', [inv, OWNER, everyone, 0.04])).toEqual({
      ok: false,
      code: 'credits',
      needed: 1,
      balance: 0,
      skipped: { noPhone: 1, landline: 1, optedOut: 0, queued: 0 },
    });
    await c.query(`update accounts set message_credits = 5 where user_id = $1`, [OWNER]);
    expect(await commit('gallery_notice_queue', [inv, OWNER, everyone, 0.04])).toEqual({
      ok: true,
      queued: 1,
      balance: 4,
      skipped: { noPhone: 1, landline: 1, optedOut: 0, queued: 0 },
    });
    expect(await commit('gallery_notice_queue', [inv, OWNER, [dana.id], 0.04])).toMatchObject({
      ok: false,
      code: 'nobody',
      skipped: { queued: 1 },
    });
    expect(await commit('gallery_notice_pending', [inv])).toBe(1);
    const [m] = await commit<Record<string, unknown>[]>('gallery_notice_claim', [inv, 10]);
    expect(m).toMatchObject({
      invitationId: inv,
      toPhone: '+972521111111',
      attempts: 1,
      guestName: 'דנה כהן',
      guestToken: dana.token,
      slug: 'p5b-test',
      uploadTokenHash: hex('a'),
      uploadTokenNonce: 'nonce-a-0123456789ab',
    });
    expect(m!.document).toBeTruthy();
    // Meta: slow down → back in the queue, later
    expect(await commit('gallery_notice_requeue', [m!.id, '130429 · rate', 60])).toBe(true);
    expect(await commit('gallery_notice_pending', [inv])).toBe(0);
    await c.query(`update gallery_notices set next_attempt_at = now() - interval '1 second' where id = $1`, [
      m!.id,
    ]);
    const [again] = await commit<Record<string, unknown>[]>('gallery_notice_claim', [inv, 10]);
    expect(again).toMatchObject({ id: m!.id, attempts: 2 });
    await commit('gallery_notice_result', [m!.id, 'wamid.gallery.1', null]);
    // statuses only move forward; failed before delivery refunds once
    expect(await commit('gallery_notice_status', ['wamid.gallery.1', 'delivered', null])).toBe(true);
    expect(await commit('gallery_notice_status', ['wamid.gallery.1', 'sent', null])).toBe(false);
    expect(await commit('gallery_notice_status', ['wamid.nope', 'read', null])).toBe(false);
    expect(
      (
        await one<{ credits: number }>(`select message_credits as credits from accounts where user_id = $1`, [
          OWNER,
        ])
      ).credits,
    ).toBe(4);

    // another: fails at once → the credit comes back, once
    await c.query(`delete from gallery_notices where guest_id = $1`, [dana.id]);
    await commit('gallery_notice_queue', [inv, OWNER, [dana.id], 0.04]);
    const [b] = await commit<{ id: string }[]>('gallery_notice_claim', [inv, 10]);
    await commit('gallery_notice_result', [b!.id, null, '131026 · undeliverable']);
    await commit('gallery_notice_result', [b!.id, null, 'again']);
    expect(
      (
        await one<{ credits: number }>(`select message_credits as credits from accounts where user_id = $1`, [
          OWNER,
        ])
      ).credits,
    ).toBe(4);
    const ledger = await all<{ delta: number; reason: string }>(
      `select delta, reason from credit_ledger where user_id = $1 order by created_at, id`,
      [OWNER],
    );
    expect(ledger.slice(-3)).toEqual([
      { delta: -1, reason: 'whatsapp_send' },
      { delta: -1, reason: 'whatsapp_send' },
      { delta: 1, reason: 'whatsapp_refund' },
    ]);
  });

  it('the host marks what they sent themselves; nothing when the gallery is off', async () => {
    expect(await commit('gallery_notice_mark', [inv, OTHER, [levi.id]])).toBeNull();
    expect(await commit('gallery_notice_mark', [inv, OWNER, [levi.id, nophone.id, randomUUID()]])).toBe(2);
    const state = await commit<{
      rows: { guestId: string; last: { channel: string; status: string } | null }[];
    }>('gallery_notices_state', [inv, OWNER]);
    expect(state.rows.find((r) => r.guestId === levi.id)!.last).toMatchObject({
      channel: 'manual',
      status: 'sent',
    });
    await c.query(`update galleries set enabled = false where invitation_id = $1`, [inv]);
    expect(await commit('gallery_notice_queue', [inv, OWNER, [dana.id], 0.04])).toEqual({
      ok: false,
      code: 'no_gallery',
    });
    await c.query(`update galleries set enabled = true where invitation_id = $1`, [inv]);
  });
});

// ─── insights ───────────────────────────────────────────────────────────────────────────────────

describe('insights', () => {
  const today = async () => (await one<{ d: string }>(`select to_char(current_date, 'YYYY-MM-DD') as d`)).d;
  const state = (over: Record<string, unknown> = {}) => ({
    lang: 'he',
    device: 'phone',
    source: 'personal',
    opened: false,
    depth: 0,
    visibleMs: 3000,
    rsvpStarted: false,
    rsvpSent: false,
    calendar: false,
    map: false,
    gallery: false,
    langSwitch: false,
    ...over,
  });
  const daily = async () =>
    one<Record<string, unknown>>(
      `select visits, opened, read_end, rsvp_started, rsvp_sent, calendar, depth, by_lang, by_source, time_hist
       from insight_daily where invitation_id = $1 and day = current_date`,
      [inv],
    );

  it('finds only published invitations, never the site’s samples', async () => {
    expect(await commit('insight_invitation', ['p5b-test'])).toMatchObject({ id: inv });
    expect(await commit('insight_invitation', ['no-such-slug'])).toBeNull();
    const draft = await one<{ slug: string }>(`select slug from invitations where status = 'draft' limit 1`);
    expect(await commit('insight_invitation', [draft.slug])).toBeNull();
    const sample = await one<{ slug: string }>(
      `select slug from invitations where owner_id = $1 and status = 'published' limit 1`,
      [DEMO],
    );
    if (sample) expect(await commit('insight_invitation', [sample.slug])).toBeNull();
  });

  it('counts a page load once, and each thing it did once', async () => {
    const visit = randomUUID();
    const day = await today();
    expect(await commit('insight_hit', [inv, visit, day, JSON.stringify(state()), 'k1'])).toEqual({
      ok: true,
    });
    expect(await daily()).toMatchObject({ visits: 1, opened: 0, time_hist: { '0': 1 } });
    await commit('insight_hit', [
      inv,
      visit,
      day,
      JSON.stringify(state({ opened: true, depth: 50, visibleMs: 31_000 })),
      'k1',
    ]);
    await commit('insight_hit', [
      inv,
      visit,
      day,
      JSON.stringify(
        state({
          opened: true,
          depth: 100,
          visibleMs: 64_000,
          rsvpStarted: true,
          rsvpSent: true,
          calendar: true,
        }),
      ),
      'k1',
    ]);
    // a late beacon with less to say changes nothing
    await commit('insight_hit', [
      inv,
      visit,
      day,
      JSON.stringify(state({ opened: true, depth: 25, visibleMs: 10_000 })),
      'k1',
    ]);
    expect(await daily()).toMatchObject({
      visits: 1,
      opened: 1,
      read_end: 1,
      rsvp_started: 1,
      rsvp_sent: 1,
      calendar: 1,
      depth: { '25': 1, '50': 1, '75': 1, '100': 1 },
      by_lang: { he: { visits: 1, sent: 1 } },
      by_source: { personal: { visits: 1, sent: 1 } },
      time_hist: { '0': 0, '30': 0, '60': 1 },
    });
    expect(await one(`select visible_ms, depth from insight_visits where id = $1`, [visit])).toEqual({
      visible_ms: 64_000,
      depth: 100,
    });
    // the same page load can't count for another invitation; a day far from today isn't taken
    expect(await commit('insight_hit', [other, visit, day, JSON.stringify(state()), 'k1'])).toEqual({
      ok: false,
      code: 'mismatch',
    });
    expect(
      await commit('insight_hit', [inv, randomUUID(), '2020-01-01', JSON.stringify(state()), 'k1']),
    ).toEqual({
      ok: false,
      code: 'mismatch',
    });
    // not published: nothing
    await c.query(`update invitations set status = 'draft' where id = $1`, [other]);
    expect(await commit('insight_hit', [other, randomUUID(), day, JSON.stringify(state()), 'k1'])).toBeNull();
    await c.query(`update invitations set status = 'published' where id = $1`, [other]);
  });

  it('rate-limits per address and per invitation', async () => {
    const day = await today();
    await c.query(
      `insert into gallery_rate_events (key_hash) select 'busy-address' from generate_series(1, 600)`,
    );
    expect(
      await commit('insight_hit', [inv, randomUUID(), day, JSON.stringify(state()), 'busy-address']),
    ).toEqual({ ok: false, code: 'rate' });
    const key = sha(`insight-invitation:${other}`);
    await c.query(`insert into gallery_rate_events (key_hash) select $1 from generate_series(1, 20000)`, [
      key,
    ]);
    expect(
      await commit('insight_hit', [other, randomUUID(), day, JSON.stringify(state()), 'calm-address']),
    ).toEqual({ ok: false, code: 'rate' });
    await c.query(`delete from gallery_rate_events where key_hash in ('busy-address', $1)`, [key]);
  });

  it('the host’s report: their own invitation, the days, the personal links, the replies, the gallery', async () => {
    expect(await commit('insight_owner_report', [inv, OTHER, 30])).toBeNull();
    const report = await commit<Record<string, unknown>>('insight_owner_report', [inv, OWNER, 30]);
    expect(report).toMatchObject({ status: 'published', timezone: 'Asia/Jerusalem' });
    const days = report.days as { day: string; visits: number }[];
    expect(days.length).toBeGreaterThan(0);
    expect(days.at(-1)!.visits).toBeGreaterThan(0);
    expect(report.personal).toMatchObject({ guests: 3 });
    expect(report.responses).toMatchObject({ total: 0 });
    expect(report.gallery).toBeTruthy();
    const since = await commit<{ from: string; to: string }>('insight_owner_report', [inv, OWNER, 0]);
    expect(since.from <= since.to).toBe(true);
  });

  it('keeps page loads for 7 days, the daily numbers with the invitation', async () => {
    await c.query(
      `update insight_visits set created_at = now() - interval '8 days' where invitation_id = $1`,
      [inv],
    );
    const old = (
      await one<{ n: number }>(
        `select count(*)::int as n from insight_visits where created_at < now() - interval '7 days'`,
      )
    ).n;
    expect(old).toBeGreaterThan(0);
    expect(await commit('insight_maintenance', [7])).toEqual({ visits: old });
    expect(
      (
        await one<{ n: number }>(`select count(*)::int as n from insight_visits where invitation_id = $1`, [
          inv,
        ])
      ).n,
    ).toBe(0);
    expect(
      (
        await one<{ n: number }>(`select count(*)::int as n from insight_daily where invitation_id = $1`, [
          inv,
        ])
      ).n,
    ).toBeGreaterThan(0);
  });
});

// ─── privileges ─────────────────────────────────────────────────────────────────────────────────

describe('privileges', () => {
  const TABLES = [
    'gallery_faces',
    'gallery_face_scans',
    'gallery_face_optouts',
    'gallery_notices',
    'insight_visits',
    'insight_daily',
  ];

  it('every new table: row level security on, no policies', async () => {
    const rows = await all<{ relname: string; rls: boolean }>(
      `select relname, relrowsecurity as rls from pg_class where relname = any($1) order by relname`,
      [TABLES],
    );
    expect(rows).toHaveLength(TABLES.length);
    expect(rows.every((r) => r.rls)).toBe(true);
    expect(
      (
        await one<{ n: number }>(`select count(*)::int as n from pg_policies where tablename = any($1)`, [
          TABLES,
        ])
      ).n,
    ).toBe(0);
  });

  it('nothing for visitors or signed-in users: no tables, no functions', async () => {
    const d = `'{${face(1).join(',')}}'::real[]`;
    for (const role of ['anon', 'authenticated'] as const) {
      for (const t of TABLES)
        await expect(as(c, role, OWNER, () => c.query(`select * from public.${t}`))).rejects.toThrow(
          /permission denied/,
        );
      for (const sql of [
        `select public.invitation_feature_on('${inv}', '${OWNER}', 'face_albums', true)`,
        `select public.gallery_owner_add('${inv}', '${OWNER}', '{}'::jsonb, 1)`,
        `select public.gallery_owner_add_done('${inv}', '${OWNER}', '${randomUUID()}', true, '{}'::jsonb)`,
        `select public.gallery_owner_film('${inv}', '${OWNER}', 1)`,
        `select public.gallery_face_search('${inv}', ${d}, 0.5, 1)`,
        `select public.gallery_face_leave_out('${inv}', ${d}, 0.5)`,
        `select public.gallery_face_forget('${inv}', ${d}, 0.5)`,
        `select public.gallery_face_index_upload('${inv}', '${randomUUID()}', 'x', '[]'::jsonb, 0.5)`,
        `select public.gallery_face_owner_state('${inv}', '${OWNER}')`,
        `select public.gallery_face_owner_erase('${inv}', '${OWNER}')`,
        `select public.gallery_face_maintenance(30)`,
        `select public.gallery_invitation_link('${inv}')`,
        `select public.gallery_notices_state('${inv}', '${OWNER}')`,
        `select public.gallery_notice_claim(null, 1)`,
        `select public.insight_invitation('p5b-test')`,
        `select public.insight_hit('${inv}', '${randomUUID()}', current_date, '{}'::jsonb, 'k')`,
        `select public.insight_owner_report('${inv}', '${OWNER}', 7)`,
        `select public.insight_maintenance(7)`,
      ])
        await expect(as(c, role, OWNER, () => c.query(sql))).rejects.toThrow(/permission denied/);
    }
  });

  it('the internal helpers aren’t even the service role’s', async () => {
    const d = `'{${face(1).join(',')}}'::real[]`;
    for (const sql of [
      `select public.face_distance(${d}, ${d})`,
      `select public.gallery_face_erase('${inv}')`,
      `select public.gallery_face_add('${inv}', '${randomUUID()}', 'host', '[]'::jsonb, 0.5)`,
      `select public.gallery_notice_refund('${randomUUID()}')`,
      `select public.insight_bucket(1000)`,
    ])
      await expect(as(c, 'service_role', null, () => c.query(sql))).rejects.toThrow(/permission denied/);
    await expect(
      as(c, 'service_role', null, () =>
        c.query(`select public.gallery_face_owner_state($1, $2)`, [inv, OWNER]),
      ),
    ).resolves.toBeTruthy();
  });
});

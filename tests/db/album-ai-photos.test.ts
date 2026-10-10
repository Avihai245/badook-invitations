import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The album's and the AI photos' database functions (supabase/migrations/*_album.sql, *_ai_photos.sql):
// the album made once with the gallery, the host's settings (cover and hidden items only the gallery's
// own), what it shows, its link, the morning-after candidates, the thank-you queue's credits; the AI
// photos' people (at most four, their old photo to the trash), turning it on (consent, a photo), the
// limits counted under a lock (a failed or blocked photo doesn't count), the worker's claim / done /
// retry / background checks, a finished photo into the gallery as the guest's upload, the 30 days'
// erasure; owner checks everywhere, and nothing for anyone but the service role.

const OWNER = '88888888-8888-4888-8888-888888888881';
const OTHER = '88888888-8888-4888-8888-888888888882';
const hex = (ch: string) => ch.repeat(64);
const UPLOADER = hex('a');
const SOMEONE = hex('b');

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
async function one<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T> {
  return (await c.query(sql, args)).rows[0] as T;
}

/** A published guest photo in the gallery. */
async function galleryPhoto(takenAt: string) {
  const id = randomUUID();
  const folder = `${inv}/${id}`;
  const spec = {
    id,
    kind: 'image',
    originalPath: `${folder}/original.jpg`,
    originalType: 'image/jpeg',
    originalSize: 1000,
    displayPath: `${folder}/display.jpg`,
    displaySize: 500,
    thumbPath: `${folder}/thumb.jpg`,
    thumbSize: 100,
    width: 1600,
    height: 1200,
    durationMs: null,
    takenAt,
  };
  await commit('gallery_reserve', [inv, UPLOADER, null, 'דנה', JSON.stringify([spec]), 3000]);
  await commit('gallery_complete', [inv, id, UPLOADER, 'published', 'ok', '{}', '[]', '{}', true]);
  return id;
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'album-owner@example.com'), ($2, 'album-other@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'album-test', doc])
  ).id;
  // published, the event two days ago
  await c.query(
    `update invitations set status = 'published', published_at = now(),
       published = jsonb_set(draft, '{event,date}', to_jsonb(to_char(current_date - 2, 'YYYY-MM-DD'))),
       draft = jsonb_set(draft, '{event,date}', to_jsonb(to_char(current_date - 2, 'YYYY-MM-DD')))
     where id = $1`,
    [inv],
  );
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('the album', () => {
  it('is made once, only with a gallery, only for the owner', async () => {
    expect(
      await commit('album_owner_ensure', [inv, OWNER, hex('1'), 'nonce-album-0123456789']),
    ).toMatchObject({
      album: null,
      gallery: null,
    });
    await commit('gallery_owner_create', [
      inv,
      OWNER,
      hex('2'),
      'nonce-upload-01234567',
      hex('3'),
      'nonce-proj-0123456789',
      'chan-album-0123456789',
    ]);
    expect(await commit('album_owner_ensure', [inv, OTHER, hex('1'), 'nonce-album-0123456789'])).toBeNull();
    const made = await commit<{ album: { enabled: boolean; tokenHash: string } }>('album_owner_ensure', [
      inv,
      OWNER,
      hex('1'),
      'nonce-album-0123456789',
    ]);
    expect(made.album).toMatchObject({ enabled: true, tokenHash: hex('1') });
    // again: the same album
    const again = await commit<{ album: { tokenHash: string } }>('album_owner_ensure', [
      inv,
      OWNER,
      hex('9'),
      'nonce-other-0123456789',
    ]);
    expect(again.album.tokenHash).toBe(hex('1'));
  });

  it('shows the published photos, oldest first, without the ones left out (and videos only when asked)', async () => {
    const a = await galleryPhoto('2027-06-17T18:00:00Z');
    const b = await galleryPhoto('2027-06-17T17:00:00Z');
    const hidden = await galleryPhoto('2027-06-17T19:00:00Z');
    await commit('album_owner_update', [
      inv,
      OWNER,
      JSON.stringify({ hiddenItems: [hidden, randomUUID()], coverItemId: a }),
    ]);
    const items = await commit<{ id: string }[]>('album_items', [inv, false, 100]);
    expect(items.map((i) => i.id)).toEqual([b, a]);
    const all = await commit<{ id: string; hidden: boolean }[]>('album_owner_items', [inv, OWNER, 100]);
    expect(all.map((i) => [i.id, i.hidden])).toEqual([
      [b, false],
      [a, false],
      [hidden, true],
    ]);
    // a cover that isn't the gallery's own is no cover
    const s = await commit<{ album: { coverItemId: string; hiddenItems: string[] } }>('album_owner_update', [
      inv,
      OWNER,
      JSON.stringify({ coverItemId: randomUUID() }),
    ]);
    expect(s.album.coverItemId).toBeNull();
    expect(s.album.hiddenItems).toEqual([hidden]);
    expect(await commit('album_owner_items', [inv, OTHER, 100])).toBeNull();
  });

  it('its link opens it; a new link retires the old one; the invitation’s page links it while it is on', async () => {
    expect(await commit<{ invitation: { id: string } }>('album_by_token', [hex('1')])).toMatchObject({
      invitation: { id: inv, slug: 'album-test' },
    });
    await commit('album_owner_rotate', [inv, OWNER, hex('4'), 'nonce-album-rotated-01']);
    expect(await commit('album_by_token', [hex('1')])).toBeNull();
    expect(await commit('album_invitation_link', [inv])).toMatchObject({ tokenHash: hex('4') });
    await commit('album_owner_update', [inv, OWNER, JSON.stringify({ enabled: false })]);
    expect(await commit('album_invitation_link', [inv])).toBeNull();
    await commit('album_owner_update', [inv, OWNER, JSON.stringify({ enabled: true, opensAt: null })]);
  });

  it('the morning-after candidates: the event in the window, photos, not told yet — once', async () => {
    const list = await commit<{ invitationId: string; email: string; photos: number }[]>(
      'album_ready_candidates',
      [
        new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
        50,
      ],
    );
    const mine = list.find((x) => x.invitationId === inv);
    expect(mine).toMatchObject({ email: 'album-owner@example.com', photos: 3 });
    expect(await commit('album_ready_mark', [inv])).toBe(true);
    expect(await commit('album_ready_mark', [inv])).toBeNull();
    const after = await commit<{ invitationId: string }[]>('album_ready_candidates', [
      new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
      50,
    ]);
    expect(after.some((x) => x.invitationId === inv)).toBe(false);
  });

  it('the thank-you: a credit each, never twice at once, claimed with the album’s link', async () => {
    const guest = (
      await c.query(
        `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, 'דנה', 2, '+972501234567', $2) returning id`,
        [inv, 'guest-token-album-0001'],
      )
    ).rows[0].id as string;
    await c.query(
      `insert into accounts (user_id, message_credits) values ($1, 0) on conflict (user_id) do update set message_credits = 0`,
      [OWNER],
    );
    expect(await commit('album_notice_queue', [inv, OWNER, [guest], 0.04])).toEqual({
      ok: false,
      code: 'credits',
      needed: 1,
      balance: 0,
    });
    await c.query(`update accounts set message_credits = 2 where user_id = $1`, [OWNER]);
    expect(await commit('album_notice_queue', [inv, OWNER, [guest], 0.04])).toMatchObject({
      ok: true,
      queued: 1,
      balance: 1,
    });
    expect(await commit('album_notice_queue', [inv, OWNER, [guest], 0.04])).toMatchObject({
      ok: false,
      code: 'nobody',
      skipped: { queued: 1 },
    });
    const claimed = await commit<
      { id: string; albumTokenHash: string; guestName: string; albumEnabled: boolean }[]
    >('album_notice_claim', [inv, 10]);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ albumTokenHash: hex('4'), guestName: 'דנה', albumEnabled: true });
    // failed: the credit comes back, once
    await commit('album_notice_result', [claimed[0]!.id, null, 'boom']);
    expect(
      (await one<{ n: number }>(`select message_credits as n from accounts where user_id = $1`, [OWNER])).n,
    ).toBe(2);
    const state = await commit<{ rows: { last: { status: string } }[] }>('album_notices_state', [inv, OWNER]);
    expect(state.rows[0]!.last.status).toBe('failed');
    expect(await commit('album_notices_state', [inv, OTHER])).toBeNull();
  });
});

describe('the AI photos', () => {
  let aviv: string;
  let roni: string;

  it('people of honor: at most four, only the owner’s; a replaced photo goes to the trash', async () => {
    expect(
      await commit('ai_photo_person_save', [
        inv,
        OTHER,
        JSON.stringify({ role: 'groom', name: { he: 'x' } }),
        4,
      ]),
    ).toBeNull();
    const a = await commit<{ id: string }>('ai_photo_person_save', [
      inv,
      OWNER,
      JSON.stringify({
        role: 'groom',
        name: { he: 'אביב', en: 'Aviv' },
        photoPath: `${inv}/people/a/photo.jpg`,
        photoSize: 10,
      }),
      4,
    ]);
    aviv = a.id;
    roni = (
      await commit<{ id: string }>('ai_photo_person_save', [
        inv,
        OWNER,
        JSON.stringify({
          role: 'bride',
          name: { he: 'רוני' },
          photoPath: `${inv}/people/b/photo.jpg`,
          photoSize: 10,
        }),
        4,
      ])
    ).id;
    await commit('ai_photo_person_save', [
      inv,
      OWNER,
      JSON.stringify({ role: 'parent', name: { he: 'אבא' } }),
      4,
    ]);
    await commit('ai_photo_person_save', [
      inv,
      OWNER,
      JSON.stringify({ role: 'parent', name: { he: 'אמא' } }),
      4,
    ]);
    expect(
      await commit('ai_photo_person_save', [
        inv,
        OWNER,
        JSON.stringify({ role: 'honoree', name: { he: 'סבא' } }),
        4,
      ]),
    ).toEqual({
      error: 'full',
    });
    // a path outside the invitation's folder is refused by the table
    await expect(
      commit('ai_photo_person_save', [
        inv,
        OWNER,
        JSON.stringify({ id: aviv, photoPath: 'elsewhere/x.jpg', photoSize: 1 }),
        4,
      ]),
    ).rejects.toThrow();
    await commit('ai_photo_person_save', [
      inv,
      OWNER,
      JSON.stringify({ id: aviv, photoPath: `${inv}/people/a2/photo.jpg`, photoSize: 12 }),
      4,
    ]);
    expect(
      (
        await one<{ n: number }>(
          `select count(*)::int as n from gallery_trash where bucket = 'ai-photos' and path = $1`,
          [`${inv}/people/a/photo.jpg`],
        )
      ).n,
    ).toBe(1);
  });

  it('turning it on needs the consent and a photo; the consent taken back turns it off', async () => {
    expect(await commit('ai_photo_owner_settings', [inv, OWNER, JSON.stringify({ enabled: true })])).toEqual({
      ok: false,
      code: 'consent',
    });
    expect(
      await commit('ai_photo_owner_settings', [
        inv,
        OWNER,
        JSON.stringify({ consent: true, perGuest: 2, perEvent: 3 }),
      ]),
    ).toEqual({
      ok: true,
    });
    expect(await commit('ai_photo_owner_settings', [inv, OWNER, JSON.stringify({ enabled: true })])).toEqual({
      ok: true,
    });
    const view = await commit<{ settings: { enabled: boolean; consentAt: string } }>('ai_photo_owner_get', [
      inv,
      OWNER,
    ]);
    expect(view.settings.enabled).toBe(true);
    expect(view.settings.consentAt).toBeTruthy();
    expect(await commit('ai_photo_owner_get', [inv, OTHER])).toBeNull();
    // only the people with a photo reach the guests
    const state = await commit<{ people: { id: string }[] }>('ai_photo_guest_state', [inv, UPLOADER, 10]);
    expect(state.people.map((p) => p.id).sort()).toEqual([aviv, roni].sort());
  });

  const ask = (id: string, people: string[], uploader = UPLOADER, daily = 1000) =>
    commit<{ ok: boolean; code?: string; left?: number }>('ai_photo_create', [
      inv,
      uploader,
      null,
      'דנה',
      JSON.stringify({
        id,
        prompt: 'תוסיף את אביב',
        people,
        locale: 'he',
        sourcePath: `${inv}/photos/${id}/source.jpg`,
      }),
      daily,
    ]);

  it('the limits: per phone, per event, the site’s day; a failed or blocked photo doesn’t count', async () => {
    const first = randomUUID();
    expect(await ask(first, [aviv, randomUUID()])).toEqual({ ok: true, left: 1 });
    // only the event's people with a photo are kept
    expect(
      (await one<{ people: string[] }>(`select people from ai_photos where id = $1`, [first])).people,
    ).toEqual([aviv]);
    expect(await ask(randomUUID(), [randomUUID()])).toEqual({ ok: false, code: 'no_people' });
    const second = randomUUID();
    expect(await ask(second, [roni])).toEqual({ ok: true, left: 0 });
    expect(await ask(randomUUID(), [roni])).toEqual({ ok: false, code: 'guest_limit', limit: 2 });
    // blocked: it no longer counts for the phone
    await c.query(`update ai_photos set status = 'running' where id = $1`, [second]);
    expect(await commit('ai_photo_fail', [second, 'blocked', 'safety'])).toBe(true);
    // the site's ceiling: one counted photo today (the blocked one isn't)
    expect(await ask(randomUUID(), [roni], UPLOADER, 1)).toEqual({ ok: false, code: 'daily_limit' });
    const third = randomUUID();
    expect(await ask(third, [roni])).toEqual({ ok: true, left: 0 });
    // the event's limit (3): another phone makes the third counted photo, a fourth phone is turned away
    expect(await ask(randomUUID(), [roni], SOMEONE)).toEqual({ ok: true, left: 1 });
    expect(await ask(randomUUID(), [roni], hex('c'))).toEqual({ ok: false, code: 'event_limit' });
  });

  it('the worker: claims with the request’s needs, background checks, done; retries then fails', async () => {
    const claimed = await commit<
      { id: string; persons: { id: string; photoPath: string }[]; document: unknown }[]
    >('ai_photo_claim', [inv, 1, 240, 2]);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.persons.map((p) => p.id)).toEqual([aviv]);
    expect(claimed[0]!.document).toBeTruthy();
    const id = claimed[0]!.id;
    // nobody else gets it while it runs
    const rest = await commit<{ id: string }[]>('ai_photo_claim', [inv, 5, 240, 2]);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.map((x) => x.id)).not.toContain(id);
    expect(await commit('ai_photo_started', [id, 'resp_123'])).toBe(true);
    // checked at most every few seconds: just checked
    expect(await commit('ai_photo_checks', [inv, 10, 4, 900])).toEqual([]);
    await c.query(`update ai_photos set checked_at = now() - interval '10 seconds' where id = $1`, [id]);
    expect(
      (await commit<{ externalId: string }[]>('ai_photo_checks', [inv, 10, 4, 900]))[0]!.externalId,
    ).toBe('resp_123');
    expect(
      await commit('ai_photo_done', [
        id,
        `${inv}/photos/${id}/result.jpg`,
        `${inv}/photos/${id}/thumb.jpg`,
        1024,
        1536,
      ]),
    ).toBe(true);
    // a temporary failure: queued again, then failed after the tries
    const other = rest[0]!.id;
    expect(await commit('ai_photo_retry', [other, '429', 2])).toBe(true);
    expect((await commit<{ id: string }[]>('ai_photo_claim', [inv, 5, 240, 2])).map((x) => x.id)).toContain(
      other,
    );
    expect(await commit('ai_photo_retry', [other, '429', 2])).toBe(false);
    expect(
      (await one<{ status: string }>(`select status from ai_photos where id = $1`, [other])).status,
    ).toBe('failed');
  });

  it('a finished photo into the gallery: the guest’s upload, marked AI, published as the gallery’s mode says; once', async () => {
    const done = (await one<{ id: string }>(`select id from ai_photos where status = 'done' limit 1`)).id;
    const itemId = randomUUID();
    const folder = `${inv}/${itemId}`;
    const item = {
      id: itemId,
      originalPath: `${folder}/original.jpg`,
      originalSize: 2000,
      displayPath: `${folder}/display.jpg`,
      displaySize: 2000,
      thumbPath: `${folder}/thumb.jpg`,
      thumbSize: 100,
      width: 1024,
      height: 1536,
    };
    expect(await commit('ai_photo_share', [inv, SOMEONE, done, JSON.stringify(item), 3000])).toEqual({
      ok: false,
      code: 'not_found',
    });
    expect(await commit('ai_photo_share', [inv, UPLOADER, done, JSON.stringify(item), 3000])).toEqual({
      ok: true,
      status: 'published',
      itemId,
    });
    const g = await one<{
      status: string;
      ai_generated: boolean;
      uploader_hash: string;
      uploader_name: string;
    }>(`select status, ai_generated, uploader_hash, uploader_name from gallery_items where id = $1`, [
      itemId,
    ]);
    expect(g).toEqual({
      status: 'published',
      ai_generated: true,
      uploader_hash: UPLOADER,
      uploader_name: 'דנה',
    });
    expect(
      (await commit<{ ai: boolean }[]>('gallery_feed', [inv, null, null, 50])).find(
        (x) => (x as unknown as { id: string }).id === itemId,
      ),
    ).toMatchObject({
      ai: true,
    });
    expect(
      await commit('ai_photo_share', [
        inv,
        UPLOADER,
        done,
        JSON.stringify({ ...item, id: randomUUID() }),
        3000,
      ]),
    ).toEqual({
      ok: false,
      code: 'shared',
    });
  });

  it('deleting: the guest’s own finished photo, the host’s any; the files go to the trash', async () => {
    const mine = (
      await one<{ id: string }>(
        `select id from ai_photos where status in ('failed', 'blocked') and uploader_hash = $1 limit 1`,
        [UPLOADER],
      )
    ).id;
    expect(await commit('ai_photo_guest_delete', [inv, SOMEONE, mine])).toBe(false);
    expect(await commit('ai_photo_guest_delete', [inv, UPLOADER, mine])).toBe(true);
    expect(
      (
        await one<{ n: number }>(`select count(*)::int as n from gallery_trash where path = $1`, [
          `${inv}/photos/${mine}/source.jpg`,
        ])
      ).n,
    ).toBe(1);
    const list = await commit<{ id: string }[]>('ai_photo_owner_list', [inv, OWNER, null, 50]);
    expect(await commit('ai_photo_owner_delete', [inv, OTHER, list.map((p) => p.id)])).toBeNull();
    expect(await commit('ai_photo_owner_delete', [inv, OWNER, [list[0]!.id]])).toBe(1);
  });

  it('erased 30 days after the event (photos and people; turned off)', async () => {
    expect(await commit('ai_photo_maintenance', [30])).toEqual({ photos: 0, people: 0 });
    // the event two days ago: older than one day
    const erased = await commit<{ photos: number; people: number }>('ai_photo_maintenance', [1]);
    expect(erased.people).toBe(4);
    expect(erased.photos).toBeGreaterThan(0);
    expect(
      (await commit<{ settings: { enabled: boolean } }>('ai_photo_owner_get', [inv, OWNER])).settings.enabled,
    ).toBe(false);
  });
});

describe('privileges', () => {
  const denied = [
    `select public.album_owner_get($1, $2)`,
    `select public.ai_photo_owner_get($1, $2)`,
    `select count(*) from public.ai_photos where invitation_id = $1 and $2::uuid is not null`,
    `select count(*) from public.gallery_albums where invitation_id = $1 and $2::uuid is not null`,
  ];
  it('nothing for anyone but the service role', async () => {
    for (const role of ['anon', 'authenticated'] as const)
      for (const sql of denied)
        await as(c, role, role === 'authenticated' ? OWNER : null, async () => {
          await expect(c.query(sql, [inv, OWNER])).rejects.toThrow(/permission denied/);
        });
    for (const sql of [
      `select public.album_json(a) from public.gallery_albums a`,
      `select public.ai_photo_counts($1, '${UPLOADER}')`,
    ])
      await as(c, 'service_role', null, async () => {
        await expect(c.query(sql, sql.includes('$1') ? [inv] : [])).rejects.toThrow(/permission denied/);
      });
    await as(c, 'service_role', null, async () => {
      expect(
        (await c.query(`select public.ai_photo_owner_get($1, $2) as r`, [inv, OWNER])).rows[0].r,
      ).toBeTruthy();
    });
  });
});

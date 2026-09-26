import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The event day (supabase/migrations/*_event_day.sql): a guest's table guide by their personal link's
// hash, the entrance stations by their link's hash (find by QR code, search, check in, undo, rate
// limits), what guests were told and the WhatsApp queue of table notices, live re-seating and merging
// with the audit trail and undo, the seating screen's save that records changes to told families, the
// host's live screen, housekeeping — and nothing for anyone but the service role.

const OWNER = '66666666-6666-4666-8666-666666666661';
const OTHER = '66666666-6666-4666-8666-666666666662';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const codeOf = (token: string) =>
  createHash('sha256').update(`badook-checkin:${token}`).digest('base64url').slice(0, 22);
const RATE = sha('rate-key-of-an-address');

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let other: string;
const STATION = {
  token: 'station-token-aaaaaaaaaa',
  hash: '',
  nonce: 'station-nonce-0123456789',
  channel: '',
};

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows[0] as T;
const all = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows as T[];

const T1 = 'bbbbbbbb-0000-4000-8000-000000000001';
const T2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const T3 = 'bbbbbbbb-0000-4000-8000-000000000003';
const table = (id: string, number: number, capacity = 6, over: Record<string, unknown> = {}) => ({
  id,
  number,
  label: null,
  shape: 'round',
  capacity,
  x: number * 3,
  y: 3,
  w: 1.5,
  h: 1.5,
  rotation: 0,
  zones: [],
  locked: false,
  ...over,
});
const layout = {
  background: null,
  metersPerPixel: null,
  source: null,
  venuePlan: null,
  gridM: 0.5,
  landmarks: [{ id: randomUUID(), kind: 'entrance', x: 1, y: 10, w: 2, h: 0.5, rotation: 0, label: null }],
  settings: { categories: 'group', minFill: 0.6, includePending: false },
};

type Unit = { id: string; guestId: string | null; name: string; status: string; seats: number };
type State = {
  layout: { version: number };
  units: Unit[];
  assignments: { unitId: string; tableId: string }[];
};
const state = (id = inv) => commit<State>('seating_state', [id, OWNER]);
const unitOf = (s: State, name: string) => s.units.find((u) => u.name === name)!;

/** Saves tables and seats on top of the stored version (the seating screen's save, tracked). */
async function seat(tables: Record<string, unknown>[], seats: Record<string, string>, id = inv) {
  const s = await state(id);
  return commit<Record<string, unknown>>('seating_save_tracked', [
    id,
    OWNER,
    s.layout.version,
    JSON.stringify({
      layout,
      tables,
      assignments: Object.entries(seats).map(([unitId, tableId]) => ({ unitId, tableId, source: 'host' })),
      constraints: [],
      units: [],
    }),
  ]);
}

async function guest(
  name: string,
  party: number | null,
  { phone = null, invitation = inv }: { phone?: string | null; invitation?: string } = {},
) {
  const token = `tok_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const { id } = await one<{ id: string }>(
    `insert into invitation_guests (invitation_id, name, party_size, phone, token)
     values ($1, $2, $3, $4, $5) returning id`,
    [invitation, name, party, phone, token],
  );
  return { id, token };
}
async function reply(
  guestId: string | null,
  name: string,
  adults: number,
  attending = true,
  people: string[] = [],
) {
  const { id } = await one<{ id: string }>(
    `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, guest_id, phone)
     values ($1, $2, 'he', $3, $4, 0, $5, $6, null) returning id`,
    [inv, attending, name, adults, `h-${Math.random()}`, guestId],
  );
  for (const [i, full] of people.entries())
    await c.query(
      `insert into rsvp_attendees (response_id, kind, position, full_name) values ($1, 'adult', $2, $3)`,
      [id, i, full],
    );
  return id;
}

// the families of the main event
let cohen: { id: string; token: string };
let levi: { id: string; token: string };
let peretz: { id: string; token: string };
let mizrahi: { id: string; token: string };
let U: Record<'cohen' | 'levi' | 'peretz' | 'mizrahi' | 'walkin', string>;

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'day-owner@example.com'), ($2, 'day-other@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'day-db', doc])
  ).id;
  other = (
    await commit<{ id: string }>('create_invitation', [OTHER, 'sahar-bordeaux', 'wedding', 'day-other', doc])
  ).id;
  await c.query(`update invitations set status = 'published', published = draft where id in ($1, $2)`, [
    inv,
    other,
  ]);

  cohen = await guest('משפחת כהן', 4, { phone: '+972521111111' });
  levi = await guest('משפחת לוי', 3, { phone: '+97231234567' }); // a landline
  peretz = await guest('משפחת פרץ', 2, { phone: '+972522222222' });
  mizrahi = await guest('יעל מזרחי', 1);
  await reply(cohen.id, 'רותי כהן', 4, true, ['רותי כהן', 'דני כהן', 'נועם כהן', 'שירה כהן']);
  await reply(levi.id, 'אבי לוי', 3);
  await reply(peretz.id, 'דנה פרץ', 2);
  await reply(null, 'אורח מהקישור הכללי', 2);
  const s = await state();
  U = {
    cohen: unitOf(s, 'משפחת כהן').id,
    levi: unitOf(s, 'משפחת לוי').id,
    peretz: unitOf(s, 'משפחת פרץ').id,
    mizrahi: unitOf(s, 'יעל מזרחי').id,
    walkin: unitOf(s, 'אורח מהקישור הכללי').id,
  };
  expect(
    await seat([table(T1, 1, 10), table(T2, 2, 6), table(T3, 3, 4)], {
      [U.cohen]: T1,
      [U.levi]: T2,
      [U.peretz]: T2,
    }),
  ).toMatchObject({ ok: true, changed: [] });

  STATION.hash = sha(STATION.token);
  STATION.channel = 'day-channel-0123456789';
  await commit('event_day_owner_setup', [inv, OWNER, STATION.hash, STATION.nonce, STATION.channel]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('the entrance code', () => {
  it('is derived one-way from the personal link, the same way the server does', async () => {
    for (const token of ['AbCdEfGhIjKlMnOp', cohen.token, 'x-_Y0123456789abcdef'])
      expect(await commit('checkin_code', [token])).toBe(codeOf(token));
    expect(codeOf(cohen.token)).not.toContain(cohen.token.slice(4, 12));
  });
});

describe('the host’s event day', () => {
  it('is set up once, with the station link’s hash and nonce only; a new link retires the old one', async () => {
    const got = await commit<{ day: Record<string, string>; invitation: Record<string, unknown> }>(
      'event_day_owner_get',
      [inv, OWNER],
    );
    expect(got.day).toMatchObject({
      stationTokenHash: STATION.hash,
      stationTokenNonce: STATION.nonce,
      channel: STATION.channel,
    });
    expect(got.invitation).toMatchObject({
      id: inv,
      slug: 'day-db',
      status: 'published',
      startTime: expect.any(String),
    });
    // set up again: the link stays
    await commit('event_day_owner_setup', [
      inv,
      OWNER,
      sha('another'),
      'another-nonce-0123456',
      'another-channel-01234',
    ]);
    expect(
      (await commit<{ day: { stationTokenHash: string } }>('event_day_owner_get', [inv, OWNER])).day
        .stationTokenHash,
    ).toBe(STATION.hash);
    // a new link: the old one opens nothing any more (and back, for the rest of the tests)
    await commit('event_day_owner_rotate', [
      inv,
      OWNER,
      sha('rotated'),
      'rotated-nonce-012345',
      'rotated-channel-0123',
    ]);
    expect(await commit('checkin_station_open', [STATION.hash, RATE])).toBeNull();
    expect(await commit('checkin_station_open', [sha('rotated'), RATE])).toMatchObject({
      ok: true,
      channel: 'rotated-channel-0123',
    });
    await commit('event_day_owner_rotate', [inv, OWNER, STATION.hash, STATION.nonce, STATION.channel]);
  });

  it('refuses anyone but the owner', async () => {
    expect(await commit('event_day_owner_get', [inv, OTHER])).toBeNull();
    expect(
      await commit('event_day_owner_setup', [
        inv,
        OTHER,
        sha('x'),
        'nonce-x-0123456789ab',
        'chan-x-0123456789ab',
      ]),
    ).toBeNull();
    expect(
      await commit('event_day_owner_rotate', [
        inv,
        OTHER,
        sha('y'),
        'nonce-y-0123456789ab',
        'chan-y-0123456789ab',
      ]),
    ).toBeNull();
    expect(await commit('event_day_live', [inv, OTHER])).toBeNull();
    expect(await commit('checkin_owner_arrive', [inv, OTHER, randomUUID(), U.cohen, 1])).toBeNull();
    expect(await commit('checkin_owner_undo', [inv, OTHER, randomUUID()])).toBeNull();
    expect(await commit('seating_notices_state', [inv, OTHER])).toBeNull();
    expect(await commit('seating_notice_queue', [inv, OTHER, [U.cohen], 0.03])).toBeNull();
    expect(await commit('seating_notice_mark', [inv, OTHER, [U.cohen]])).toBeNull();
    expect(await commit('seating_live_move', [inv, OTHER, U.cohen, T3, null, false, true])).toBeNull();
    expect(await commit('seating_live_merge', [inv, OTHER, T2, T1, null, false, true])).toBeNull();
    expect(await commit('seating_change_undo', [inv, OTHER, randomUUID(), false, false])).toBeNull();
    expect(await commit('seating_changes_list', [inv, OTHER, 10])).toBeNull();
    expect(await commit('seating_save_tracked', [inv, OTHER, 0, '{}'])).toBeNull();
    // the other host's event has no station link
    expect(await commit('event_day_owner_get', [other, OTHER])).toMatchObject({ day: null });
  });
});

describe('the entrance station', () => {
  it('opens by its link’s hash: the event, its channel, the hall’s numbers', async () => {
    // the server's light lookup (it checks the event's features first)
    expect(await commit('checkin_station_link', [STATION.hash])).toEqual({
      invitationId: inv,
      channel: STATION.channel,
    });
    expect(await commit('checkin_station_link', [sha('nope')])).toBeNull();
    // the pages' language
    expect(await commit('event_day_slug_locale', ['day-db'])).toBe('he');
    expect(await commit('event_day_slug_locale', ['no-such-slug'])).toBeNull();
    expect(await commit('checkin_station_open', [sha('nope'), RATE])).toBeNull();
    const open = await commit<Record<string, unknown>>('checkin_station_open', [STATION.hash, RATE]);
    expect(open).toMatchObject({
      ok: true,
      channel: STATION.channel,
      invitation: { id: inv, slug: 'day-db' },
      // coming: כהן 4, לוי 3, פרץ 2, the general link's guest 2 (מזרחי hasn't replied and isn't seated)
      totals: { expected: 11, parties: 4, arrived: 0, arrivedParties: 0 },
      recent: [],
    });
  });

  it('finds a family by a guest’s entrance code — also a guest added since the units were brought in step', async () => {
    const found = await commit<{ ok: boolean; party: Record<string, unknown> }>('checkin_station_find', [
      STATION.hash,
      codeOf(cohen.token),
      RATE,
    ]);
    expect(found).toMatchObject({
      ok: true,
      party: {
        unitId: U.cohen,
        name: 'משפחת כהן',
        status: 'confirmed',
        seats: 4,
        people: ['רותי כהן', 'דני כהן', 'נועם כהן', 'שירה כהן'],
        phoneTail: '1111',
        table: { id: T1, number: 1, label: null },
        arrived: 0,
        checkins: [],
      },
    });
    expect(await commit('checkin_station_find', [STATION.hash, codeOf('not-a-guest-token'), RATE])).toEqual({
      ok: false,
      code: 'unknown_code',
    });
    expect(await commit('checkin_station_find', [STATION.hash, 'short', RATE])).toMatchObject({
      code: 'unknown_code',
    });
    // another event's guest isn't found through this station
    const stranger = await guest('זר', 2, { invitation: other });
    expect(await commit('checkin_station_find', [STATION.hash, codeOf(stranger.token), RATE])).toMatchObject({
      code: 'unknown_code',
    });
    const late = await guest('נוסף ברגע האחרון', 2);
    expect(
      await commit<{ party: { name: string; status: string } }>('checkin_station_find', [
        STATION.hash,
        codeOf(late.token),
        RATE,
      ]),
    ).toMatchObject({
      ok: true,
      party: { name: 'נוסף ברגע האחרון', status: 'pending', seats: 2, table: null },
    });
    await c.query(`delete from invitation_guests where id = $1`, [late.id]);
  });

  it('searches by the list’s name, the reply’s, the people in it, or phone digits', async () => {
    const names = async (q: string) =>
      (
        await commit<{ parties: { name: string }[] }>('checkin_station_search', [STATION.hash, q, RATE])
      ).parties.map((p) => p.name);
    expect(await names('כהן')).toEqual(['משפחת כהן']);
    expect(await names('שירה')).toEqual(['משפחת כהן']);
    expect(await names('אבי')).toEqual(['משפחת לוי']);
    expect(await names('הכללי')).toEqual(['אורח מהקישור הכללי']);
    expect(await names('052-1111111')).toEqual(['משפחת כהן']);
    expect(await names('0522222222')).toEqual(['משפחת פרץ']);
    expect(await names('משפחת')).toEqual(['משפחת כהן', 'משפחת לוי', 'משפחת פרץ']);
    // LIKE's wildcards are plain characters; a one-letter query finds nothing yet
    expect(await names('%%')).toEqual([]);
    expect(await names('_')).toEqual([]);
    expect(await names('כ')).toEqual([]);
  });

  it('checks a family in, in parts; a retried request never counts twice; undo', async () => {
    const first = randomUUID();
    const arrived = await commit<Record<string, unknown>>('checkin_station_arrive', [
      STATION.hash,
      first,
      U.cohen,
      2,
      'כניסה ראשית',
      RATE,
    ]);
    expect(arrived).toMatchObject({
      ok: true,
      checkinId: first,
      party: { unitId: U.cohen, arrived: 2, checkins: [{ id: first, count: 2, station: 'כניסה ראשית' }] },
      totals: { arrived: 2, arrivedParties: 1 },
    });
    // the same request again (a flaky connection): nothing changes
    expect(
      await commit<{ party: { arrived: number } }>('checkin_station_arrive', [
        STATION.hash,
        first,
        U.cohen,
        2,
        'x',
        RATE,
      ]),
    ).toMatchObject({ party: { arrived: 2 } });
    const second = randomUUID();
    expect(
      await commit('checkin_station_arrive', [STATION.hash, second, U.cohen, 2, '', RATE]),
    ).toMatchObject({
      party: { arrived: 4, checkins: [{ station: 'כניסה ראשית' }, { station: 'station' }] },
    });
    // bad counts, and a family of another event
    expect(
      await commit('checkin_station_arrive', [STATION.hash, randomUUID(), U.cohen, 0, 'x', RATE]),
    ).toMatchObject({
      code: 'invalid',
    });
    expect(
      await commit('checkin_station_arrive', [STATION.hash, randomUUID(), U.cohen, 100, 'x', RATE]),
    ).toMatchObject({
      code: 'invalid',
    });
    await guest('משפחה באירוע אחר', 2, { invitation: other });
    const s = await commit<State>('seating_state', [other, OTHER]);
    expect(s.units.length).toBeGreaterThan(0);
    expect(
      await commit('checkin_station_arrive', [STATION.hash, randomUUID(), s.units[0]!.id, 1, 'x', RATE]),
    ).toMatchObject({ code: 'not_found' });
    // undo the second part; again is harmless
    expect(await commit('checkin_station_undo', [STATION.hash, second, RATE])).toMatchObject({
      ok: true,
      party: { arrived: 2 },
      totals: { arrived: 2 },
    });
    expect(await commit('checkin_station_undo', [STATION.hash, second, RATE])).toMatchObject({ ok: true });
    expect(await commit('checkin_station_undo', [STATION.hash, randomUUID(), RATE])).toMatchObject({
      code: 'not_found',
    });
    // the station's latest arrivals
    expect(await commit<{ recent: unknown[] }>('checkin_station_open', [STATION.hash, RATE])).toMatchObject({
      recent: [{ id: first, unitId: U.cohen, count: 2, name: 'משפחת כהן' }],
    });
  });

  it('the host checks a family in from their own screen too (station “host”)', async () => {
    const id = randomUUID();
    expect(await commit('checkin_owner_arrive', [inv, OWNER, id, U.walkin, 2])).toMatchObject({
      ok: true,
      party: { unitId: U.walkin, arrived: 2, checkins: [{ station: 'host' }] },
    });
    expect(await commit('checkin_owner_undo', [inv, OWNER, id])).toMatchObject({ party: { arrived: 0 } });
  });

  it('is rate-limited per address; a link that is gone or archived opens nothing', async () => {
    const key = sha('a-busy-address');
    await c.query(`insert into gallery_rate_events (key_hash) select $1 from generate_series(1, 3000)`, [
      key,
    ]);
    for (const [fn, args] of [
      ['checkin_station_open', [STATION.hash, key]],
      ['checkin_station_find', [STATION.hash, codeOf(cohen.token), key]],
      ['checkin_station_search', [STATION.hash, 'כהן', key]],
      ['checkin_station_arrive', [STATION.hash, randomUUID(), U.cohen, 1, 'x', key]],
      ['checkin_station_undo', [STATION.hash, randomUUID(), key]],
    ] as const)
      expect(await commit(fn, [...args])).toEqual({ ok: false, code: 'rate' });
    // an archived event's stations close
    await c.query(`update invitations set status = 'archived' where id = $1`, [inv]);
    expect(await commit('checkin_station_open', [STATION.hash, RATE])).toBeNull();
    expect(await commit('checkin_station_find', [STATION.hash, codeOf(cohen.token), RATE])).toBeNull();
    await c.query(`update invitations set status = 'published' where id = $1`, [inv]);
  });
});

describe('the guest’s table guide', () => {
  const guide = (token: string, slug = 'day-db', key = RATE) =>
    commit<Record<string, unknown> | null>('seating_guide', [slug, sha(token), key]);

  it('answers only for a guest’s own link of a published invitation', async () => {
    expect(await guide('not-a-token')).toBeNull();
    expect(await guide(cohen.token, 'day-other')).toBeNull();
    const g = await guide(cohen.token);
    expect(g).toMatchObject({
      ok: true,
      invitation: { id: inv, slug: 'day-db' },
      guest: { id: cohen.id, name: 'משפחת כהן' },
      unit: { id: U.cohen, status: 'confirmed', seats: 4 },
      table: { id: T1, number: 1, capacity: 10, shape: 'round' },
      arrived: 2,
      layout: { background: null, landmarks: [{ kind: 'entrance' }] },
    });
    const tables = (g as { tables: Record<string, unknown>[] }).tables;
    expect(tables.map((t) => t.number)).toEqual([1, 2, 3]);
    // the hall, never anyone's name: no labels, no families
    expect(Object.keys(tables[0]!).sort()).toEqual([
      'capacity',
      'h',
      'id',
      'number',
      'rotation',
      'shape',
      'w',
      'x',
      'y',
    ]);
    // (the invitation's own names are the hosts')
    expect(JSON.stringify({ ...g, invitation: null })).not.toMatch(/לוי|פרץ|מזרחי|הכללי/);
    // not published (a draft, or archived): nothing
    await c.query(`update invitations set status = 'draft' where id = $1`, [inv]);
    expect(await guide(cohen.token)).toBeNull();
    await c.query(`update invitations set status = 'published' where id = $1`, [inv]);
  });

  it('a guest without a table yet, and one who declined', async () => {
    expect(await guide(mizrahi.token)).toMatchObject({
      ok: true,
      unit: { status: 'pending', seats: 1 },
      table: null,
    });
    const noUnit = await guest('עוד לא בסידור', 2);
    expect(await guide(noUnit.token)).toMatchObject({ ok: true, unit: null, table: null, arrived: 0 });
    await c.query(`delete from invitation_guests where id = $1`, [noUnit.id]);
    const declined = await guest('לא יכולים להגיע', 2);
    await reply(declined.id, 'לא יכולים להגיע', 0, false);
    await state();
    expect(await guide(declined.token)).toMatchObject({
      unit: { status: 'declined', seats: 0 },
      table: null,
    });
  });

  it('shows the plan image but not a PDF (phones don’t draw those)', async () => {
    await c.query(
      `update venue_layouts set background_path = $2, background_type = 'application/pdf', background_width = null, background_height = null where invitation_id = $1`,
      [inv, `${OWNER}/${inv}/plan.pdf`],
    );
    expect(await guide(cohen.token)).toMatchObject({ layout: { background: null } });
    await c.query(
      `update venue_layouts set background_type = 'image/png', background_path = $2, background_width = 1200, background_height = 800, meters_per_pixel = 0.025 where invitation_id = $1`,
      [inv, `${OWNER}/${inv}/plan.png`],
    );
    expect(await guide(cohen.token)).toMatchObject({
      layout: {
        background: { path: `${OWNER}/${inv}/plan.png`, width: 1200, height: 800 },
        metersPerPixel: 0.025,
      },
    });
    await c.query(
      `update venue_layouts set background_path = null, background_type = null, background_width = null, background_height = null, meters_per_pixel = null where invitation_id = $1`,
      [inv],
    );
  });

  it('is rate-limited per address and per link', async () => {
    const key = sha('guide-address');
    await c.query(`insert into gallery_rate_events (key_hash) select $1 from generate_series(1, 600)`, [key]);
    expect(await guide(cohen.token, 'day-db', key)).toEqual({ ok: false, code: 'rate' });
    const link = sha(`guide-link:${sha(peretz.token)}`);
    await c.query(`insert into gallery_rate_events (key_hash) select $1 from generate_series(1, 120)`, [
      link,
    ]);
    expect(await guide(peretz.token)).toEqual({ ok: false, code: 'rate' });
    // another guest's link is fine
    expect(await guide(levi.token)).toMatchObject({ ok: true });
  });
});

describe('telling guests their table', () => {
  type Row = {
    unitId: string;
    name: string;
    reach: string;
    table: { number: number } | null;
    told: unknown;
    queued: boolean;
  };
  const rows = async () => (await commit<{ rows: Row[] }>('seating_notices_state', [inv, OWNER])).rows;

  it('lists the families with a seat to tell, whether WhatsApp reaches them, their table', async () => {
    const r = await rows();
    const by = Object.fromEntries(r.map((x) => [x.name, x]));
    expect(by['משפחת כהן']).toMatchObject({ reach: 'ok', table: { number: 1 }, told: null, queued: false });
    expect(by['משפחת לוי']).toMatchObject({ reach: 'landline', table: { number: 2 } });
    expect(by['אורח מהקישור הכללי']).toMatchObject({ reach: 'none', table: null });
    // pending and not seated: nothing to tell
    expect(by['יעל מזרחי']).toBeUndefined();
  });

  it('queues a WhatsApp per family that can get one (a credit each), never twice for the same number', async () => {
    await c.query(
      `insert into accounts (user_id, message_credits) values ($1, 1)
                   on conflict (user_id) do update set message_credits = 1`,
      [OWNER],
    );
    const all3 = [U.cohen, U.levi, U.peretz, U.walkin];
    expect(await commit('seating_notice_queue', [inv, OWNER, all3, 0.0053])).toEqual({
      ok: false,
      code: 'credits',
      needed: 2,
      balance: 1,
      skipped: { noPhone: 1, landline: 1, optedOut: 0, noTable: 0, queued: 0 },
    });
    await c.query(`update accounts set message_credits = 10 where user_id = $1`, [OWNER]);
    expect(await commit('seating_notice_queue', [inv, OWNER, all3, 0.0053])).toEqual({
      ok: true,
      queued: 2,
      balance: 8,
      skipped: { noPhone: 1, landline: 1, optedOut: 0, noTable: 0, queued: 0 },
    });
    expect(await commit('seating_notice_queue', [inv, OWNER, [U.cohen], 0.0053])).toMatchObject({
      ok: false,
      code: 'nobody',
      skipped: { queued: 1 },
    });
    const ledger = await all<{ delta: number; reason: string }>(
      `select delta, reason from credit_ledger where user_id = $1 order by created_at`,
      [OWNER],
    );
    expect(ledger.at(-1)).toEqual({ delta: -2, reason: 'whatsapp_send' });
    const r = await rows();
    expect(r.find((x) => x.unitId === U.cohen)).toMatchObject({
      queued: true,
      told: { number: 1, channel: 'whatsapp', status: 'queued' },
    });
  });

  it('refuses before the invitation is published', async () => {
    await c.query(`update invitations set status = 'draft' where id = $1`, [inv]);
    expect(await commit('seating_notice_queue', [inv, OWNER, [U.cohen], 0.0053])).toEqual({
      ok: false,
      code: 'not_published',
    });
    await c.query(`update invitations set status = 'published' where id = $1`, [inv]);
  });

  it('sends them: claimed with what the template needs; sent, failed (refunded once), retried, opted out', async () => {
    const claimed = await commit<Record<string, unknown>[]>('seating_notice_claim', [inv, 10]);
    expect(claimed).toHaveLength(2);
    const toCohen = claimed.find((m) => m.guestName === 'משפחת כהן')!;
    expect(toCohen).toMatchObject({
      invitationId: inv,
      toPhone: '+972521111111',
      attempts: 1,
      guestToken: cohen.token,
      slug: 'day-db',
      tableNumber: 1,
      tableLabel: null,
    });
    expect(toCohen.document).toBeTruthy();
    const toPeretz = claimed.find((m) => m.guestName === 'משפחת פרץ')!;
    expect(await commit('seating_notice_pending', [inv])).toBe(2);
    await commit('seating_notice_result', [toCohen.id, 'wamid.table.1', null]);
    // Meta: slow down → back in the queue, due later
    expect(await commit('seating_notice_requeue', [toPeretz.id, '130429 · rate', 60])).toBe(true);
    expect(await commit('seating_notice_pending', [inv])).toBe(0);
    await c.query(`update seating_notices set next_attempt_at = now() - interval '1 second' where id = $1`, [
      toPeretz.id,
    ]);
    const again = await commit<{ id: string; attempts: number }[]>('seating_notice_claim', [inv, 10]);
    expect(again).toEqual([expect.objectContaining({ id: toPeretz.id, attempts: 2 })]);
    const credits = async () =>
      (await one<{ n: number }>(`select message_credits as n from accounts where user_id = $1`, [OWNER])).n;
    const before = await credits();
    await commit('seating_notice_result', [toPeretz.id, null, '131026 · not on WhatsApp']);
    expect(await credits()).toBe(before + 1);
    // the status webhook: forward only; a failure after it was sent refunds once
    expect(await commit('seating_notice_status', ['wamid.table.1', 'delivered', null])).toBe(true);
    expect(await commit('seating_notice_status', ['wamid.table.1', 'sent', null])).toBe(false);
    expect(await commit('seating_notice_status', ['wamid.not-a-notice', 'read', null])).toBe(false);
    const told = (await rows()).find((x) => x.unitId === U.cohen)!;
    expect(told).toMatchObject({ queued: false, told: { number: 1, status: 'delivered' } });
    // the failed one isn't what פרץ knows
    expect((await rows()).find((x) => x.unitId === U.peretz)!.told).toBeNull();
  });

  it('a phone that asked us to stop after it was queued: failed at claim time, refunded', async () => {
    await commit('seating_notice_queue', [inv, OWNER, [U.peretz], 0.0053]);
    await c.query(`insert into whatsapp_opt_outs (phone, source) values ('+972522222222', 'reply')`);
    expect(await commit('seating_notice_claim', [inv, 10])).toEqual([]);
    expect(
      await one(
        `select status, error, refunded_at is not null as refunded from seating_notices where unit_id = $1 order by created_at desc limit 1`,
        [U.peretz],
      ),
    ).toEqual({ status: 'failed', error: 'opted_out', refunded: true });
    expect((await rows()).find((x) => x.unitId === U.peretz)).toMatchObject({ reach: 'opted_out' });
    await c.query(`delete from whatsapp_opt_outs where phone = '+972522222222'`);
  });

  it('the host told families themselves: recorded with their table now (none without a table)', async () => {
    expect(await commit('seating_notice_mark', [inv, OWNER, [U.peretz, U.levi, U.mizrahi]])).toBe(2);
    const r = await rows();
    expect(r.find((x) => x.unitId === U.peretz)).toMatchObject({
      told: { number: 2, channel: 'manual', status: 'sent' },
    });
    expect(r.find((x) => x.unitId === U.levi)).toMatchObject({ told: { number: 2, channel: 'manual' } });
  });
});

describe('the freeze: the seating screen’s save keeps the audit trail of told families', () => {
  it('records a told family moved, and a told family’s table renumbered — nothing for the others', async () => {
    // מזרחי (never told) seated: no change recorded
    expect(
      await seat([table(T1, 1, 10), table(T2, 2, 6), table(T3, 3, 4)], {
        [U.cohen]: T1,
        [U.levi]: T2,
        [U.peretz]: T2,
        [U.mizrahi]: T3,
      }),
    ).toMatchObject({ ok: true, changed: [] });
    // פרץ (told table 2) moves to 3
    const moved = await seat([table(T1, 1, 10), table(T2, 2, 6), table(T3, 3, 4)], {
      [U.cohen]: T1,
      [U.levi]: T2,
      [U.peretz]: T3,
      [U.mizrahi]: T3,
    });
    expect(moved).toMatchObject({ ok: true, changed: [U.peretz] });
    // table 1 (כהן, told) becomes 11
    const renumbered = await seat([table(T1, 11, 10), table(T2, 2, 6), table(T3, 3, 4)], {
      [U.cohen]: T1,
      [U.levi]: T2,
      [U.peretz]: T3,
      [U.mizrahi]: T3,
    });
    expect(renumbered).toMatchObject({ ok: true, changed: [U.cohen] });
    const list = await commit<Record<string, unknown>[]>('seating_changes_list', [inv, OWNER, 10]);
    expect(list[0]).toMatchObject({
      kind: 'renumber',
      source: 'seating',
      units: [
        { id: U.cohen, name: 'משפחת כהן', seats: 4, from: { id: T1, number: 1 }, to: { id: T1, number: 11 } },
      ],
      tables: [{ id: T1, from: 1, to: 11 }],
      actorId: OWNER,
      undoneAt: null,
    });
    expect(list[1]).toMatchObject({
      kind: 'move',
      source: 'seating',
      units: [{ id: U.peretz, from: { id: T2, number: 2 }, to: { id: T3, number: 3 } }],
      tables: [],
    });
    // a conflicting save changes nothing and records nothing
    expect(
      await commit('seating_save_tracked', [
        inv,
        OWNER,
        0,
        JSON.stringify({ layout, tables: [], assignments: [], constraints: [], units: [] }),
      ]),
    ).toMatchObject({ ok: false, code: 'conflict' });
    expect(await commit<unknown[]>('seating_changes_list', [inv, OWNER, 10])).toHaveLength(2);
  });

  it('undoes a renumber (the number is given back while it is free) and a move', async () => {
    const [renumber, move] = await commit<{ id: string }[]>('seating_changes_list', [inv, OWNER, 10]);
    const version = (await state()).layout.version;
    const undone = await commit<{ ok: boolean; change: Record<string, unknown> }>('seating_change_undo', [
      inv,
      OWNER,
      renumber!.id,
      false,
      false,
    ]);
    expect(undone).toMatchObject({
      ok: true,
      change: { undoOf: renumber!.id, tables: [{ id: T1, from: 11, to: 1 }] },
    });
    expect(
      (await one<{ number: number }>(`select number from seating_tables where id = $1`, [T1])).number,
    ).toBe(1);
    expect((await state()).layout.version).toBe(version + 1);
    expect(await commit('seating_change_undo', [inv, OWNER, renumber!.id, false, false])).toEqual({
      ok: false,
      code: 'already',
    });
    // an undo can't be undone
    expect(
      await commit('seating_change_undo', [inv, OWNER, (undone.change as { id: string }).id, false, false]),
    ).toEqual({
      ok: false,
      code: 'already',
    });
    expect(await commit('seating_change_undo', [inv, OWNER, move!.id, false, false])).toMatchObject({
      ok: true,
      change: { units: [{ id: U.peretz, from: { number: 3 }, to: { number: 2 } }] },
    });
    expect((await state()).assignments).toContainEqual(
      expect.objectContaining({ unitId: U.peretz, tableId: T2 }),
    );
    expect(await commit('seating_change_undo', [inv, OWNER, randomUUID(), false, false])).toEqual({
      ok: false,
      code: 'not_found',
    });
  });
});

describe('live re-seating', () => {
  it('moves a family to another table (the table’s live seats permitting), recorded with a reason', async () => {
    // T3 (4 seats) has מזרחי (1, not arrived): כהן (4, 2 arrived — the other 2 still expected) doesn't fit
    expect(await commit('seating_live_move', [inv, OWNER, U.cohen, T3, 'קרוב לבמה', false, false])).toEqual({
      ok: false,
      code: 'full',
      table: 3,
      capacity: 4,
      load: 1,
      need: 4,
    });
    // 45 minutes after the start, the missing ones count as not coming: 1 → 0 at T3, כהן needs 2
    const moved = await commit<{ ok: boolean; change: Record<string, unknown> }>('seating_live_move', [
      inv,
      OWNER,
      U.cohen,
      T3,
      'קרוב לבמה',
      true,
      false,
    ]);
    expect(moved).toMatchObject({
      ok: true,
      change: {
        kind: 'move',
        source: 'live',
        reason: 'קרוב לבמה',
        units: [{ id: U.cohen, from: { id: T1, number: 1 }, to: { id: T3, number: 3 } }],
      },
    });
    expect(await commit('seating_live_move', [inv, OWNER, U.cohen, T3, null, true, false])).toEqual({
      ok: false,
      code: 'same_table',
    });
    expect(await commit('seating_live_move', [inv, OWNER, U.cohen, randomUUID(), null, true, false])).toEqual(
      {
        ok: false,
        code: 'not_found',
      },
    );
    // the host adds chairs: forced
    expect(await commit('seating_live_move', [inv, OWNER, U.levi, T3, null, false, true])).toMatchObject({
      ok: true,
    });
  });

  it('merges a table into another — every family at it moves; empty or full tables refuse', async () => {
    // T2 has פרץ (2); T1 is empty now
    expect(await commit('seating_live_merge', [inv, OWNER, T1, T2, null, false, false])).toEqual({
      ok: false,
      code: 'empty',
    });
    expect(await commit('seating_live_merge', [inv, OWNER, T2, T2, null, false, false])).toEqual({
      ok: false,
      code: 'not_found',
    });
    const merged = await commit<{ ok: boolean; change: { id: string; kind: string; units: unknown[] } }>(
      'seating_live_merge',
      [inv, OWNER, T3, T1, 'שני שולחנות חצי ריקים', false, false],
    );
    expect(merged).toMatchObject({ ok: true, change: { kind: 'merge', reason: 'שני שולחנות חצי ריקים' } });
    expect(merged.change.units).toHaveLength(3);
    const s = await state();
    for (const u of [U.cohen, U.levi, U.mizrahi])
      expect(s.assignments).toContainEqual(expect.objectContaining({ unitId: u, tableId: T1 }));
    // undo: all three go back to table 3 (forced: it was over its seats before)
    expect(await commit('seating_change_undo', [inv, OWNER, merged.change.id, false, false])).toMatchObject({
      ok: false,
      code: 'full',
      table: 3,
    });
    expect(await commit('seating_change_undo', [inv, OWNER, merged.change.id, false, true])).toMatchObject({
      ok: true,
    });
    const back = await state();
    for (const u of [U.cohen, U.levi, U.mizrahi])
      expect(back.assignments).toContainEqual(expect.objectContaining({ unitId: u, tableId: T3 }));
  });

  it('an undo refuses when things moved on since (stale) or a number it gives back is taken', async () => {
    const move = await commit<{ change: { id: string } }>('seating_live_move', [
      inv,
      OWNER,
      U.mizrahi,
      T2,
      null,
      false,
      true,
    ]);
    await commit('seating_live_move', [inv, OWNER, U.mizrahi, T1, null, false, true]);
    expect(await commit('seating_change_undo', [inv, OWNER, move.change.id, false, true])).toEqual({
      ok: false,
      code: 'stale',
    });
    // a renumber whose old number went to another table meanwhile
    await seat([table(T1, 7, 10), table(T2, 2, 6), table(T3, 3, 4)], {
      [U.cohen]: T3,
      [U.levi]: T3,
      [U.peretz]: T2,
      [U.mizrahi]: T1,
    });
    await commit('seating_notice_mark', [inv, OWNER, [U.mizrahi]]);
    await seat([table(T1, 8, 10), table(T2, 2, 6), table(T3, 3, 4)], {
      [U.cohen]: T3,
      [U.levi]: T3,
      [U.peretz]: T2,
      [U.mizrahi]: T1,
    });
    const [renumber] = await commit<{ id: string; kind: string }[]>('seating_changes_list', [inv, OWNER, 1]);
    expect(renumber).toMatchObject({ kind: 'renumber' });
    await seat([table(T1, 8, 10), table(T2, 7, 6), table(T3, 3, 4)], {
      [U.cohen]: T3,
      [U.levi]: T3,
      [U.peretz]: T2,
      [U.mizrahi]: T1,
    });
    expect(await commit('seating_change_undo', [inv, OWNER, renumber!.id, false, false])).toEqual({
      ok: false,
      code: 'number_taken',
    });
  });
});

describe('the host’s live screen', () => {
  it('has the hall, every family with its table and arrivals, the numbers, the changes and what was told', async () => {
    const live = await commit<Record<string, unknown>>('event_day_live', [inv, OWNER]);
    expect(live).toMatchObject({
      invitation: { id: inv },
      layout: { version: expect.any(Number), background: null, landmarks: [{ kind: 'entrance' }] },
      totals: { arrived: 2, arrivedParties: 1 },
    });
    expect((live.tables as { number: number }[]).map((t) => t.number).sort()).toEqual([3, 7, 8]);
    const parties = live.parties as { unitId: string; arrived: number; table: { number: number } | null }[];
    expect(parties.find((p) => p.unitId === U.cohen)).toMatchObject({ arrived: 2, table: { number: 3 } });
    expect((live.changes as unknown[]).length).toBeGreaterThan(5);
    expect((live.told as Record<string, unknown>)[U.cohen]).toMatchObject({ number: 1, channel: 'whatsapp' });
  });
});

describe('housekeeping', () => {
  it('erases arrivals 30 days after the event, undone ones after a day', async () => {
    await c.query(
      `update checkins set deleted_at = now() - interval '2 days' where id in (
                     select id from checkins where invitation_id = $1 and deleted_at is not null)`,
      [inv],
    );
    expect(await commit('event_day_maintenance', [30])).toMatchObject({ checkins: 0, undone: 2 });
    await c.query(
      `update invitations set published = jsonb_set(published, '{event,date}', to_jsonb((current_date - 31)::text)) where id = $1`,
      [inv],
    );
    expect(await commit('event_day_maintenance', [30])).toMatchObject({ checkins: 1 });
    expect(await one(`select count(*)::int as n from checkins where invitation_id = $1`, [inv])).toEqual({
      n: 0,
    });
  });
});

describe('privileges', () => {
  it('nothing for visitors or signed-in users: no tables, no functions', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const t of ['event_days', 'checkins', 'seating_notices', 'seating_changes'])
        await expect(as(c, role, OWNER, () => c.query(`select * from public.${t}`))).rejects.toThrow(
          /permission denied/,
        );
      for (const sql of [
        `select public.checkin_station_open('${STATION.hash}', 'k')`,
        `select public.checkin_station_arrive('${STATION.hash}', '${randomUUID()}', '${U.cohen}', 1, 'x', 'k')`,
        `select public.seating_guide('day-db', '${sha(cohen.token)}', 'k')`,
        `select public.event_day_live('${inv}', '${OWNER}')`,
        `select public.seating_live_move('${inv}', '${OWNER}', '${U.cohen}', '${T1}', null, true, true)`,
        `select public.seating_notice_claim(null, 1)`,
        `select public.event_day_maintenance(30)`,
        `select public.checkin_code('x')`,
        `select public.checkin_add('${inv}', '${randomUUID()}', '${U.cohen}', 1, 'x')`,
        `select public.seating_apply_change('${inv}', '${OWNER}', 'move', 'live', null, '{}', '{}', null)`,
      ])
        await expect(as(c, role, OWNER, () => c.query(sql))).rejects.toThrow(/permission denied/);
    }
  });

  it('the service role may call what the server calls', async () => {
    const key = sha('service-role-check');
    await expect(
      as(c, 'service_role', null, () =>
        c.query(`select public.checkin_station_open($1, $2)`, [STATION.hash, key]),
      ),
    ).resolves.toBeTruthy();
    await expect(
      as(c, 'service_role', null, () =>
        c.query(`select public.checkin_add($1, $2, $3, 1, 'x')`, [inv, randomUUID(), U.cohen]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

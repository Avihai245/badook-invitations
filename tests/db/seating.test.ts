import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Seating (supabase/migrations/*_seating.sql): the units kept in step with the guest list and the
// replies, the layout (from a partner venue's plan the first time), saving the whole plan on top of its
// version — capacity, foreign ids, a plan file that isn't the host's — soft-deleted tables, the partner's
// venues and their users, and that only the service role may call any of it.

const OWNER = '55555555-5555-4555-8555-555555555551';
const OTHER = '55555555-5555-4555-8555-555555555552';
const PARTNER_USER = '55555555-5555-4555-8555-555555555553';
const P = 'partner:badook-events';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let other: string;

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
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows[0] as T;

type State = {
  layout: Record<string, unknown> & { version: number };
  tables: Record<string, unknown>[];
  units: {
    id: string;
    guestId: string | null;
    name: string;
    status: string;
    seats: number;
    people: string[];
    group: string | null;
  }[];
  assignments: { unitId: string; tableId: string; source: string }[];
  constraints: Record<string, unknown>[];
  venue: Record<string, unknown> | null;
};
const state = (id = inv, owner = OWNER) => commit<State>('seating_state', [id, owner]);
const unitOf = (s: State, name: string) => s.units.find((u) => u.name === name)!;

const T1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const T2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const T3 = 'aaaaaaaa-0000-4000-8000-000000000003';
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
const layout = (over: Record<string, unknown> = {}) => ({
  background: null,
  metersPerPixel: null,
  source: null,
  venuePlan: null,
  gridM: 0.5,
  landmarks: [],
  settings: { categories: 'group', minFill: 0.6, includePending: false },
  ...over,
});
const plan = (over: Record<string, unknown> = {}) => ({
  layout: layout(),
  tables: [],
  assignments: [],
  constraints: [],
  units: [],
  ...over,
});
const save = (version: number, p: Record<string, unknown>, id = inv, owner = OWNER) =>
  commit<Record<string, unknown>>('seating_save', [id, owner, version, JSON.stringify(p)]);

async function guest(name: string, party: number | null, group: string | null = null, invitation = inv) {
  return (
    await one<{ id: string }>(
      `insert into invitation_guests (invitation_id, name, party_size, group_name, token)
       values ($1, $2, $3, $4, $5) returning id`,
      [invitation, name, party, group, `tok_${Math.random().toString(36).slice(2).padEnd(16, 'x')}`],
    )
  ).id;
}
async function reply(
  {
    attending,
    adults,
    children = 0,
    name,
    guestId = null,
  }: { attending: boolean; adults: number; children?: number; name: string; guestId?: string | null },
  people: [string, string][] = [],
) {
  const r = await one<{ id: string }>(
    `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, guest_id)
     values ($1, $2, 'he', $3, $4, $5, $6, $7) returning id`,
    [inv, attending, name, adults, children, `h-${Math.random()}`, guestId],
  );
  for (const [i, [first, last]] of people.entries())
    await c.query(
      `insert into rsvp_attendees (response_id, kind, position, first_name, last_name) values ($1, 'adult', $2, $3, $4)`,
      [r.id, i, first, last],
    );
  return r.id;
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
       ($1, 'owner@example.com', 'scrypt:x:y', '{}'), ($2, 'other@example.com', 'scrypt:x:y', '{}'),
       ($3, 'venue-customer@example.com', '', $4)`,
    [OWNER, OTHER, PARTNER_USER, { provider: 'email', providers: ['email'], provisioned_by: P }],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'seating-db', doc])
  ).id;
  other = (
    await commit<{ id: string }>('create_invitation', [
      OTHER,
      'sahar-bordeaux',
      'wedding',
      'seating-other',
      doc,
    ])
  ).id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('units: families that sit together', () => {
  it('a guest on the list is a unit (seated by party size until they reply); a reply without a guest is one once it says coming', async () => {
    const cohen = await guest('משפחת כהן', 4, 'עבודה');
    await guest('דני לוי', null);
    await reply({ attending: true, adults: 2, children: 1, guestId: cohen, name: 'רותי כהן' }, [
      ['רותי', 'כהן'],
      ['דני', 'כהן'],
    ]);
    await reply({ attending: true, adults: 1, name: 'יעל מזרחי' });
    await reply({ attending: false, adults: 0, name: 'לא מגיע' });
    const s = await state();
    expect(s.units.map((u) => [u.name, u.status, u.seats]).sort()).toEqual(
      [
        ['דני לוי', 'pending', 1],
        ['יעל מזרחי', 'confirmed', 1],
        ['משפחת כהן', 'confirmed', 3],
      ].sort(),
    );
    expect(unitOf(s, 'משפחת כהן')).toMatchObject({ group: 'עבודה', people: ['רותי כהן', 'דני כהן'] });
    // stable: loading again adds nothing
    expect((await state()).units.map((u) => u.id).sort()).toEqual(s.units.map((u) => u.id).sort());
  });

  it('a guest who answers again: the unit follows the latest reply (declined: no seat)', async () => {
    const levi = (await state()).units.find((u) => u.name === 'דני לוי')!;
    await reply({ attending: false, adults: 0, guestId: levi.guestId, name: 'דני לוי' });
    expect(unitOf(await state(), 'דני לוי')).toMatchObject({ id: levi.id, status: 'declined', seats: 0 });
  });

  it('a reply linked to its guest after the fact merges into the guest’s unit, with its seat', async () => {
    const guestId = await guest('משפחת פרץ', 5);
    const replyId = await reply({ attending: true, adults: 2, name: 'אבי פרץ' });
    let s = await state();
    const replyUnit = unitOf(s, 'אבי פרץ');
    const guestUnit = unitOf(s, 'משפחת פרץ');
    expect(guestUnit.status).toBe('pending');
    const saved = await save(
      s.layout.version,
      plan({ tables: [table(T1, 1)], assignments: [{ unitId: replyUnit.id, tableId: T1 }] }),
    );
    expect(saved).toMatchObject({ ok: true });
    // the guest answered again from their personal link: the reply is theirs now
    await c.query(`update rsvp_responses set guest_id = $1 where id = $2`, [guestId, replyId]);
    s = await state();
    expect(s.units.find((u) => u.id === replyUnit.id)).toBeUndefined();
    expect(unitOf(s, 'משפחת פרץ')).toMatchObject({ id: guestUnit.id, status: 'confirmed', seats: 2 });
    expect(s.assignments).toContainEqual({ unitId: guestUnit.id, tableId: T1, source: 'host' });
  });

  it('a guest removed from the list stays seated by their reply; neither left: the unit is gone', async () => {
    let s = await state();
    const perez = unitOf(s, 'משפחת פרץ');
    await c.query(`delete from invitation_guests where id = $1`, [perez.guestId]);
    s = await state();
    expect(s.units.find((u) => u.id === perez.id)).toMatchObject({
      guestId: null,
      name: 'אבי פרץ',
      status: 'confirmed',
    });
    await c.query(`delete from rsvp_responses where primary_name = 'אבי פרץ'`);
    s = await state();
    expect(s.units.find((u) => u.id === perez.id)).toBeUndefined();
    expect(s.assignments.find((a) => a.unitId === perez.id)).toBeUndefined();
  });

  it('someone else’s event: nothing', async () => {
    expect(await state(inv, OTHER)).toBeNull();
    expect(await save(0, plan(), inv, OTHER)).toBeNull();
  });
});

describe('saving the plan', () => {
  it('saves on top of its version only; the stale one is told the version now stored', async () => {
    const s = await state();
    const v = s.layout.version;
    const first = await save(v, plan({ tables: [table(T1, 1), table(T2, 2, 4)] }));
    expect(first).toMatchObject({ ok: true, version: v + 1 });
    expect(await save(v, plan())).toEqual({ ok: false, code: 'conflict', version: v + 1 });
  });

  it('never gives a table more people than seats — but a table that grew by itself isn’t refused', async () => {
    let s = await state();
    const cohen = unitOf(s, 'משפחת כהן'); // 3
    const yael = unitOf(s, 'יעל מזרחי'); // 1
    const tables = [table(T1, 1), table(T2, 2, 4)];
    const ok = await save(
      s.layout.version,
      plan({
        tables,
        assignments: [
          { unitId: cohen.id, tableId: T2 },
          { unitId: yael.id, tableId: T2 },
        ],
      }),
    );
    expect(ok).toMatchObject({ ok: true });
    s = await state();
    // one more seat than the table has, or fewer seats than people seated: refused, nothing written
    const levi = await guest('משפחת לוי', 2);
    s = await state();
    const leviUnit = s.units.find((u) => u.guestId === levi)!;
    const over = await save(
      s.layout.version,
      plan({ tables, assignments: [cohen, yael, leviUnit].map((u) => ({ unitId: u.id, tableId: T2 })) }),
    );
    expect(over).toEqual({ ok: false, code: 'over_capacity', table: 2 });
    expect(
      await save(
        s.layout.version,
        plan({
          tables: [table(T1, 1), table(T2, 2, 3)],
          assignments: [cohen, yael].map((u) => ({ unitId: u.id, tableId: T2 })),
        }),
      ),
    ).toEqual({ ok: false, code: 'over_capacity', table: 2 });
    expect((await state()).layout.version).toBe(s.layout.version);
    // Cohen's reply grows to 4 after they were seated: table 2 is over, and an unrelated save still goes
    await c.query(`update rsvp_responses set adults_count = 3 where guest_id = $1`, [cohen.guestId]);
    s = await state();
    const unrelated = await save(
      s.layout.version,
      plan({
        tables: [table(T1, 1, 8), table(T2, 2, 4)],
        assignments: [cohen, yael].map((u) => ({ unitId: u.id, tableId: T2 })),
      }),
    );
    expect(unrelated).toMatchObject({ ok: true });
  });

  it('tables: numbers can swap; a table left out is only marked removed; another event’s ids are refused', async () => {
    let s = await state();
    const swapped = await save(s.layout.version, plan({ tables: [table(T1, 2, 8), table(T2, 1, 4)] }));
    expect(swapped).toMatchObject({ ok: true });
    s = await state();
    expect(s.tables.map((t) => [t.id, t.number])).toEqual([
      [T2, 1],
      [T1, 2],
    ]);
    await save(s.layout.version, plan({ tables: [table(T1, 2, 8)] }));
    expect(
      await one(`select number, deleted_at is not null as removed from seating_tables where id = $1`, [T2]),
    ).toEqual({
      number: 1,
      removed: true,
    });
    // a new table may take the removed one's number; the removed one keeps it on record
    s = await state();
    expect(await save(s.layout.version, plan({ tables: [table(T1, 2, 8), table(T3, 1)] }))).toMatchObject({
      ok: true,
    });
    // the other event's table id, a number twice, a seat at a table that isn't in the plan: refused
    const theirs = 'bbbbbbbb-0000-4000-8000-000000000001';
    await save(0, plan({ tables: [table(theirs, 1)] }), other, OTHER);
    s = await state();
    expect(await save(s.layout.version, plan({ tables: [table(theirs, 5)] }))).toMatchObject({
      ok: false,
      code: 'invalid',
      reason: 'foreign_id',
    });
    expect(await save(s.layout.version, plan({ tables: [table(T1, 1), table(T3, 1)] }))).toMatchObject({
      ok: false,
      reason: 'duplicate_table',
    });
    const cohen = unitOf(s, 'משפחת כהן');
    expect(
      await save(
        s.layout.version,
        plan({ tables: [table(T1, 1)], assignments: [{ unitId: cohen.id, tableId: T3 }] }),
      ),
    ).toMatchObject({
      ok: false,
      reason: 'unknown_table',
    });
    // the other event's table is untouched
    expect(await one(`select invitation_id, number from seating_tables where id = $1`, [theirs])).toEqual({
      invitation_id: other,
      number: 1,
    });
  });

  it('a plan file must be the host’s own upload (or their venue’s); units’ settings and rules are saved', async () => {
    let s = await state();
    const bg = (path: string) =>
      layout({
        background: { path, type: 'image/png', width: 2000, height: 1000 },
        metersPerPixel: 0.02,
        source: 'upload',
      });
    expect(await save(s.layout.version, plan({ layout: bg(`${OTHER}/${other}/x.png`) }))).toMatchObject({
      ok: false,
      reason: 'background',
    });
    expect(
      await save(
        s.layout.version,
        plan({ layout: bg(`${OWNER}/${inv}/plan.png`), tables: [table(T1, 1, 8)] }),
      ),
    ).toMatchObject({ ok: true });
    s = await state();
    expect(s.layout).toMatchObject({
      background: { path: `${OWNER}/${inv}/plan.png`, width: 2000 },
      metersPerPixel: 0.02,
      source: 'upload',
    });
    const cohen = unitOf(s, 'משפחת כהן');
    const yael = unitOf(s, 'יעל מזרחי');
    const rule = 'cccccccc-0000-4000-8000-000000000001';
    expect(
      await save(
        s.layout.version,
        plan({
          layout: bg(`${OWNER}/${inv}/plan.png`),
          tables: [table(T1, 1, 8)],
          units: [{ id: yael.id, category: 'צבא', stage: 1, dance: -1, exit: 0, accessible: true }],
          constraints: [
            { id: rule, kind: 'apart', a: cohen.id, b: yael.id, hard: false },
            // a unit that no longer exists: skipped, not an error
            {
              id: 'cccccccc-0000-4000-8000-000000000002',
              kind: 'together',
              a: cohen.id,
              b: '00000000-0000-4000-8000-000000000000',
              hard: true,
            },
          ],
        }),
      ),
    ).toMatchObject({ ok: true });
    s = await state();
    expect(s.constraints).toEqual([{ id: rule, kind: 'apart', a: cohen.id, b: yael.id, hard: false }]);
    expect(
      await one(`select category, pref_stage, pref_dance, accessible from seating_units where id = $1`, [
        yael.id,
      ]),
    ).toEqual({
      category: 'צבא',
      pref_stage: 1,
      pref_dance: -1,
      accessible: true,
    });
  });
});

describe('the partner’s venues', () => {
  const planJson = (path: string) => ({
    path,
    contentType: 'image/png',
    width: 3000,
    height: 2000,
    bytes: 12345,
  });

  it('creates a venue (a name needed), updates only what is sent, and says which plan it replaced', async () => {
    expect(await commit('partner_venue_put', [P, 'hall-17', ['address'], null, 'x', null, null])).toEqual({
      ok: false,
      code: 'name_required',
    });
    const created = await commit<Record<string, unknown>>('partner_venue_put', [
      P,
      'hall-17',
      ['name', 'widthMeters', 'floorPlan'],
      'אולמי הגן',
      null,
      36,
      JSON.stringify(planJson('venues/h/one.png')),
    ]);
    expect(created).toMatchObject({
      ok: true,
      created: true,
      replacedPlan: null,
      venue: {
        venueId: 'hall-17',
        name: 'אולמי הגן',
        widthMeters: 36,
        users: 0,
        floorPlan: { path: 'venues/h/one.png', width: 3000 },
      },
    });
    const renamed = await commit<Record<string, unknown>>('partner_venue_put', [
      P,
      'hall-17',
      ['address'],
      null,
      'הרצל 1',
      null,
      null,
    ]);
    expect(renamed).toMatchObject({
      created: false,
      venue: { name: 'אולמי הגן', address: 'הרצל 1', widthMeters: 36 },
    });
    // another partner doesn't see it
    expect(await commit('partner_venue_get', ['partner:other', 'hall-17'])).toBeNull();
    expect(await commit('partner_venue_get', [P, 'hall-17'])).toMatchObject({ venueId: 'hall-17' });
  });

  it('links the partner’s own users to its venues — never someone else’s user or a venue that isn’t there', async () => {
    await commit('account_link_partner', [PARTNER_USER, P, 'be-1', 'לקוחה', null, true]);
    expect(await commit('partner_user_venue_set', [P, OWNER, 'hall-17'])).toBeNull();
    expect(await commit('partner_user_venue_set', [P, PARTNER_USER, 'nope'])).toEqual({
      ok: false,
      code: 'venue_not_found',
    });
    expect(await commit('partner_user_venue_set', [P, PARTNER_USER, 'hall-17'])).toEqual({
      ok: true,
      venueId: 'hall-17',
    });
    expect(await commit('partner_user_venue', [P, PARTNER_USER])).toBe('hall-17');
    expect(await commit('partner_venue_get', [P, 'hall-17'])).toMatchObject({ users: 1 });
  });

  it('the linked user’s seating starts from the venue’s plan (scale from its width); a new plan reaches new events', async () => {
    const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
    const mine = (
      await commit<{ id: string }>('create_invitation', [
        PARTNER_USER,
        'sahar-bordeaux',
        'wedding',
        'venue-event',
        doc,
      ])
    ).id;
    const s = await state(mine, PARTNER_USER);
    expect(s.layout).toMatchObject({
      source: 'partner',
      venuePlan: 'venues/h/one.png',
      background: { path: 'venues/h/one.png', type: 'image/png', width: 3000, height: 2000 },
      metersPerPixel: 0.012,
    });
    expect(s.venue).toMatchObject({ name: 'אולמי הגן', widthMeters: 36, plan: { path: 'venues/h/one.png' } });
    // the venue sends a new plan: the old one is still used by that event (not deleted); a new event gets the new one
    const replaced = await commit<Record<string, unknown>>('partner_venue_put', [
      P,
      'hall-17',
      ['floorPlan'],
      null,
      null,
      null,
      JSON.stringify(planJson('venues/h/two.png')),
    ]);
    expect(replaced).toMatchObject({
      replacedPlan: null,
      venue: { floorPlan: { path: 'venues/h/two.png' } },
    });
    expect((await state(mine, PARTNER_USER)).layout).toMatchObject({
      background: { path: 'venues/h/one.png' },
    });
    const next = (
      await commit<{ id: string }>('create_invitation', [
        PARTNER_USER,
        'sahar-bordeaux',
        'wedding',
        'venue-event-2',
        doc,
      ])
    ).id;
    expect((await state(next, PARTNER_USER)).layout).toMatchObject({
      background: { path: 'venues/h/two.png' },
    });
    // the host removes the plan: it stays removed
    const v = (await state(next, PARTNER_USER)).layout.version;
    expect(await save(v, plan({ layout: layout({ source: 'none' }) }), next, PARTNER_USER)).toMatchObject({
      ok: true,
    });
    expect((await state(next, PARTNER_USER)).layout).toMatchObject({ background: null, source: 'none' });
    // …and can take the venue's plan again (its path is accepted as theirs)
    const v2 = (await state(next, PARTNER_USER)).layout.version;
    const again = layout({
      background: { path: 'venues/h/two.png', type: 'image/png', width: 3000, height: 2000 },
      metersPerPixel: 0.012,
      source: 'partner',
      venuePlan: 'venues/h/two.png',
    });
    expect(await save(v2, plan({ layout: again }), next, PARTNER_USER)).toMatchObject({ ok: true });
    expect((await state(next, PARTNER_USER)).layout).toMatchObject({
      source: 'partner',
      venuePlan: 'venues/h/two.png',
    });
    // once no event uses the first plan, replacing it says so (the server deletes the file)
    await c.query(
      `update venue_layouts set background_path = null, background_type = null, source = 'none' where invitation_id = $1`,
      [mine],
    );
    const third = await commit<Record<string, unknown>>('partner_venue_put', [
      P,
      'hall-17',
      ['floorPlan'],
      null,
      null,
      null,
      JSON.stringify(planJson('venues/h/three.png')),
    ]);
    expect(third).toMatchObject({ replacedPlan: null });
    await c.query(
      `update venue_layouts set background_path = null, background_type = null, source = 'none' where invitation_id = $1`,
      [next],
    );
    const fourth = await commit<Record<string, unknown>>('partner_venue_put', [
      P,
      'hall-17',
      ['floorPlan'],
      null,
      null,
      null,
      null,
    ]);
    expect(fourth).toMatchObject({ replacedPlan: 'venues/h/three.png', venue: { floorPlan: null } });
  });
});

describe('privileges', () => {
  it('only the service role may call the functions; the tables are closed to everyone else', async () => {
    const calls = [
      [`select public.seating_state($1, $2)`, [inv, OWNER]],
      [`select public.seating_save($1, $2, 0, '{}'::jsonb)`, [inv, OWNER]],
      [`select public.seating_sync_units($1)`, [inv]],
      [`select * from public.seating_unit_rows($1)`, [inv]],
      [`select public.partner_venue_get('x', 'y')`, []],
      [`select public.partner_venue_put('x', 'y', '{}', null, null, null, null)`, []],
      [`select public.partner_user_venue_set('x', $1, null)`, [OWNER]],
      [`select public.partner_user_venue('x', $1)`, [OWNER]],
    ] as const;
    for (const role of ['anon', 'authenticated'] as const) {
      for (const [sql, args] of calls) {
        await expect(
          as(c, role, OWNER, () => c.query(sql, [...args])),
          `${role}: ${sql}`,
        ).rejects.toThrow(/permission denied/);
      }
      for (const t of [
        'venue_layouts',
        'seating_tables',
        'seating_units',
        'seat_assignments',
        'seating_constraints',
        'partner_venues',
        'partner_venue_users',
      ])
        await expect(
          as(c, role, OWNER, () => c.query(`select * from public.${t}`)),
          `${role}: ${t}`,
        ).rejects.toThrow(/permission denied/);
    }
    expect(await call('seating_state', [inv, OWNER])).toMatchObject({ layout: expect.any(Object) });
    const rls = await c.query(`select relname from pg_class where relname = any($1) and relrowsecurity`, [
      [
        'venue_layouts',
        'seating_tables',
        'seating_units',
        'seat_assignments',
        'seating_constraints',
        'partner_venues',
        'partner_venue_users',
      ],
    ]);
    expect(rls.rowCount).toBe(7);
    const bucket = await one(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'venue-plans'`,
    );
    expect(bucket).toEqual({
      public: true,
      file_size_limit: '15728640',
      allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    });
  });
});

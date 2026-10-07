import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Who is coming, one truth from the list to the tables (supabase/migrations/*_guest_answers.sql): a
// reply counts at most the guest's invitation (the rest waits as a request), the host can set an answer
// by hand, a party size never drops below what was confirmed, a family answering again is never counted
// twice, the seating's units follow every change at once, and a family that declined is never sent its
// table number.

const OWNER = '91919191-9191-4919-8919-919191919191';
const OTHER = '92929292-9292-4929-8929-929292929292';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let n = 0;

const call = async <T = unknown>(fn: string, args: unknown[]): Promise<T> =>
  as(c, 'service_role', null, async () => {
    const params = args.map((_, i) => `$${i + 1}`).join(', ');
    return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r as T;
  });
const commit = async <T = unknown>(fn: string, args: unknown[]): Promise<T> => {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r as T;
};

async function guest(name: string, partySize: number | null, phone: string | null = null): Promise<string> {
  n++;
  const r = await c.query(
    `insert into invitation_guests (invitation_id, name, party_size, phone, token)
     values ($1, $2, $3, $4, $5) returning id`,
    [inv, name, partySize, phone, `tok-${String(n).padStart(16, '0')}`],
  );
  return r.rows[0].id as string;
}

const person = (kind: 'adult' | 'child', position: number) => ({
  kind,
  position,
  first_name: `${kind}${position}`,
  last_name: null,
  full_name: null,
  age: kind === 'child' ? 5 : null,
  phone: null,
  email: null,
  dietary: [],
  dietary_notes: null,
});

/** a guest's reply through the form: `adults`, `children`, for a guest (personal link) or by phone */
async function reply(o: {
  guestId?: string | null;
  phone?: string | null;
  attending?: boolean;
  adults?: number;
  children?: number;
  extra?: number;
  name?: string;
}) {
  const adults = o.attending === false ? 0 : (o.adults ?? 1);
  const children = o.attending === false ? 0 : (o.children ?? 0);
  return commit<{ id: string; replaced: boolean }>('submit_rsvp', [
    inv,
    JSON.stringify({
      attending: o.attending ?? true,
      locale: 'he',
      primary_name: o.name ?? 'אורח',
      phone: o.phone ?? null,
      email: null,
      adults_count: adults,
      children_count: children,
      message: null,
      answers: {},
      ip_hash: null,
      guest_id: o.guestId ?? null,
      ...(o.extra ? { extra_requested: o.extra } : {}),
    }),
    JSON.stringify([
      ...Array.from({ length: adults }, (_, i) => person('adult', i)),
      ...Array.from({ length: children }, (_, i) => person('child', i)),
    ]),
    null,
    `h-${++n}`,
  ]);
}

const latest = async (guestId: string) =>
  (
    await c.query(
      `select id, attending, adults_count, children_count, extra_requested, source,
              (select count(*) from rsvp_attendees a where a.response_id = r.id)::int as people
       from rsvp_responses r where guest_id = $1 order by updated_at desc`,
      [guestId],
    )
  ).rows;
const partyOf = async (guestId: string) =>
  (await c.query(`select party_size from invitation_guests where id = $1`, [guestId])).rows[0].party_size as
    number | null;
const unitOf = async (guestId: string) =>
  (await c.query(`select id, response_id from seating_units where guest_id = $1`, [guestId])).rows[0] as
    { id: string; response_id: string | null } | undefined;

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(`insert into auth.users (id, email) values ($1, 'ga@example.com'), ($2, 'gb@example.com')`, [
    OWNER,
    OTHER,
  ]);
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await c.query(
      `select public.create_invitation($1, 'sahar-bordeaux', 'wedding', 'guest-answers', $2) as r`,
      [OWNER, doc],
    )
  ).rows[0].r.id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('a reply counts at most the guest’s invitation', () => {
  it('beyond the party size: children first, then adults, kept as a request; their details dropped', async () => {
    const g = await guest('משפחת כהן', 2);
    await reply({ guestId: g, adults: 2, children: 2 });
    const [r] = await latest(g);
    expect(r).toMatchObject({ attending: true, adults_count: 2, children_count: 0, extra_requested: 2 });
    expect(r.people).toBe(2);
  });

  it('the form’s own request is added to it; a "no" asks for nothing', async () => {
    const g = await guest('משפחת לוי', 3);
    await reply({ guestId: g, adults: 3, extra: 1 });
    expect((await latest(g))[0]).toMatchObject({ adults_count: 3, extra_requested: 1 });
    await reply({ guestId: g, attending: false });
    expect((await latest(g))[0]).toMatchObject({ attending: false, adults_count: 0, extra_requested: null });
  });

  it('a guest without a party size, or the general link without a guest: no limit from the list', async () => {
    const g = await guest('בלי מספר', null);
    await reply({ guestId: g, adults: 5 });
    expect((await latest(g))[0]).toMatchObject({ adults_count: 5, extra_requested: null });
  });
});

describe('a family answering again is never counted twice', () => {
  it('through the general link, the phone of a guest who already answered replaces their reply', async () => {
    const g = await guest('משפחת פרץ', 4, '+972501234567');
    await reply({ guestId: g, adults: 2 });
    await reply({ phone: '+972501234567', adults: 3 });
    const rows = await latest(g);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ adults_count: 3 });
    const unlinked = await c.query(
      `select count(*)::int as n from rsvp_responses where invitation_id = $1 and guest_id is null and phone = '+972501234567'`,
      [inv],
    );
    expect(unlinked.rows[0].n).toBe(0);
  });
});

describe('the host sets an answer by hand', () => {
  it('coming: as many as the guest was invited with by default — more invites them with that many', async () => {
    const g = await guest('משפחת מזרחי', 2);
    const r = await commit<{ ok: boolean; guest: { partySize: number; response: { source: string } } }>(
      'owner_set_response',
      [inv, OWNER, g, true, 3],
    );
    expect(r.ok).toBe(true);
    expect(r.guest.partySize).toBe(3);
    expect(r.guest.response.source).toBe('host');
    expect((await latest(g))[0]).toMatchObject({ attending: true, adults_count: 3, source: 'host' });
  });

  it('not coming; and "no answer" takes back only an answer the host set', async () => {
    const g = await guest('משפחת ביטון', 2);
    await commit('owner_set_response', [inv, OWNER, g, false, null]);
    expect((await latest(g))[0]).toMatchObject({ attending: false, adults_count: 0, source: 'host' });
    expect((await commit<{ ok: boolean }>('owner_set_response', [inv, OWNER, g, null, null])).ok).toBe(true);
    expect(await latest(g)).toHaveLength(0);
    // the guest's own answer stays
    await reply({ guestId: g, adults: 1 });
    expect(await commit('owner_set_response', [inv, OWNER, g, null, null])).toEqual({
      ok: false,
      code: 'guest_reply',
    });
  });

  it('over the guest’s own reply: their people beyond the new number go, the request is settled', async () => {
    const g = await guest('משפחת אזולאי', 3);
    await reply({ guestId: g, adults: 2, children: 1, extra: 2 });
    await commit('owner_set_response', [inv, OWNER, g, true, 2]);
    expect((await latest(g))[0]).toMatchObject({
      adults_count: 1,
      children_count: 1,
      extra_requested: null,
      source: 'host',
      people: 2,
    });
  });

  it("only the owner's; a count out of range is refused", async () => {
    const g = await guest('אחר', 2);
    expect(await call('owner_set_response', [inv, OTHER, g, true, 2])).toBeNull();
    expect(await call('owner_set_response', [inv, OWNER, g, true, 0])).toEqual({
      ok: false,
      code: 'invalid',
    });
  });
});

describe('a request to bring more', () => {
  it('approved: the guest is invited with them and they count', async () => {
    const g = await guest('משפחת חדד', 2);
    await reply({ guestId: g, adults: 2, extra: 2 });
    await commit('owner_extra_decision', [inv, OWNER, g, true]);
    expect(await partyOf(g)).toBe(4);
    expect((await latest(g))[0]).toMatchObject({ adults_count: 4, extra_requested: null });
  });

  it('declined: the request goes, the count stays', async () => {
    const g = await guest('משפחת עמר', 2);
    await reply({ guestId: g, adults: 2, extra: 1 });
    await commit('owner_extra_decision', [inv, OWNER, g, false]);
    expect(await partyOf(g)).toBe(2);
    expect((await latest(g))[0]).toMatchObject({ adults_count: 2, extra_requested: null });
    expect(await commit('owner_extra_decision', [inv, OWNER, g, true])).toEqual({
      ok: false,
      code: 'nothing',
    });
  });
});

describe('a party size never drops below the people confirmed', () => {
  it('the edit is refused with that number; any other write keeps it at least that', async () => {
    const g = await guest('משפחת גבאי', 4);
    await reply({ guestId: g, adults: 3 });
    expect(await commit('update_guest', [inv, OWNER, g, 'משפחת גבאי', null, null, 2, null])).toEqual({
      ok: false,
      code: 'below_confirmed',
      confirmed: 3,
    });
    await c.query(`update invitation_guests set party_size = 1 where id = $1`, [g]);
    expect(await partyOf(g)).toBe(3);
    // a guest who declined can be invited with fewer
    await reply({ guestId: g, attending: false });
    await c.query(`update invitation_guests set party_size = 1 where id = $1`, [g]);
    expect(await partyOf(g)).toBe(1);
  });
});

describe('the seating follows every change at once', () => {
  it('a new reply is the guest’s unit’s reply — without opening the seating first', async () => {
    const g = await guest('משפחת שמש', 2);
    expect(await unitOf(g)).toMatchObject({ response_id: null });
    await reply({ guestId: g, adults: 2 });
    const [r] = await latest(g);
    expect((await unitOf(g))!.response_id).toBe(r.id);
  });

  it('a reply moved from one guest to another: both units follow (the sync no longer fails)', async () => {
    const a = await guest('ראשון', 2);
    const b = await guest('שני', 2);
    await reply({ guestId: a, adults: 1 });
    const [r] = await latest(a);
    await commit('owner_link_response', [inv, OWNER, r.id, null]);
    await commit('owner_link_response', [inv, OWNER, r.id, b]);
    expect((await unitOf(a))!.response_id).toBeNull();
    expect((await unitOf(b))!.response_id).toBe(r.id);
    // and the sync still works after it: a new guest gets a unit
    const later = await guest('שלישי', 1);
    expect(await unitOf(later)).toBeDefined();
  });
});

describe('a family that declined is never sent its table number', () => {
  it('not a candidate (so never queued, never charged)', async () => {
    const g = await guest('משפחת נחום', 2, '+972521112233');
    await reply({ guestId: g, adults: 2 });
    const unit = (await unitOf(g))!.id;
    const table = (
      await c.query(
        `insert into seating_tables (invitation_id, number, shape, capacity, x, y, w, h)
         values ($1, 7, 'round', 10, 5, 5, 1.8, 1.8) returning id`,
        [inv],
      )
    ).rows[0].id;
    await c.query(`insert into seat_assignments (unit_id, invitation_id, table_id) values ($1, $2, $3)`, [
      unit,
      inv,
      table,
    ]);
    const cands = async () =>
      (await c.query(`select unit_id from seating_notice_candidates($1, $2)`, [inv, [unit]])).rows;
    expect(await cands()).toHaveLength(1);
    await reply({ guestId: g, attending: false });
    expect(await cands()).toHaveLength(0);
  });
});

describe('the list card counts guests who answered', () => {
  it('"answered" is guests with a reply of their own; requests to bring more are counted', async () => {
    const list = await call<{ id: string; answered: number; guests: number; extraRequests: number }[]>(
      'owner_invitations',
      [OWNER],
    );
    const item = list.find((x) => x.id === inv)!;
    const answered = (
      await c.query(
        `select count(*)::int as n from invitation_guests g where g.invitation_id = $1
         and exists (select 1 from rsvp_responses r where r.guest_id = g.id)`,
        [inv],
      )
    ).rows[0].n;
    expect(item.answered).toBe(answered);
    expect(item.answered).toBeLessThanOrEqual(item.guests);
    expect(item.extraRequests).toBeGreaterThanOrEqual(1);
  });
});

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// One count of RSVPs (supabase/migrations/*_rsvp_link_guest.sql): the dashboard's replies say whose guest
// each is, and a general-link reply can be matched to a guest on the list (owner only, one reply a guest).

const OWNER_A = '77777777-7777-4777-8777-777777777777';
const OWNER_B = '88888888-8888-4888-8888-888888888888';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let guest1: string;
let guest2: string;
let generalReply: string;
let personalReply: string;

const call = <T = unknown>(fn: string, args: unknown[]): Promise<T> =>
  as(c, 'service_role', null, async () => {
    const params = args.map((_, i) => `$${i + 1}`).join(', ');
    return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r as T;
  });

// a write that stays (`call` rolls back: the read-only checks)
const commit = async <T = unknown>(fn: string, args: unknown[]): Promise<T> => {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r as T;
};

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(`insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com')`, [
    OWNER_A,
    OWNER_B,
  ]);
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await c.query(`select public.create_invitation($1, 'sahar-bordeaux', 'wedding', 'link-a', $2) as r`, [
      OWNER_A,
      doc,
    ])
  ).rows[0].r.id;
  const g = await c.query(
    `insert into invitation_guests (invitation_id, name, token) values ($1, 'אבי סבבה', 'tok-aaaaaaaaaaaaaaaa'), ($1, 'דנה', 'tok-bbbbbbbbbbbbbbbb') returning id`,
    [inv],
  );
  [guest1, guest2] = g.rows.map((r) => r.id as string) as [string, string];
  const r = await c.query(
    `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, edit_token_hash, guest_id)
     values ($1, true, 'he', 'אבי סבבה', 2, 'h1', null), ($1, true, 'he', 'דנה', 1, 'h2', $2) returning id`,
    [inv, guest2],
  );
  [generalReply, personalReply] = r.rows.map((x) => x.id as string) as [string, string];
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('owner_responses says whose guest each reply is', () => {
  it('guestId: null for the general link, the guest for a personal one', async () => {
    const res = await call<{ responses: { id: string; guestId: string | null }[] }>('owner_responses', [
      inv,
      OWNER_A,
    ]);
    const byId = Object.fromEntries(res.responses.map((x) => [x.id, x.guestId]));
    expect(byId[generalReply]).toBeNull();
    expect(byId[personalReply]).toBe(guest2);
  });
});

describe('owner_link_response', () => {
  it("is the owner's only", async () => {
    expect(await call('owner_link_response', [inv, OWNER_B, generalReply, guest1])).toBeNull();
  });
  it('refuses a guest who already has a reply of their own', async () => {
    expect(await call('owner_link_response', [inv, OWNER_A, generalReply, guest2])).toBe('taken');
  });
  it('matches the reply to the guest, and the guest list shows it', async () => {
    expect(await commit('owner_link_response', [inv, OWNER_A, generalReply, guest1])).toBe('ok');
    const guests = await call<{ id: string; response: { id: string } | null }[]>('owner_guests', [
      inv,
      OWNER_A,
    ]);
    expect(guests.find((x) => x.id === guest1)?.response?.id).toBe(generalReply);
  });
  it('unmatches with a null guest', async () => {
    expect(await commit('owner_link_response', [inv, OWNER_A, generalReply, null])).toBe('ok');
    const guests = await call<{ id: string; response: unknown }[]>('owner_guests', [inv, OWNER_A]);
    expect(guests.find((x) => x.id === guest1)?.response).toBeNull();
  });
});

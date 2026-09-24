import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_OWNER_ID } from '../../scripts/seed';
import { as, createTestDatabase } from './harness';

// Guest list & WhatsApp fixes (supabase/migrations/*_guests_whatsapp_fixes.sql): re-imports without
// phones, "add a guest", replies that stay with their guest, the site's samples, retries that wait,
// refunds for what Meta never delivered, the do-not-send list.

const OWNER = '99999999-9999-4999-8999-999999999999';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;

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
let tokens = 0;
const token = () => `fix${String(++tokens).padStart(4, '0')}-abcdefghijklmnop`;
const row = (name: string, phone: string | null = null, email: string | null = null) => ({
  name,
  phone,
  email,
  partySize: null,
  group: null,
  token: token(),
});
const reply = (name: string, phone: string | null, guestId: string | null = null) => ({
  attending: true,
  locale: 'he',
  primary_name: name,
  phone,
  email: null,
  adults_count: 1,
  children_count: 0,
  message: null,
  answers: {},
  ip_hash: null,
  guest_id: guestId,
});

type Guest = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  sendStatus: string;
  sendError: string | null;
  optedOut: boolean;
  retryAt: string | null;
  response: { id: string; attending: boolean } | null;
};
const guests = () => call<Guest[]>('owner_guests', [inv, OWNER]);
const byName = async (name: string) => (await guests()).find((g) => g.name === name)!;
const credits = async () => (await call<{ credits: number }>('account_get', [OWNER])).credits;
const refunds = async (messageId: string) =>
  (
    await c.query(
      `select count(*)::int as n from credit_ledger where reason = 'whatsapp_refund' and ref = $1`,
      [messageId],
    )
  ).rows[0].n as number;

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(`insert into auth.users (id, email) values ($1, 'fixes@example.com')`, [OWNER]);
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'fixes', doc])
  ).id;
  await commit('publish_invitation', [inv, OWNER]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('importing the same list again', () => {
  it('updates guests without a phone by their name (and email) instead of doubling them', async () => {
    const list = [
      row('Dana Levi'),
      row('Avi Cohen', null, 'avi@example.com'),
      row('Twin'),
      row('Twin'),
      row('Rina', '+972501110001'),
    ];
    expect(await commit('import_guests', [inv, OWNER, JSON.stringify(list), 500])).toEqual({
      added: 5,
      updated: 0,
      total: 5,
    });
    // the same file with a party size added, spelled a little differently
    const again = [
      { ...row('  dana   LEVI '), partySize: 2 },
      row('Avi Cohen', null, 'avi@example.com'),
      row('Twin'),
      row('Twin'),
      row('Rina', '+972501110001'),
    ];
    expect(await commit('import_guests', [inv, OWNER, JSON.stringify(again), 500])).toEqual({
      added: 0,
      updated: 5,
      total: 5,
    });
    const dana = (await guests()).find((g) => g.name.trim().toLowerCase().startsWith('dana'))!;
    expect(dana).toMatchObject({ phone: null });
    expect(
      (await c.query(`select party_size from invitation_guests where id = $1`, [dana.id])).rows[0],
    ).toEqual({ party_size: 2 });
    // someone else with the same name but another email is a new guest; a row without an email
    // matches the guest who has one
    const r = await commit('import_guests', [
      inv,
      OWNER,
      JSON.stringify([row('Avi Cohen', null, 'other@example.com'), row('Avi Cohen')]),
      500,
    ]);
    expect(r).toEqual({ added: 1, updated: 1, total: 6 });
  });
});

describe('adding a guest by hand', () => {
  it('refuses a phone already on the list, with the guest who has it — never renames them', async () => {
    const added = await commit<{ ok: boolean; guest: Guest }>('add_guest', [
      inv,
      OWNER,
      { ...row('Moshe', '+972501110002'), partySize: 3 },
      500,
    ]);
    expect(added).toMatchObject({ ok: true, guest: { name: 'Moshe', phone: '+972501110002' } });
    const rina = await byName('Rina');
    expect(await call('add_guest', [inv, OWNER, row('Someone Else', '+972501110001'), 500])).toEqual({
      ok: false,
      code: 'duplicate_phone',
      guest: { id: rina.id, name: 'Rina' },
    });
    expect((await byName('Rina')).name).toBe('Rina');
    // without a phone: always a new guest
    const n = (await guests()).length;
    await expect(call('add_guest', [inv, OWNER, row('Rina'), n])).rejects.toThrow(/guest_limit/);
    expect(await call('add_guest', [inv, OWNER, row('Rina'), n + 1])).toMatchObject({ ok: true });
    expect(
      await call('add_guest', ['00000000-0000-4000-8000-000000000000', OWNER, row('X'), 500]),
    ).toBeNull();
  });
});

describe('replies and guests', () => {
  it("a browser's edit token never moves another guest's reply to this guest", async () => {
    const rina = await byName('Rina');
    const moshe = await byName('Moshe');
    const first = await commit<{ id: string; replaced: boolean }>('submit_rsvp', [
      inv,
      reply('Rina', '+972501110001', rina.id),
      '[]',
      null,
      'fix-hash-rina',
    ]);
    // the same browser, Moshe's personal link, Rina's edit token
    const second = await commit<{ id: string; replaced: boolean }>('submit_rsvp', [
      inv,
      reply('Moshe', '+972501110002', moshe.id),
      '[]',
      'fix-hash-rina',
      'fix-hash-moshe',
    ]);
    expect(second.replaced).toBe(false);
    expect(second.id).not.toBe(first.id);
    const stored = (
      await c.query(
        `select id, guest_id, primary_name, edit_token_hash from rsvp_responses where id = any($1)`,
        [[first.id, second.id]],
      )
    ).rows;
    expect(stored).toEqual(
      expect.arrayContaining([
        { id: first.id, guest_id: rina.id, primary_name: 'Rina', edit_token_hash: 'fix-hash-rina' },
        { id: second.id, guest_id: moshe.id, primary_name: 'Moshe', edit_token_hash: 'fix-hash-moshe' },
      ]),
    );
    // Rina's own token still edits her reply in place
    const edit = await commit('submit_rsvp', [
      inv,
      reply('Rina L.', '+972501110001', rina.id),
      '[]',
      'fix-hash-rina',
      'fix-hash-unused',
    ]);
    expect(edit).toEqual({ id: first.id, replaced: true });
  });

  it('a reply through the general link finds its guest by phone — only one who has not answered', async () => {
    await commit('import_guests', [inv, OWNER, JSON.stringify([row('Yael', '+972501110003')]), 500]);
    const yael = await byName('Yael');
    const linked = await commit<{ id: string }>('submit_rsvp', [
      inv,
      reply('Yael Levi', '+972501110003'),
      '[]',
      null,
      'fix-hash-yael',
    ]);
    expect((await c.query(`select guest_id from rsvp_responses where id = $1`, [linked.id])).rows[0]).toEqual(
      {
        guest_id: yael.id,
      },
    );
    expect((await byName('Yael')).response).toMatchObject({ id: linked.id, attending: true });
    // Yael already answered: another reply with her phone stays on its own
    const other = await commit<{ id: string }>('submit_rsvp', [
      inv,
      reply('Her partner', '+972501110003'),
      '[]',
      null,
      'fix-hash-partner',
    ]);
    const stray = await commit<{ id: string }>('submit_rsvp', [
      inv,
      reply('Not on the list', '+972501119999'),
      '[]',
      null,
      'fix-hash-stray',
    ]);
    const rows = (
      await c.query(`select guest_id from rsvp_responses where id = any($1)`, [[other.id, stray.id]])
    ).rows;
    expect(rows).toEqual([{ guest_id: null }, { guest_id: null }]);
  });

  it('knows the site’s sample invitations (the RSVP route stores nothing for them)', async () => {
    const demo = (await c.query(`select id, owner_id from invitations where slug = 'noa-and-itay'`)).rows[0];
    expect(demo.owner_id).toBe(DEMO_OWNER_ID);
    expect(await call('invitation_is_demo', [demo.id])).toBe(true);
    expect(await call('invitation_is_demo', [inv])).toBe(false);
    // the owner id in the migration is the seed's
    // (found by name: the file is renamed to the version production records when it's applied)
    const file = readdirSync('supabase/migrations').find((f) => f.endsWith('_guests_whatsapp_fixes.sql'))!;
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
    expect(sql).toContain(`'${DEMO_OWNER_ID}'::uuid`);
  });
});

describe('WhatsApp', () => {
  it('reaches Israeli mobiles only; other countries as they are', async () => {
    const capable = async (phone: string | null) => call<boolean>('whatsapp_capable', [phone]);
    expect(await capable('+972501234567')).toBe(true);
    expect(await capable('+97231234567')).toBe(false);
    expect(await capable('+97221234567')).toBe(false);
    expect(await capable('+972771234567')).toBe(false);
    expect(await capable('+442079460958')).toBe(true);
    expect(await capable(null)).toBe(false);
  });

  it('never charges for landlines, opted-out phones or — unless asked — guests who already have it', async () => {
    await commit('import_guests', [
      inv,
      OWNER,
      JSON.stringify([
        row('Landline', '+97231234567'),
        row('Stopped', '+972501110004'),
        row('Fresh', '+972501110005'),
      ]),
      500,
    ]);
    expect(await commit('whatsapp_opt_out', ['+972501110004', 'reply'])).toBe(true);
    expect(await commit('whatsapp_opt_out', ['+972501110004', 'meta'])).toBe(false);
    const list = await guests();
    const ids = (...names: string[]) => list.filter((g) => names.includes(g.name)).map((g) => g.id);
    expect((await byName('Stopped')).optedOut).toBe(true);
    expect((await byName('Fresh')).optedOut).toBe(false);

    // Rina replied (she has the invitation): skipped by default
    expect(
      await call('whatsapp_queue', [inv, OWNER, ids('Landline', 'Stopped', 'Rina'), 0.0353, false]),
    ).toEqual({
      ok: false,
      code: 'nobody',
      skipped: { landline: 1, optedOut: 1, received: 1 },
    });
    expect(await call('whatsapp_queue', [inv, OWNER, ids('Fresh', 'Rina'), 0.0353, false])).toEqual({
      ok: false,
      code: 'credits',
      needed: 1,
      balance: 0,
      skipped: { landline: 0, optedOut: 0, received: 1 },
    });
    await commit('credits_add', [OWNER, 10, 'admin', 'test']);
    expect(
      await commit('whatsapp_queue', [inv, OWNER, ids('Fresh', 'Rina', 'Landline'), 0.0353, true]),
    ).toEqual({
      ok: true,
      queued: 2,
      balance: 8,
      skipped: { landline: 1, optedOut: 0, received: 0 },
    });
    expect((await byName('Landline')).sendStatus).toBe('none');
    expect((await byName('Fresh')).sendStatus).toBe('queued');
  });

  it('a retry waits its turn; the page only counts what it can send now', async () => {
    const claimed = await commit<{ id: string; toPhone: string; attempts: number }[]>('whatsapp_claim', [
      inv,
      50,
    ]);
    expect(claimed).toHaveLength(2);
    expect(claimed[0]!.attempts).toBe(1);
    const [a, b] = claimed;
    expect(await commit('whatsapp_requeue', [a!.id, '130429 · rate limit', 60])).toBe(true);
    await commit('whatsapp_result', [b!.id, 'wamid.FIX-B', null]);
    expect(await commit('whatsapp_claim', [inv, 50])).toEqual([]);
    expect(await call('whatsapp_pending', [inv])).toBe(0);
    const waiting = await call<{ count: number; nextAt: string }>('whatsapp_waiting', [inv]);
    expect(waiting.count).toBe(1);
    expect(Date.parse(waiting.nextAt) - Date.now()).toBeGreaterThan(30_000);
    const guest = (await guests()).find((g) => g.phone === a!.toPhone)!;
    expect(guest).toMatchObject({ sendStatus: 'queued', retryAt: expect.any(String) });

    // its time comes: claimed again (second try)
    await c.query(
      `update whatsapp_messages set next_attempt_at = now() - interval '1 second' where id = $1`,
      [a!.id],
    );
    expect(await call('whatsapp_pending', [inv])).toBe(1);
    const [again] = await commit<{ id: string; attempts: number }[]>('whatsapp_claim', [inv, 50]);
    expect(again).toMatchObject({ id: a!.id, attempts: 2 });
    await commit('whatsapp_result', [a!.id, 'wamid.FIX-A', null]);
  });

  it('a send that may have reached Meta is never repeated: it fails as a timeout, refunded', async () => {
    const fresh = await byName('Fresh');
    // back to "not sent" for the test: queue it again (the host's "send again")
    await c.query(`update invitation_guests set send_status = 'failed' where id = $1`, [fresh.id]);
    await commit('whatsapp_queue', [inv, OWNER, [fresh.id], 0.0353, true]);
    const [m] = await commit<{ id: string }[]>('whatsapp_claim', [inv, 50]);
    // the sender died mid-call, on the first try
    await c.query(`update whatsapp_messages set claimed_at = now() - interval '11 minutes' where id = $1`, [
      m!.id,
    ]);
    const before = await credits();
    expect(await commit('whatsapp_claim', [inv, 50])).toEqual([]);
    expect(await credits()).toBe(before + 1);
    expect(await refunds(m!.id)).toBe(1);
    expect(await byName('Fresh')).toMatchObject({ sendStatus: 'failed', sendError: 'timeout' });
    expect(
      (await c.query(`select status, attempts from whatsapp_messages where id = $1`, [m!.id])).rows[0],
    ).toEqual({
      status: 'failed',
      attempts: 1,
    });
  });

  it('a phone that asks to stop after it was queued is not sent to (refunded)', async () => {
    const fresh = await byName('Fresh');
    await commit('whatsapp_queue', [inv, OWNER, [fresh.id], 0.0353, true]);
    await commit('whatsapp_opt_out', [fresh.phone, 'reply']);
    const before = await credits();
    expect(await commit('whatsapp_claim', [inv, 50])).toEqual([]);
    expect(await credits()).toBe(before + 1);
    expect(await byName('Fresh')).toMatchObject({
      sendStatus: 'failed',
      sendError: 'opted_out',
      optedOut: true,
    });
  });

  it('refunds what Meta reports as failed before delivery — once; 131050 goes on the do-not-send list', async () => {
    const [m] = (await c.query(`select id from whatsapp_messages where wa_message_id = 'wamid.FIX-B'`)).rows;
    const before = await credits();
    expect(await commit('whatsapp_status', ['wamid.FIX-B', 'failed', '131049 · healthy ecosystem'])).toBe(
      true,
    );
    expect(await commit('whatsapp_status', ['wamid.FIX-B', 'failed', '131049 · healthy ecosystem'])).toBe(
      true,
    );
    expect(await credits()).toBe(before + 1);
    expect(await refunds(m.id)).toBe(1);

    // delivered, then failed: Meta billed it — no refund
    expect(await commit('whatsapp_status', ['wamid.FIX-A', 'delivered', null])).toBe(true);
    expect(await commit('whatsapp_status', ['wamid.FIX-A', 'failed', 'late'])).toBe(true);
    expect(await credits()).toBe(before + 1);

    // a guest who turned off our messages
    await commit('import_guests', [inv, OWNER, JSON.stringify([row('Blocked', '+972501110006')]), 500]);
    const blocked = await byName('Blocked');
    await commit('whatsapp_queue', [inv, OWNER, [blocked.id], 0.0353, false]);
    const [b] = await commit<{ id: string }[]>('whatsapp_claim', [inv, 50]);
    await commit('whatsapp_result', [b!.id, 'wamid.FIX-C', null]);
    await commit('whatsapp_status', ['wamid.FIX-C', 'failed', '131050 · user stopped marketing messages']);
    expect(await byName('Blocked')).toMatchObject({ sendStatus: 'failed', optedOut: true });
    expect(await refunds(b!.id)).toBe(1);
    const source = (await c.query(`select source from whatsapp_opt_outs where phone = '+972501110006'`))
      .rows[0];
    expect(source).toEqual({ source: 'meta' });
    // the API saying so right away does the same
    await commit('import_guests', [inv, OWNER, JSON.stringify([row('Blocked too', '+972501110007')]), 500]);
    await commit('whatsapp_queue', [inv, OWNER, [(await byName('Blocked too')).id], 0.0353, false]);
    const [d] = await commit<{ id: string }[]>('whatsapp_claim', [inv, 50]);
    await commit('whatsapp_result', [d!.id, null, '131050 · user stopped marketing messages']);
    expect((await byName('Blocked too')).optedOut).toBe(true);
    expect(await refunds(d!.id)).toBe(1);
  });

  it('none of the new functions are reachable with the public keys', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const sql of [
        `select public.add_guest('${inv}', '${OWNER}', '{}', 5)`,
        `select public.invitation_is_demo('${inv}')`,
        `select public.whatsapp_opt_out('+972501234567', 'reply')`,
        `select public.whatsapp_waiting('${inv}')`,
        `select public.whatsapp_refund('${inv}')`,
      ]) {
        await expect(
          as(c, role, role === 'authenticated' ? OWNER : null, () => c.query(sql)),
        ).rejects.toThrow(/permission denied/);
      }
      await expect(
        as(c, role, null, () => c.query(`select * from public.whatsapp_opt_outs`)),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

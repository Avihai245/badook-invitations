import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Guests, accounts & plans, WhatsApp sending, support limits, partner provisioning
// (supabase/migrations/*_guests_accounts_messaging.sql).

const OWNER_A = '77777777-7777-4777-8777-777777777777';
const OWNER_B = '88888888-8888-4888-8888-888888888888';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let slug: string;

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
const token = (n: number) => `tok${String(n).padStart(3, '0')}-abcdefghijklmnop`;
const reply = (name: string, attending: boolean, guestId: string | null) => ({
  attending,
  locale: 'he',
  primary_name: name,
  phone: null,
  email: null,
  adults_count: attending ? 2 : 0,
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
  token: string;
  sendStatus: string;
  sendChannel: string | null;
  openCount: number;
  openedAt: string | null;
  response: { attending: boolean; adults: number } | null;
};

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'a@example.com', '{"name":"Dana Levi"}'), ($2, 'B@Example.com', '{}')`,
    [OWNER_A, OWNER_B],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  const created = await commit<{ id: string; slug: string }>('create_invitation', [
    OWNER_A,
    'sahar-bordeaux',
    'wedding',
    'guests-a',
    doc,
  ]);
  inv = created.id;
  slug = created.slug;
  await commit('import_guests', [
    inv,
    OWNER_A,
    JSON.stringify([
      {
        name: 'Rina Cohen',
        phone: '+972501111111',
        email: 'rina@example.com',
        partySize: 2,
        group: 'Family',
        token: token(1),
      },
      { name: 'Moshe', phone: '+972502222222', email: null, partySize: null, group: null, token: token(2) },
      { name: 'No Phone', phone: null, email: null, partySize: null, group: null, token: token(3) },
    ]),
    500,
  ]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('accounts', () => {
  it('account_get creates the row once, with the sign-up name, on the free plan', async () => {
    const a = await call<{ fullName: string; plan: string; credits: number; activeInvitations: number }>(
      'account_get',
      [OWNER_A],
    );
    expect(a).toMatchObject({ fullName: 'Dana Levi', plan: 'free', credits: 0, activeInvitations: 1 });
    expect(await call('account_get', ['00000000-0000-4000-8000-000000000000'])).toBeNull();
  });

  it('billing_apply applies an event exactly once (plan fields + credits + ledger)', async () => {
    const patch = {
      plan: 'pro',
      planStatus: 'active',
      billingProvider: 'test',
      billingSubscriptionId: 'sub_1',
    };
    expect(
      await commit('billing_apply', ['evt_1', 'test', 'subscription.created', OWNER_B, patch, 0, {}]),
    ).toBe(true);
    expect(
      await commit('billing_apply', ['evt_1', 'test', 'subscription.created', OWNER_B, patch, 0, {}]),
    ).toBe(false);
    expect(await commit('billing_apply', ['evt_2', 'test', 'order.paid', OWNER_B, {}, 100, {}])).toBe(true);
    const b = await call<{ plan: string; credits: number; hasSubscription: boolean }>('account_get', [
      OWNER_B,
    ]);
    expect(b).toMatchObject({ plan: 'pro', credits: 100, hasSubscription: true });
    expect(await call('account_by_billing', ['test', 'sub_1', null])).toBe(OWNER_B);
    const ledger = (await c.query(`select delta, reason from credit_ledger where user_id = $1`, [OWNER_B]))
      .rows;
    expect(ledger).toEqual([{ delta: 100, reason: 'purchase' }]);
  });

  it('account_update keeps a trimmed name and the phone', async () => {
    const a = await call<{ fullName: string; phone: string }>('account_update', [
      OWNER_A,
      '  Dana L. ',
      '+972541234567',
    ]);
    expect(a).toMatchObject({ fullName: 'Dana L.', phone: '+972541234567' });
  });
});

describe('guests', () => {
  it("lists the owner's guests in the order they were added; nobody else's", async () => {
    const guests = await call<Guest[]>('owner_guests', [inv, OWNER_A]);
    expect(guests.map((g) => [g.name, g.phone, g.sendStatus, g.response])).toEqual([
      ['Rina Cohen', '+972501111111', 'none', null],
      ['Moshe', '+972502222222', 'none', null],
      ['No Phone', null, 'none', null],
    ]);
    expect(await call('owner_guests', [inv, OWNER_B])).toBeNull();
  });

  it('a re-import updates guests by phone instead of duplicating them; the list has a ceiling', async () => {
    const r = await call<{ added: number; updated: number; total: number }>('import_guests', [
      inv,
      OWNER_A,
      JSON.stringify([
        {
          name: 'Moshe Levi',
          phone: '+972502222222',
          email: null,
          partySize: 3,
          group: null,
          token: token(4),
        },
        { name: 'New', phone: '+972503333333', email: null, partySize: null, group: null, token: token(5) },
      ]),
      500,
    ]);
    expect(r).toEqual({ added: 1, updated: 1, total: 4 });
    await expect(
      call('import_guests', [
        inv,
        OWNER_A,
        JSON.stringify([
          { name: 'X', phone: null, email: null, partySize: null, group: null, token: token(6) },
        ]),
        3,
      ]),
    ).rejects.toThrow(/guest_limit/);
  });

  it('update_guest refuses a phone another guest has; delete removes', async () => {
    const [rina, moshe] = await call<Guest[]>('owner_guests', [inv, OWNER_A]);
    expect(
      await call('update_guest', [inv, OWNER_A, moshe!.id, 'Moshe', rina!.phone, null, null, null]),
    ).toEqual({ ok: false, code: 'duplicate_phone' });
    const ok = await call<{ ok: boolean; guest: Guest }>('update_guest', [
      inv,
      OWNER_A,
      moshe!.id,
      'Moshe K',
      '+972509999999',
      null,
      2,
      'Work',
    ]);
    expect(ok.guest).toMatchObject({ name: 'Moshe K', phone: '+972509999999' });
    expect(await call('delete_guests', [inv, OWNER_A, [moshe!.id]])).toBe(1);
    expect(await call('delete_guests', [inv, OWNER_B, [moshe!.id]])).toBeNull();
  });

  it('a personal link only opens on a published invitation, and counts the visits', async () => {
    expect(await call('guest_open', [slug, token(1)])).toBeNull();
    await commit('publish_invitation', [inv, OWNER_A]);
    expect(await commit('guest_open', [slug, token(1)])).toEqual({
      name: 'Rina Cohen',
      phone: '+972501111111',
      partySize: 2,
    });
    await commit('guest_open', [slug, token(1)]);
    expect(await call('guest_open', [slug, 'not-a-real-token-000000'])).toBeNull();
    expect(await call('guest_open', ['noa-and-itay', token(1)])).toBeNull();
    const rina = (await call<Guest[]>('owner_guests', [inv, OWNER_A]))[0]!;
    expect(rina.openCount).toBe(2);
    expect(rina.openedAt).not.toBeNull();
  });

  it('a reply through a personal link belongs to the guest; answering again replaces it', async () => {
    const guestId = await call<string>('guest_by_token', [inv, token(1)]);
    expect(guestId).toBeTruthy();
    const first = await commit<{ id: string; replaced: boolean }>('submit_rsvp', [
      inv,
      reply('Rina', true, guestId),
      '[]',
      null,
      'hash-1',
    ]);
    const again = await commit<{ id: string; replaced: boolean }>('submit_rsvp', [
      inv,
      reply('Rina', false, guestId),
      '[]',
      null,
      'hash-2',
    ]);
    expect(again).toEqual({ id: first.id, replaced: true });
    const rina = (await call<Guest[]>('owner_guests', [inv, OWNER_A]))[0]!;
    expect(rina.response).toMatchObject({ attending: false, adults: 0 });
    // the new browser can edit it now
    const count = (
      await c.query(`select count(*)::int as n from rsvp_responses where guest_id = $1`, [guestId])
    ).rows[0].n;
    expect(count).toBe(1);
    expect(
      (await c.query(`select edit_token_hash from rsvp_responses where id = $1`, [first.id])).rows[0]
        .edit_token_hash,
    ).toBe('hash-2');
    // a guest id of another invitation is ignored
    const stray = await commit<{ id: string }>('submit_rsvp', [
      (await c.query(`select id from invitations where slug = 'noa-and-itay'`)).rows[0].id,
      reply('Stray', true, guestId),
      '[]',
      null,
      'hash-3',
    ]);
    expect(
      (await c.query(`select guest_id from rsvp_responses where id = $1`, [stray.id])).rows[0].guest_id,
    ).toBeNull();
  });

  it('marking as sent by hand never overrides a WhatsApp status, and can be undone', async () => {
    const guests = await call<Guest[]>('owner_guests', [inv, OWNER_A]);
    const ids = guests.map((g) => g.id);
    expect(await commit('mark_guests_sent', [inv, OWNER_A, ids, true])).toBe(ids.length);
    const marked = await call<Guest[]>('owner_guests', [inv, OWNER_A]);
    expect(marked.every((g) => g.sendStatus === 'sent' && g.sendChannel === 'manual')).toBe(true);
    expect(await commit('mark_guests_sent', [inv, OWNER_A, ids, false])).toBe(ids.length);
    expect((await call<Guest[]>('owner_guests', [inv, OWNER_A])).every((g) => g.sendStatus === 'none')).toBe(
      true,
    );
  });
});

describe('WhatsApp', () => {
  it('queues only with enough credits, one per guest with a phone', async () => {
    const guests = await call<Guest[]>('owner_guests', [inv, OWNER_A]);
    const ids = guests.map((g) => g.id);
    const withPhone = guests.filter((g) => g.phone).length;
    expect(await call('whatsapp_queue', [inv, OWNER_A, ids, 0.0353])).toEqual({
      ok: false,
      code: 'credits',
      needed: withPhone,
      balance: 0,
    });
    await commit('credits_add', [OWNER_A, 10, 'admin', 'test']);
    const q = await commit<{ ok: boolean; queued: number; balance: number }>('whatsapp_queue', [
      inv,
      OWNER_A,
      ids,
      0.0353,
    ]);
    expect(q).toEqual({ ok: true, queued: withPhone, balance: 10 - withPhone });
    // queued guests aren't queued twice
    expect(await call('whatsapp_queue', [inv, OWNER_A, ids, 0.0353])).toEqual({ ok: false, code: 'nobody' });
    expect(await call('whatsapp_queue', [inv, OWNER_B, ids, 0.0353])).toBeNull();
  });

  it('claims, records the API answers (a failure refunds its credit) and moves statuses forward only', async () => {
    const claimed = await commit<
      { id: string; toPhone: string; guestName: string; guestToken: string; slug: string }[]
    >('whatsapp_claim', [inv, 50]);
    expect(claimed.length).toBeGreaterThanOrEqual(2);
    expect(claimed[0]).toMatchObject({ slug });
    expect(await commit('whatsapp_claim', [inv, 50])).toEqual([]);
    const [ok, bad] = claimed;
    await commit('whatsapp_result', [ok!.id, 'wamid.OK1', null]);
    await commit('whatsapp_result', [bad!.id, null, 'not a WhatsApp number']);
    const balance = (await call<{ credits: number }>('account_get', [OWNER_A])).credits;
    expect(await commit('whatsapp_status', ['wamid.OK1', 'read', null])).toBe(true);
    expect(await commit('whatsapp_status', ['wamid.OK1', 'delivered', null])).toBe(false);
    expect(await commit('whatsapp_status', ['wamid.OK1', 'failed', 'late'])).toBe(false);
    const guests = await call<Guest[]>('owner_guests', [inv, OWNER_A]);
    const byName = Object.fromEntries(guests.map((g) => [g.name, g.sendStatus]));
    expect(byName[ok!.guestName]).toBe('read');
    expect(byName[bad!.guestName]).toBe('failed');
    const refunds = (
      await c.query(
        `select count(*)::int as n from credit_ledger where user_id = $1 and reason = 'whatsapp_refund'`,
        [OWNER_A],
      )
    ).rows[0].n;
    expect(refunds).toBe(1);
    expect(balance).toBeGreaterThan(0);
  });

  it('puts a temporary failure back in the queue (3 tries), counts what is pending, fails stuck sends', async () => {
    const guests = await call<Guest[]>('owner_guests', [inv, OWNER_A]);
    const failed = guests.filter((g) => g.sendStatus === 'failed').map((g) => g.id);
    expect(failed.length).toBeGreaterThan(0);
    await commit('whatsapp_queue', [inv, OWNER_A, failed, 0.0353]);
    expect(await call('whatsapp_pending', [inv])).toBe(failed.length);
    const tries: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const [m] = await commit<{ id: string }[]>('whatsapp_claim', [inv, 1]);
      tries.push(await commit<boolean>('whatsapp_requeue', [m!.id, '130429 · rate limit']));
    }
    // twice back in the queue, the third try gives up (and refunds)
    expect(tries).toEqual([true, true, false]);
    expect(await call('whatsapp_requeue', ['00000000-0000-4000-8000-000000000000', 'x'])).toBe(false);

    // a sender that died mid-send: claimed again after 10 minutes, failed after the third try
    await commit('whatsapp_queue', [inv, OWNER_A, failed, 0.0353]);
    const rest = await commit<{ id: string }[]>('whatsapp_claim', [inv, 50]);
    expect(rest).toHaveLength(failed.length);
    for (const m of rest) {
      await c.query(
        `update whatsapp_messages set attempts = 3, claimed_at = now() - interval '11 minutes' where id = $1`,
        [m.id],
      );
    }
    const before = (await call<{ credits: number }>('account_get', [OWNER_A])).credits;
    expect(await commit('whatsapp_claim', [inv, 50])).toEqual([]);
    expect((await call<{ credits: number }>('account_get', [OWNER_A])).credits).toBe(before + rest.length);
    expect(await call('whatsapp_pending', [inv])).toBe(0);
  });
});

describe('support chat and partners', () => {
  it('support_rate_hit allows the limit, then refuses', async () => {
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await commit('support_rate_hit', ['k1', 3, 600]));
    expect(hits).toEqual([true, true, true, false]);
  });

  it('stores contact-form messages; only the service role can', async () => {
    const id = await commit<string>('contact_submit', [
      'דנה',
      'dana@example.com',
      '',
      'support',
      'שלום',
      'he',
      null,
    ]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const row = (await c.query('select name, phone, topic from contact_messages where id = $1', [id]))
      .rows[0];
    expect(row).toEqual({ name: 'דנה', phone: null, topic: 'support' });
    await expect(
      commit('contact_submit', ['x', 'x@example.com', '', 'spam', 'x', 'he', null]),
    ).rejects.toThrow();
    await expect(
      as(c, 'anon', null, () =>
        c.query(`select public.contact_submit('a','a@b.co','','other','m','he',null)`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('purge_expired forgets what the privacy policy says it forgets', async () => {
    await c.query(
      `insert into support_rate_events (key_hash, created_at) values ('old', now() - interval '2 days')`,
    );
    await c.query(
      `insert into contact_messages (name, email, topic, message, created_at)
       values ('old', 'old@example.com', 'other', 'm', now() - interval '3 years')`,
    );
    await c.query(`update rsvp_responses set ip_hash = 'h', created_at = now() - interval '40 days'
                   where id = (select id from rsvp_responses limit 1)`);
    const purged = await commit<Record<string, number>>('purge_expired', []);
    expect(purged.supportRate).toBeGreaterThanOrEqual(1);
    expect(purged.contact).toBe(1);
    expect(purged.ipHashes).toBe(1);
    expect(
      (
        await c.query(`select count(*)::int n from rsvp_responses where ip_hash is not null
                           and created_at < now() - interval '30 days'`)
      ).rows[0].n,
    ).toBe(0);
  });

  it('finds users by email (any case); the partner claims only users it created, and sees only its own', async () => {
    const P = 'partner:badook-events';
    expect(await call('user_id_by_email', [' b@EXAMPLE.com '])).toBe(OWNER_B);
    expect(await call('user_id_by_email', ['nobody@example.com'])).toBeNull();
    // an account opened some other way stays as it is
    expect(await call('account_link_partner', [OWNER_B, P, 'be-7', 'Someone', null, false])).toBeNull();
    // a user the partner has just created becomes the partner's
    const linked = await commit('account_link_partner', [
      OWNER_A,
      P,
      'be-42',
      'Dana Partner',
      '+972500000000',
      true,
    ]);
    expect(linked).toMatchObject({ source: P, fullName: 'Dana Partner', phone: '+972500000000' });
    // already the partner's: updated (what isn't sent stays)
    expect(await call('account_link_partner', [OWNER_A, P, null, 'Dana P.', null, false])).toMatchObject({
      fullName: 'Dana P.',
      phone: '+972500000000',
    });
    // another partner can't claim it
    expect(await call('account_link_partner', [OWNER_A, 'partner:other', null, 'X', null, true])).toBeNull();
    // found by our id or by the partner's id, with the email; never someone else's user
    expect(await call('partner_account', [P, null, 'be-42'])).toMatchObject({
      userId: OWNER_A,
      email: 'a@example.com',
    });
    expect(await call('partner_account', [P, OWNER_A, null])).toMatchObject({ userId: OWNER_A });
    expect(await call('partner_account', [P, OWNER_B, null])).toBeNull();
    expect(await call('partner_account', ['partner:other', OWNER_A, null])).toBeNull();
  });

  it('none of it is reachable with the public keys', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, role === 'authenticated' ? OWNER_A : null, () =>
          c.query(`select public.owner_guests($1, $2)`, [inv, OWNER_A]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(c, role, role === 'authenticated' ? OWNER_A : null, () =>
          c.query(`select * from public.accounts`),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(c, role, null, () => c.query(`select public.guest_open($1, $2)`, [slug, token(1)])),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

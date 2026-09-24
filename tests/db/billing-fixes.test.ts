import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Billing history with monthly renewals, a failed purchase that turns out paid, the purchases still
// waiting for their notice, and the plan's limit on active invitations enforced on the write itself
// (supabase/migrations/*_partner_billing_fixes.sql).

const OWNER = '66666666-6666-4666-8666-666666666661';
const OTHER = '66666666-6666-4666-8666-666666666662';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let doc: unknown;

async function commit<T = unknown>(fn: string, args: unknown[], client = c): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await client.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const create = (owner: string, slug: string, client = c) =>
  commit<{ id: string; slug: string }>(
    'create_invitation',
    [owner, 'sahar-bordeaux', 'wedding', slug, doc],
    client,
  );
const active = async (owner: string) =>
  (
    await c.query(
      `select count(*)::int n from invitations where owner_id = $1 and status <> 'archived' and source_id is null`,
      [owner],
    )
  ).rows[0].n as number;

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'other@example.com')`,
    [OWNER, OTHER],
  );
  doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  await commit('account_get', [OWNER]);
  await commit('account_get', [OTHER]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('billing', () => {
  it('monthly renewals, paid or failed, are in the history with their plan and amount', async () => {
    const patch = {
      plan: 'pro',
      planStatus: 'active',
      billingProvider: 'test',
      billingSubscriptionId: 'sub-1',
    };
    // a caller without product / amount still works
    expect(await commit('billing_apply', ['evt-plan', 'test', 'checkout.pro', OWNER, patch, 50, {}])).toBe(
      true,
    );
    expect(
      await commit('billing_apply', [
        'evt-r1',
        'test',
        'renewal.paid',
        OWNER,
        { planStatus: 'active' },
        50,
        {},
        'pro',
        49,
      ]),
    ).toBe(true);
    await commit('billing_apply', [
      'evt-r2',
      'test',
      'renewal.failed',
      OWNER,
      { planStatus: 'past_due' },
      0,
      {},
      'pro',
      49,
    ]);
    // once
    expect(
      await commit('billing_apply', [
        'evt-r1',
        'test',
        'renewal.paid',
        OWNER,
        { planStatus: 'active' },
        50,
        {},
        'pro',
        49,
      ]),
    ).toBe(false);
    const history = await commit<{
      renewals: { product: string; amount: number; status: string }[];
      credits: { delta: number }[];
    }>('billing_history', [OWNER]);
    expect(history.renewals.map((r) => [r.product, Number(r.amount), r.status])).toEqual([
      ['pro', 49, 'failed'],
      ['pro', 49, 'paid'],
    ]);
    expect(history.credits.map((l) => l.delta)).toEqual([50, 50]);
    expect((await commit<{ renewals: unknown[] }>('billing_history', [OTHER])).renewals).toEqual([]);
  });

  it('a failed purchase can still turn out paid (once); a paid one never fails', async () => {
    const id = await commit<string>('checkout_create', [OTHER, 'credits_100', 16, 'payplus']);
    await commit('checkout_attach', [id, 'page-1']);
    expect(await commit('checkout_complete', [id, 'failed', 'payplus:failed:tx-1', {}, 0, {}])).toMatchObject(
      {
        settled: true,
      },
    );
    expect(await commit('checkout_complete', [id, 'failed', 'payplus:failed:tx-1', {}, 0, {}])).toEqual({
      settled: false,
    });
    expect(await commit('checkout_complete', [id, 'paid', 'payplus:tx-2', {}, 100, {}])).toMatchObject({
      settled: true,
      product: 'credits_100',
    });
    expect(await commit('checkout_complete', [id, 'paid', 'payplus:tx-2', {}, 100, {}])).toEqual({
      settled: false,
    });
    expect(await commit('checkout_complete', [id, 'failed', 'payplus:failed:tx-3', {}, 0, {}])).toEqual({
      settled: false,
    });
    expect((await commit<{ credits: number }>('account_get', [OTHER])).credits).toBe(100);
    const event = (await c.query(`select product, amount from billing_events where id = 'payplus:tx-2'`))
      .rows[0];
    expect([event.product, Number(event.amount)]).toEqual(['credits_100', 16]);
  });

  it('lists PayPlus purchases still waiting for their notice, by age', async () => {
    const fresh = await commit<string>('checkout_create', [OTHER, 'pro', 49, 'payplus']);
    const old = await commit<string>('checkout_create', [OTHER, 'business', 149, 'payplus']);
    const ancient = await commit<string>('checkout_create', [OTHER, 'pro', 49, 'payplus']);
    const noPage = await commit<string>('checkout_create', [OTHER, 'pro', 49, 'payplus']);
    const test = await commit<string>('checkout_create', [OTHER, 'pro', 49, 'test']);
    for (const [id, ref] of [
      [fresh, 'page-f'],
      [old, 'page-o'],
      [ancient, 'page-a'],
      [test, 'page-t'],
    ])
      await commit('checkout_attach', [id, ref]);
    await c.query(`update billing_checkouts set created_at = now() - interval '1 hour' where id = any($1)`, [
      [old, noPage, test],
    ]);
    await c.query(`update billing_checkouts set created_at = now() - interval '10 days' where id = $1`, [
      ancient,
    ]);
    const pending = await commit<{ id: string }[]>('billing_pending_checkouts', ['payplus', 15, 7]);
    expect(pending.map((k) => k.id)).toEqual([old]);
  });
});

describe('the plan’s limit on active invitations', () => {
  it('holds on the insert: new, copies and unarchiving — archived and follow-ups don’t count', async () => {
    // not checked yet (or unlimited): nothing stops it
    const first = await create(OWNER, 'limit-a');
    await commit('account_note_limit', [OWNER, 1]);
    await expect(create(OWNER, 'limit-b')).rejects.toThrow(/plan_limit/);
    await expect(commit('duplicate_invitation', [first.id, OWNER])).rejects.toThrow(/plan_limit/);
    // archived: room again; back from the archive: only while there's room
    await commit('set_invitation_archived', [first.id, OWNER, true]);
    const second = await create(OWNER, 'limit-b');
    await expect(commit('set_invitation_archived', [first.id, OWNER, false])).rejects.toThrow(/plan_limit/);
    // editing, publishing and archiving what already counts are never stopped
    await commit('publish_invitation', [second.id, OWNER]);
    await commit('set_invitation_archived', [second.id, OWNER, true]);
    await commit('set_invitation_archived', [first.id, OWNER, false]);
    expect(await active(OWNER)).toBe(1);
    // an upgrade (a higher limit, or none) makes room at once
    await commit('account_note_limit', [OWNER, null]);
    await create(OWNER, 'limit-c');
    expect(await active(OWNER)).toBe(2);
    // other owners are counted apart
    await commit('account_note_limit', [OTHER, 1]);
    await create(OTHER, 'limit-other');
  });

  it('two creates at the same moment can’t both take the last place', async () => {
    const OWNER2 = '66666666-6666-4666-8666-666666666663';
    await c.query(`insert into auth.users (id, email) values ($1, 'race@example.com')`, [OWNER2]);
    await commit('account_get', [OWNER2]);
    await commit('account_note_limit', [OWNER2, 1]);
    const a = new Client({ connectionString: db.url });
    const b = new Client({ connectionString: db.url });
    await Promise.all([a.connect(), b.connect()]);
    try {
      await a.query('begin');
      await b.query('begin');
      await create(OWNER2, 'race-a', a);
      // b waits for a's lock, then counts a's invitation
      const second = create(OWNER2, 'race-b', b);
      await new Promise((r) => setTimeout(r, 150));
      await a.query('commit');
      await expect(second).rejects.toThrow(/plan_limit/);
      await b.query('rollback');
    } finally {
      await Promise.all([a.end(), b.end()]);
    }
    expect(await active(OWNER2)).toBe(1);
  });

  it('none of the new functions is reachable with the public keys', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const sql of [
        `select public.account_note_limit('${OWNER}', null)`,
        `select public.billing_pending_checkouts('payplus', 0, 1)`,
        `select public.user_self_managed('${OWNER}')`,
        `select public.billing_apply('x', 'x', 'x', null, '{}', 0, '{}', null, null)`,
      ])
        await expect(
          as(c, role, role === 'authenticated' ? OWNER : null, () => c.query(sql)),
        ).rejects.toThrow(/permission denied/);
    }
  });
});

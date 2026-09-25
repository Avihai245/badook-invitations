import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// A partner's discount on one of its users' plans, and the price a plan renews at
// (supabase/migrations/*_account_discounts.sql).

const P = 'partner:badook-events';
const MADE = '55555555-5555-4555-8555-555555555551';
const SELF = '55555555-5555-4555-8555-555555555552';

let db: { url: string; drop: () => Promise<void> };
let c: Client;

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
type Account = {
  discount: { percent: number; until: string | null; note: string | null; source: string } | null;
  planPrice: number | null;
  email?: string;
};

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
       ($1, 'made@example.com', '', $3), ($2, 'self@example.com', 'scrypt:x:y', '{}')`,
    [MADE, SELF, { provider: 'email', providers: ['email'], provisioned_by: P }],
  );
  await commit('account_link_partner', [MADE, P, 'be-1', 'Made', null, true]);
  await commit('account_get', [SELF]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('account_set_discount', () => {
  it('sets, replaces and removes a discount on the partner’s own user, by either id', async () => {
    // (call: as the service role, rolled back; commit: kept)
    const set = await call<Account>('account_set_discount', [P, null, 'be-1', 20, null, '  customer  ']);
    expect(set).toMatchObject({
      userId: MADE,
      email: 'made@example.com',
      userManaged: false,
      discount: { percent: 20, until: null, note: 'customer', source: P },
    });
    const until = '2026-12-31T22:00:00+00:00';
    const replaced = await commit<Account>('account_set_discount', [P, MADE, null, 35, until, null]);
    expect(replaced.discount).toMatchObject({ percent: 35, note: null });
    expect(Date.parse(replaced.discount!.until!)).toBe(Date.parse(until));
    // the account as the app reads it has it too
    expect((await call<Account>('account_get', [MADE])).discount).toMatchObject({ percent: 35 });
    const removed = await commit<Account>('account_set_discount', [P, MADE, null, null, until, 'x']);
    expect(removed.discount).toBeNull();
    const row = (
      await c.query(
        `select discount_until, discount_note, discount_source, discount_set_at from accounts where user_id = $1`,
        [MADE],
      )
    ).rows[0];
    expect(row).toEqual({
      discount_until: null,
      discount_note: null,
      discount_source: null,
      discount_set_at: null,
    });
  });

  it('never for someone else’s user, and only 1–90%', async () => {
    expect(await call('account_set_discount', [P, SELF, null, 20, null, null])).toBeNull();
    expect(await call('account_set_discount', ['partner:other', MADE, null, 20, null, null])).toBeNull();
    expect(await call('account_set_discount', [P, null, 'nobody', 20, null, null])).toBeNull();
    for (const percent of [0, 91, 100])
      await expect(call('account_set_discount', [P, MADE, null, percent, null, null])).rejects.toThrow(
        /check constraint/,
      );
    // one of the two ids, not both
    await expect(call('account_set_discount', [P, MADE, 'be-1', 20, null, null])).rejects.toThrow(
      /one of them/,
    );
    await expect(call('account_set_discount', [P, null, null, 20, null, null])).rejects.toThrow(
      /one of them/,
    );
  });

  it('only the service role may call it', async () => {
    for (const role of ['anon', 'authenticated']) {
      await c.query('begin');
      await c.query(`set local role ${role}`);
      await expect(
        c.query(`select public.account_set_discount($1, $2, null, 10, null, null)`, [P, MADE]),
      ).rejects.toThrow(/permission denied/);
      await c.query('rollback');
    }
  });
});

describe('the price a plan renews at', () => {
  it('is what the plan was bought for; a message pack doesn’t change it', async () => {
    const buy = async (product: string, amount: number, event: string) => {
      const id = await commit<string>('checkout_create', [MADE, product, amount, 'test']);
      const patch = product.startsWith('credits_') ? {} : { plan: product, planStatus: 'active' };
      await commit('checkout_complete', [id, 'paid', event, patch, 0, {}]);
      return (await call<Account>('account_get', [MADE])).planPrice;
    };
    expect((await call<Account>('account_get', [MADE])).planPrice).toBeNull();
    expect(await buy('pro', 39.2, 'test:1')).toBe(39.2);
    expect(await buy('credits_100', 16, 'test:2')).toBe(39.2);
    expect(await buy('business', 149, 'test:3')).toBe(149);
    // a purchase that failed changes nothing
    const failed = await commit<string>('checkout_create', [MADE, 'pro', 10, 'test']);
    await commit('checkout_complete', [failed, 'failed', 'test:4', {}, 0, {}]);
    expect((await call<Account>('account_get', [MADE])).planPrice).toBe(149);
  });
});

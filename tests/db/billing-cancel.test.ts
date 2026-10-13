import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from './harness';

// A canceled plan is never charged. The daily run (chargeRenewals) charges what billing_renewals_due
// returns, so the guarantee is that function's, run here as it is in the migrations: a Tranzila plan with
// a card, canceled the way cancelPlan cancels it (a plan.canceled event through billing_apply), is left
// out even when its renewal date has passed; a running one is in. Also pinned: the card's token is kept.

const RUNNING = '77777777-7777-4777-8777-777777777771';
const CANCELED = '77777777-7777-4777-8777-777777777772';
const LAPSED = '77777777-7777-4777-8777-777777777773';
const PAST_DUE = '77777777-7777-4777-8777-777777777774';
const NOT_YET = '77777777-7777-4777-8777-777777777775';
const PAST_DUE_CANCELED = '77777777-7777-4777-8777-777777777776';
const GRACE = 14;

let db: { url: string; drop: () => Promise<void> };
let c: Client;

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** A paid Tranzila plan with its card, renewing at `renewsAt`. */
async function subscribe(user: string, renewsAt: string, status = 'active') {
  await commit('billing_apply', [
    `checkout:${user}`,
    'tranzila',
    'checkout.pro',
    user,
    {
      plan: 'pro',
      planStatus: status,
      planRenewsAt: renewsAt,
      billingProvider: 'tranzila',
      billingSubscriptionId: `tranzila:${user}`,
    },
    50,
    {},
  ]);
  await commit('billing_card_save', [user, 'tranzila', `Ztoken${user.slice(-1)}`, 8, 2029, '1234']);
}

/** What billing.ts cancelPlan writes. */
const cancel = (user: string, id = `cancel:${user}:1`) =>
  commit<boolean>('billing_apply', [
    id,
    'tranzila',
    'plan.canceled',
    user,
    { planStatus: 'canceled' },
    0,
    {},
    null,
    null,
  ]);

const dueUsers = async () =>
  (await commit<{ userId: string }[]>('billing_renewals_due', ['tranzila', GRACE]))
    .map((d) => d.userId)
    .sort();
const account = async (user: string) =>
  (
    await c.query(
      'select plan, plan_status, plan_renews_at, message_credits from accounts where user_id = $1',
      [user],
    )
  ).rows[0];

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  for (const [i, id] of [RUNNING, CANCELED, LAPSED, PAST_DUE, NOT_YET, PAST_DUE_CANCELED].entries())
    await c.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `u${i}@example.com`]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('billing_renewals_due and a canceled plan', () => {
  it('a canceled plan whose renewal date has passed is not due; a running one is', async () => {
    await subscribe(RUNNING, ago(1));
    await subscribe(CANCELED, ago(1));
    // before the cancel both are due
    expect(await dueUsers()).toEqual([RUNNING, CANCELED]);
    expect(await cancel(CANCELED)).toBe(true);
    expect(await dueUsers()).toEqual([RUNNING]);
  });

  it('canceling changes the status only: the renewal date, the plan and the credits stay', async () => {
    const before = await account(RUNNING);
    const renewsAt = (await account(CANCELED)).plan_renews_at;
    expect(await account(CANCELED)).toMatchObject({
      plan: 'pro',
      plan_status: 'canceled',
      message_credits: 50,
    });
    expect(new Date(renewsAt).getTime()).toBeLessThan(Date.now());
    expect(before.plan_status).toBe('active');
  });

  it('not due however long ago it lapsed or how close its date is, and not once past due either', async () => {
    await subscribe(LAPSED, ago(5));
    await subscribe(PAST_DUE, ago(3), 'past_due');
    await subscribe(PAST_DUE_CANCELED, ago(3), 'past_due');
    await subscribe(NOT_YET, new Date(Date.now() + 5 * 86_400_000).toISOString());
    await cancel(LAPSED);
    await cancel(PAST_DUE_CANCELED);
    // past due (a failed charge, still being retried) is due; the same, canceled, is not; a plan that
    // renews in the future is not due yet
    expect(await dueUsers()).toEqual([RUNNING, PAST_DUE]);
  });

  it('the daily alert for plans without a renewal does not list canceled plans either', async () => {
    const overdue = await commit<{ userId: string }[]>('billing_overdue', [3]);
    expect(overdue.map((o) => o.userId)).not.toContain(CANCELED);
    expect(overdue.map((o) => o.userId)).not.toContain(LAPSED);
  });

  it('a cancel is applied once: the same event id again changes nothing', async () => {
    expect(await cancel(CANCELED)).toBe(false);
    const events = await c.query(`select count(*)::int n from billing_events where id = $1`, [
      `cancel:${CANCELED}:1`,
    ]);
    expect(events.rows[0].n).toBe(1);
  });

  it('a plan that is bought again after the cancel is due again when its month is up', async () => {
    // a new purchase gives the plan back (checkout_complete's patch: active, a new month)
    await commit('billing_apply', [
      'checkout:again',
      'tranzila',
      'checkout.pro',
      CANCELED,
      {
        plan: 'pro',
        planStatus: 'active',
        planRenewsAt: ago(0.5),
        billingProvider: 'tranzila',
        billingSubscriptionId: 'tranzila:again',
      },
      50,
      {},
    ]);
    expect(await dueUsers()).toContain(CANCELED);
  });
});

describe('DECISION (pinned): the stored Tranzila token', () => {
  it('the card (billing_cards) is still there after the cancel — nothing deletes it but deleting the account', async () => {
    const card = await c.query(`select provider, last4, expire_year from billing_cards where user_id = $1`, [
      LAPSED,
    ]);
    expect(card.rows).toEqual([{ provider: 'tranzila', last4: '1234', expire_year: 2029 }]);
    expect((await account(LAPSED)).plan_status).toBe('canceled');
    // no function in the schema removes a card
    const fns = await c.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ~* 'delete\\s+from\\s+public\\.billing_cards'`,
    );
    expect(fns.rows).toEqual([]);
  });

  it('deleting the account does remove it (on delete cascade)', async () => {
    await c.query(`delete from auth.users where id = $1`, [LAPSED]);
    expect((await c.query(`select 1 from billing_cards where user_id = $1`, [LAPSED])).rowCount).toBe(0);
  });
});

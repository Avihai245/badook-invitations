import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The admin console's cash flow, messages and Badook Events areas, and where Badook Events accounts came
// from (supabase/migrations/*_partner_origin.sql, *_admin_money_messages.sql): exact money on a seeded
// month (plans, renewals, packs, a partner's discount, the month's edge in Israel time), WhatsApp's cost,
// the roles and their masking, the partner tables and what they keep.

const P = 'partner:badook-events';
/** "Now" for every console function here: 15 Sep 2026, noon in Israel. */
const NOW = '2026-09-15T12:00:00+03:00';
const PRICES = { pro: 49, business: 149 };

const id = (n: number) => `99999999-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = id(1);
const FINANCE = id(2);
const SUPPORT = id(3);
const VIEWER = id(4);
const HOST = id(5);
const A = id(11);
const B = id(12);
const C = id(13); // a Badook Events account (P1), bought Pro with the partner's discount
const D = id(14);
const E = id(15);
const F = id(16);
const G = id(17);
const H = id(18);
const I = id(19);
const L = id(20);
const P2 = id(22);
const P3 = id(23);
const P4 = id(24);

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;

/** As the server (the service role), rolled back. */
async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}
/** As the server, kept. */
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const reason = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: { message?: string }) => e.message ?? 'error',
  );
const q = (text: string, values: unknown[] = []) => c.query(text, values);

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  const partnerMeta = { provider: 'email', providers: ['email'], provisioned_by: P };
  const users: [string, string, object, string | null, string | null][] = [
    [OWNER, 'owner@example.com', {}, null, null],
    [FINANCE, 'finance@example.com', {}, null, null],
    [SUPPORT, 'support@example.com', {}, null, null],
    [VIEWER, 'viewer@example.com', {}, null, null],
    [HOST, 'host@example.com', {}, null, null],
    [A, 'a-cust@example.com', {}, null, null],
    [B, 'b-cust@example.com', {}, null, null],
    [C, 'c-cust@example.com', partnerMeta, '2026-09-14T09:00:00+03:00', null],
    [D, 'd-cust@example.com', {}, null, null],
    [E, 'e-cust@example.com', {}, null, null],
    [F, 'f-cust@example.com', {}, null, null],
    [G, 'g-cust@example.com', {}, null, null],
    [H, 'h-cust@example.com', {}, null, null],
    [I, 'i-cust@example.com', {}, null, null],
    [L, 'l-cust@example.com', {}, null, null],
    [P2, 'p2@example.com', partnerMeta, null, null],
    // signs in by themselves (set a password)
    [P3, 'p3@example.com', partnerMeta, null, 'hashed'],
    [P4, 'p4@example.com', partnerMeta, null, null],
  ];
  for (const [uid, email, meta, signIn, password] of users)
    await q(
      `insert into auth.users (id, email, raw_app_meta_data, last_sign_in_at, encrypted_password)
       values ($1, $2, $3, $4, $5)`,
      [uid, email, meta, signIn, password],
    );
  for (const [email, role] of [
    ['owner@example.com', 'owner'],
    ['finance@example.com', 'finance'],
    ['support@example.com', 'support'],
    ['viewer@example.com', 'viewer'],
  ])
    await q(`insert into public.admin_staff (email, role) values ($1, $2)`, [email, role]);

  // the accounts: [id, name, phone, plan, status, renews, subscription, price, source, external, created]
  const accounts: [
    string,
    string,
    string | null,
    string,
    string,
    string | null,
    string | null,
    number | null,
    string,
    string | null,
    string,
  ][] = [
    [
      A,
      'אורית אביב',
      '+972501234567',
      'pro',
      'active',
      '2026-10-03T10:00:00+03:00',
      'sub-a',
      49,
      'signup',
      null,
      '2026-09-03T09:00:00+03:00',
    ],
    [
      B,
      'בני ברק',
      null,
      'business',
      'active',
      '2026-10-10T10:00:00+03:00',
      'sub-b',
      149,
      'signup',
      null,
      '2026-08-10T09:00:00+03:00',
    ],
    [
      C,
      'רחל כהן',
      '+972521234567',
      'pro',
      'active',
      '2026-10-11T10:00:00+03:00',
      'sub-c',
      39.2,
      P,
      'be-c-1',
      '2026-09-10T09:00:00+03:00',
    ],
    [D, 'דוד לוי', null, 'free', 'active', null, null, null, 'signup', null, '2026-07-01T09:00:00+03:00'],
    // the last monthly charge failed: past due, still in its 14 days of grace
    [
      E,
      'עדי אלון',
      null,
      'pro',
      'past_due',
      '2026-09-08T10:00:00+03:00',
      'sub-e',
      49,
      'signup',
      null,
      '2026-07-08T09:00:00+03:00',
    ],
    // canceled this month: keeps the plan to the end of the period, renews no more
    [
      F,
      'פזית גל',
      null,
      'business',
      'canceled',
      '2026-09-25T10:00:00+03:00',
      'sub-f',
      149,
      'signup',
      null,
      '2026-06-25T09:00:00+03:00',
    ],
    // its renewal is 5 days late (bought before the price paid was kept: the list price)
    [
      G,
      'גיל שחר',
      null,
      'pro',
      'active',
      '2026-09-10T10:00:00+03:00',
      'sub-g',
      null,
      'signup',
      null,
      '2026-05-10T09:00:00+03:00',
    ],
    [H, 'חנה רז', null, 'free', 'active', null, null, null, 'signup', null, '2026-09-13T09:00:00+03:00'],
    [I, 'יוסי נוי', null, 'free', 'active', null, null, null, 'signup', null, '2026-09-14T09:00:00+03:00'],
    // its renewal never came, and the 14 days of grace are over: lapsed
    [
      L,
      'לאה מור',
      null,
      'pro',
      'active',
      '2026-08-20T10:00:00+03:00',
      'sub-l',
      49,
      'signup',
      null,
      '2026-06-20T09:00:00+03:00',
    ],
    [
      P2,
      'פנינה שני',
      '+14155550123',
      'free',
      'active',
      null,
      null,
      null,
      P,
      'be-c-2',
      '2026-08-01T09:00:00+03:00',
    ],
    [P3, 'פרץ שלום', null, 'free', 'active', null, null, null, P, 'be-c-3', '2026-06-01T09:00:00+03:00'],
    [P4, 'פאר אדם', null, 'free', 'active', null, null, null, P, 'be-c-4', '2026-09-12T09:00:00+03:00'],
  ];
  for (const [uid, name, phone, plan, status, renews, sub, price, source, external, created] of accounts)
    await q(
      `insert into public.accounts (user_id, full_name, phone, plan, plan_status, plan_renews_at, billing_provider,
         billing_subscription_id, plan_price, source, external_id, created_at)
       values ($1, $2, $3, $4, $5, $6, case when $7::text is null then null else 'payplus' end, $7, $8, $9, $10, $11)`,
      [uid, name, phone, plan, status, renews, sub, price, source, external, created],
    );

  // purchases: [user, product, amount, status, ref, when]
  const checkouts: [string, string, number, string, string, string][] = [
    [A, 'pro', 49, 'paid', 'page-a', '2026-09-03T10:00:00+03:00'],
    [B, 'business', 149, 'paid', 'page-b', '2026-08-10T10:00:00+03:00'],
    [C, 'pro', 39.2, 'paid', 'page-c', '2026-09-11T10:00:00+03:00'],
    [D, 'credits_300', 46.2, 'paid', 'page-d1', '2026-09-12T10:00:00+03:00'],
    // the first minutes of September in Israel (still August 31st in UTC)
    [D, 'credits_100', 15.4, 'paid', 'page-d2', '2026-09-01T00:30:00+03:00'],
    // the last minutes of August in Israel
    [D, 'credits_100', 15.4, 'paid', 'page-d3', '2026-08-31T23:30:00+03:00'],
    [D, 'credits_100', 15.4, 'paid', 'page-d4', '2026-08-20T10:00:00+03:00'],
    [E, 'pro', 49, 'paid', 'page-e', '2026-07-08T10:00:00+03:00'],
    [H, 'pro', 49, 'failed', 'page-h', '2026-09-13T10:00:00+03:00'],
  ];
  for (const [uid, product, amount, status, ref, at] of checkouts)
    await q(
      `insert into public.billing_checkouts (user_id, product, amount, provider, provider_ref, status, created_at, completed_at)
       values ($1, $2, $3, 'payplus', $4, $5, $6, $6)`,
      [uid, product, amount, ref, status, at],
    );
  // a payment page left open
  await q(
    `insert into public.billing_checkouts (user_id, product, amount, provider, provider_ref, status, created_at)
     values ($1, 'credits_300', 46.20, 'payplus', 'page-i', 'pending', '2026-09-14T10:00:00+03:00')`,
    [I],
  );
  // the provider's events: a purchase's own event (never counted twice), renewals, a cancellation
  const events: [string, string, string, string | null, number | null, string][] = [
    ['payplus:tx-a', 'checkout.pro', A, 'pro', 49, '2026-09-03T10:00:00+03:00'],
    ['payplus:renew-b', 'renewal.paid', B, 'business', 149, '2026-09-10T10:00:00+03:00'],
    ['payplus:renew-e', 'renewal.failed', E, 'pro', 49, '2026-09-08T10:00:00+03:00'],
    ['cancel:f', 'plan.canceled', F, null, null, '2026-09-11T10:00:00+03:00'],
  ];
  for (const [eid, type, uid, product, amount, at] of events)
    await q(
      `insert into public.billing_events (id, provider, type, user_id, product, amount, created_at)
       values ($1, 'payplus', $2, $3, $4, $5, $6)`,
      [eid, type, uid, product, amount, at],
    );
  // the credits ledger: [user, delta, reason, when]
  const ledger: [string, number, string, string][] = [
    [D, 300, 'purchase', '2026-09-12T10:00:00+03:00'],
    [D, 100, 'purchase', '2026-09-01T00:30:00+03:00'],
    [D, 100, 'purchase', '2026-08-31T23:30:00+03:00'],
    [D, 100, 'purchase', '2026-08-20T10:00:00+03:00'],
    [A, 50, 'plan_grant', '2026-09-03T10:00:00+03:00'],
    [C, 50, 'plan_grant', '2026-09-11T10:00:00+03:00'],
    [B, 300, 'plan_grant', '2026-09-10T10:00:00+03:00'],
    [B, 300, 'plan_grant', '2026-08-10T10:00:00+03:00'],
    [H, 25, 'admin', '2026-09-13T11:00:00+03:00'],
    [G, -10, 'admin', '2026-09-14T11:00:00+03:00'],
    [A, -7, 'whatsapp_send', '2026-09-05T09:00:00+03:00'],
    [A, 1, 'whatsapp_refund', '2026-09-06T09:00:00+03:00'],
  ];
  for (const [uid, delta, why, at] of ledger)
    await q(
      `insert into public.credit_ledger (user_id, delta, reason, ref, created_at) values ($1, $2, $3, 'test', $4)`,
      [uid, delta, why, at],
    );

  // A's wedding and its WhatsApp messages of the three kinds
  inv = (
    await q(
      `insert into public.invitations (owner_id, template_id, slug, status, event_type, draft, published, published_at)
       values ($1, 'sahar-bordeaux', 'adm-money-wedding', 'published', 'wedding',
               '{"hosts":{"primary":{"he":"אורית"},"secondary":{"he":"אבי"},"joiner":null},"defaultLocale":"he"}', null, now())
       returning id`,
      [A],
    )
  ).rows[0].id as string;
  const wa: [string, string | null, string][] = [
    ['delivered', null, '2026-09-05T10:00:00+03:00'],
    ['read', null, '2026-09-05T10:05:00+03:00'],
    ['sent', null, '2026-09-06T10:00:00+03:00'],
    ['failed', '(#131026) Message undeliverable', '2026-09-05T10:10:00+03:00'],
    ['queued', null, '2026-09-15T11:00:00+03:00'],
    ['read', null, '2026-09-01T00:30:00+03:00'],
    ['read', null, '2026-08-31T23:30:00+03:00'],
  ];
  for (const [status, error, at] of wa)
    await q(
      `insert into public.whatsapp_messages (invitation_id, owner_id, to_phone, status, error, price_usd, created_at, updated_at)
       values ($1, $2, '+972501111111', $3, $4, 0.0353, $5, $5)`,
      [inv, A, status, error, at],
    );
  const unit = (await q(`insert into public.seating_units (invitation_id) values ($1) returning id`, [inv]))
    .rows[0].id as string;
  const notices: [string, string, string | null, string][] = [
    ['whatsapp', 'read', null, '2026-09-07T10:00:00+03:00'],
    ['whatsapp', 'read', null, '2026-09-07T10:01:00+03:00'],
    ['whatsapp', 'failed', '(#131049) Meta chose not to deliver', '2026-09-07T11:00:00+03:00'],
    // told by the host themselves: not WhatsApp
    ['manual', 'sent', null, '2026-09-07T12:00:00+03:00'],
  ];
  for (const [channel, status, error, at] of notices)
    await q(
      `insert into public.seating_notices (invitation_id, unit_id, owner_id, table_number, channel, status, to_phone,
         error, price_usd, created_at, updated_at)
       values ($1, $2, $3, 4, $4, $5, case when $4 = 'whatsapp' then '+972502222222' end, $6,
               case when $4 = 'whatsapp' then 0.0353 else 0 end, $7, $7)`,
      [inv, unit, A, channel, status, error, at],
    );
  const gallery: [string, string, string | null, string][] = [
    ['whatsapp', 'delivered', null, '2026-09-08T10:00:00+03:00'],
    ['whatsapp', 'failed', '(#131026) Message undeliverable', '2026-09-08T10:30:00+03:00'],
    ['manual', 'sent', null, '2026-09-08T11:00:00+03:00'],
  ];
  for (const [channel, status, error, at] of gallery)
    await q(
      `insert into public.gallery_notices (invitation_id, owner_id, channel, status, to_phone, error, price_usd,
         created_at, updated_at)
       values ($1, $2, $3, $4, case when $3 = 'whatsapp' then '+972503333333' end, $5,
               case when $3 = 'whatsapp' then 0.0353 else 0 end, $6, $6)`,
      [inv, A, channel, status, error, at],
    );
  for (const [phone, source, at] of [
    ['+972504444441', 'reply', '2026-09-10T10:00:00+03:00'],
    ['+972504444442', 'reply', '2026-07-01T10:00:00+03:00'],
    ['+972504444443', 'meta', '2026-09-12T10:00:00+03:00'],
  ])
    await q(`insert into public.whatsapp_opt_outs (phone, source, created_at) values ($1, $2, $3)`, [
      phone,
      source,
      at,
    ]);
  for (const [kind, status, at] of [
    ['rsvp_reply', 'sent', '2026-09-14T09:00:00+03:00'],
    ['rsvp_reply', 'sent', '2026-09-14T10:00:00+03:00'],
    ['rsvp_reply', 'sent', '2026-09-14T11:00:00+03:00'],
    ['rsvp_reply', 'failed', '2026-09-14T12:00:00+03:00'],
    ['contact', 'sent', '2026-09-10T09:00:00+03:00'],
    ['contact', 'sent', '2026-09-10T10:00:00+03:00'],
    ['billing_alert', 'skipped', '2026-09-10T11:00:00+03:00'],
  ])
    await q(`insert into public.email_log (kind, status, created_at) values ($1, $2, $3)`, [
      kind,
      status,
      at,
    ]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

// ─── cash flow ─────────────────────────────────────────────────────────────────────────────────

describe('the cash flow', () => {
  type Overview = Record<string, unknown> & {
    months: { month: string }[];
    days: { day: string; total: number }[];
    credits: { month: string }[];
  };
  const overview = (actor = OWNER) => call<Overview>('admin_finance_overview', [actor, PRICES, NOW]);

  it('this month and last month, to the agora, in Israel’s months; a purchase’s own event isn’t counted twice', async () => {
    const o = await overview();
    expect(o.month).toBe('2026-09');
    expect(o.today).toBe('2026-09-15');
    expect(o.thisMonth).toEqual({
      newPlans: 88.2,
      renewals: 149,
      packs: 61.6,
      total: 298.8,
      payments: 5,
      customers: 4,
    });
    // last month to the same point (15 Aug, noon): Business bought on the 10th
    expect(o.lastMonth).toEqual({
      newPlans: 149,
      renewals: 0,
      packs: 30.8,
      total: 179.8,
      toDate: 149,
      payments: 3,
      customers: 2,
    });
  });

  it('twelve months of income by kind with WhatsApp’s cost (USD), and 90 days by day', async () => {
    const o = await overview();
    expect(o.months.map((m) => m.month)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    const month = (m: string) => o.months.find((x) => x.month === m);
    expect(month('2026-09')).toEqual({
      month: '2026-09',
      newPlans: 88.2,
      renewals: 149,
      packs: 61.6,
      total: 298.8,
      payments: 5,
      // 4 invitations (one of them in the first minutes of September), 2 table numbers, 1 gallery link
      whatsappUsd: 0.2471,
    });
    expect(month('2026-08')).toEqual({
      month: '2026-08',
      newPlans: 149,
      renewals: 0,
      packs: 30.8,
      total: 179.8,
      payments: 3,
      whatsappUsd: 0.0353,
    });
    expect(month('2026-07')).toMatchObject({ newPlans: 49, total: 49, payments: 1, whatsappUsd: 0 });
    expect(month('2026-06')).toMatchObject({ total: 0, payments: 0 });
    expect(o.days).toHaveLength(90);
    expect(o.days.at(-1)).toEqual({ day: '2026-09-15', total: 0 });
    const day = (d: string) => o.days.find((x) => x.day === d)?.total;
    expect([day('2026-08-31'), day('2026-09-01'), day('2026-09-03'), day('2026-09-10')]).toEqual([
      15.4, 15.4, 49, 149,
    ]);
    // a failed purchase is no income
    expect(day('2026-09-13')).toBe(0);
    expect(o.whatsappUsdMonth).toBe(0.2471);
  });

  it('MRR: the plans renewing through the provider at the price they renew at — a discount kept, the list price when unknown', async () => {
    const o = await overview();
    expect(o.subscriptions).toEqual({
      // A 49, C 39.20 (bought with the partner's discount), G at the list price (49)
      pro: { count: 3, mrr: 137.2, listPriced: 1 },
      business: { count: 1, mrr: 149, listPriced: 0 },
    });
    expect(o.creditsSoldMonth).toBe(400);
    // E: the last charge failed (in grace); G: its renewal is 5 days late (L lapsed: not at risk)
    expect(o.pastDue).toEqual({ count: 1, monthly: 49 });
    expect(o.late).toEqual({ count: 1, monthly: 49 });
    expect(o.cancellationsMonth).toBe(1);
    // A on 3 Oct (18 days), B on 10 Oct and C on 11 Oct (25 and 26 days)
    expect(o.forecast).toEqual({
      count: 3,
      amount: 237.2,
      weeks: [
        { count: 0, amount: 0 },
        { count: 0, amount: 0 },
        { count: 1, amount: 49 },
        { count: 2, amount: 188.2 },
      ],
    });
    expect(o.atRisk).toEqual([
      {
        userId: E,
        name: 'עדי אלון',
        email: 'e-cust@example.com',
        plan: 'pro',
        why: 'past_due',
        monthly: 49,
        renewsAt: '2026-09-08T07:00:00+00:00',
      },
      {
        userId: G,
        name: 'גיל שחר',
        email: 'g-cust@example.com',
        plan: 'pro',
        why: 'late',
        monthly: 49,
        renewsAt: '2026-09-10T07:00:00+00:00',
      },
    ]);
  });

  it('the credits economy by month: bought, with plans, by the team, used and refunded', async () => {
    const o = await overview();
    const month = (m: string) => o.credits.find((x) => x.month === m);
    expect(month('2026-09')).toEqual({
      month: '2026-09',
      bought: 400,
      plans: 400,
      teamAdded: 25,
      teamRemoved: 10,
      consumed: 7,
      refunded: 1,
    });
    expect(month('2026-08')).toEqual({
      month: '2026-08',
      bought: 200,
      plans: 300,
      teamAdded: 0,
      teamRemoved: 0,
      consumed: 0,
      refunded: 0,
    });
  });

  it('the overview’s summary', async () => {
    expect(await call('admin_finance_summary', [OWNER, PRICES, NOW])).toEqual({
      revenueMonth: 298.8,
      revenuePrevMonth: 179.8,
      mrr: 286.2,
      activeSubscriptions: 4,
      whatsappUsdMonth: 0.2471,
    });
  });

  type Page = { total: number; paidSum: number; rows: Record<string, unknown>[]; providers: string[] };
  const payments = (actor: string, filters: object, limit = 50, offset = 0) =>
    call<Page>('admin_finance_payments', [actor, filters, limit, offset]);

  it('the payments: purchases and renewals newest first, all but the open ones; filters', async () => {
    const all = await payments(OWNER, {});
    expect(all.total).toBe(11);
    expect(all.paidSum).toBe(527.6);
    expect(all.providers).toEqual(['payplus']);
    expect(all.rows[0]).toEqual({
      id: expect.any(String),
      kind: 'purchase',
      at: '2026-09-13T07:00:00+00:00',
      userId: H,
      name: 'חנה רז',
      email: 'h-cust@example.com',
      product: 'pro',
      amount: 49,
      status: 'failed',
      provider: 'payplus',
      ref: 'page-h',
    });
    expect(all.rows.find((r) => r.kind === 'renewal' && r.status === 'paid')).toMatchObject({
      id: 'payplus:renew-b',
      userId: B,
      product: 'business',
      amount: 149,
      ref: 'payplus:renew-b',
    });
    expect((await payments(OWNER, { status: 'paid' })).total).toBe(9);
    expect((await payments(OWNER, { status: 'pending' })).rows).toMatchObject([{ userId: I, ref: 'page-i' }]);
    expect((await payments(OWNER, { kind: 'renewal' })).rows.map((r) => r.status)).toEqual([
      'paid',
      'failed',
    ]);
    expect((await payments(OWNER, { product: 'credits_100' })).total).toBe(3);
    // September in Israel: the first minutes are in, the last ones of August out
    const september = await payments(OWNER, { from: '2026-09-01', to: '2026-09-15' });
    expect(september.total).toBe(7);
    expect(september.rows.map((r) => r.ref)).toContain('page-d2');
    expect(september.rows.map((r) => r.ref)).not.toContain('page-d3');
    expect((await payments(OWNER, { q: 'רחל' })).rows).toMatchObject([{ userId: C, amount: 39.2 }]);
    expect((await payments(OWNER, { q: 'D-CUST@' })).total).toBe(4);
    expect((await payments(OWNER, { q: 'page-d4' })).total).toBe(1);
    // a page at a time
    const second = await payments(OWNER, {}, 4, 4);
    expect(second.rows).toHaveLength(4);
    expect(second.rows[0]!.id).toBe(all.rows[4]!.id);
  });

  it('a viewer sees the numbers but no contact details, and can’t search by them', async () => {
    const page = await payments(VIEWER, {});
    expect(page.total).toBe(11);
    expect(page.rows.map((r) => r.email)).toContain('a***@example.com');
    expect(JSON.stringify(page)).not.toContain('a-cust@example.com');
    expect((await payments(VIEWER, { q: 'd-cust@' })).total).toBe(0);
    const o = await call<{ atRisk: { email: string }[] }>('admin_finance_overview', [VIEWER, PRICES, NOW]);
    expect(o.atRisk.map((r) => r.email)).toEqual(['e***@example.com', 'g***@example.com']);
  });

  it('the export: the payments that match, recorded in the record of actions — finance.export only', async () => {
    expect(await reason(call('admin_finance_export', [VIEWER, {}]))).toContain('forbidden');
    expect(await reason(call('admin_finance_export', [SUPPORT, {}]))).toContain('forbidden');
    const rows = await commit<{ ref: string; email: string }[]>('admin_finance_export', [
      FINANCE,
      { status: 'paid', product: 'credits_100' },
    ]);
    expect(rows.map((r) => r.ref)).toEqual(['page-d2', 'page-d3', 'page-d4']);
    expect(rows[0]!.email).toBe('d-cust@example.com');
    const [audit] = (
      await q(
        `select actor_email, action, target_type, details from public.admin_audit where action = 'finance.export'`,
      )
    ).rows;
    expect(audit).toEqual({
      actor_email: 'finance@example.com',
      action: 'finance.export',
      target_type: 'payment',
      details: { filters: { status: 'paid', product: 'credits_100' }, rows: 3 },
    });
  });

  it('support (no finance.view) and anyone who isn’t staff can’t read the money', async () => {
    for (const actor of [SUPPORT, HOST])
      for (const [fn, args] of [
        ['admin_finance_overview', [actor, PRICES, NOW]],
        ['admin_finance_payments', [actor, {}, 10, 0]],
        ['admin_finance_summary', [actor, PRICES, NOW]],
        ['admin_finance_export', [actor, {}]],
      ] as const)
        expect(await reason(call(fn, [...args])), `${fn} ${actor}`).toContain('forbidden');
  });
});

// ─── messages ──────────────────────────────────────────────────────────────────────────────────

describe('the messages', () => {
  type Messages = Record<string, unknown> & {
    days: { day: string; kind: string; status: string; n: number }[];
    totals: { kind: string; status: string; n: number; usd: number }[];
    failures: Record<string, unknown>[];
  };
  const overview = (actor = OWNER) => call<Messages>('admin_messages_overview', [actor, NOW]);

  it('WhatsApp’s three kinds over 30 days: by day, kind and status, with their cost', async () => {
    const m = await overview();
    expect([m.from, m.to]).toEqual(['2026-08-17', '2026-09-15']);
    expect(m.totals).toEqual([
      { kind: 'gallery', status: 'delivered', n: 1, usd: 0.0353 },
      { kind: 'gallery', status: 'failed', n: 1, usd: 0.0353 },
      { kind: 'invitation', status: 'delivered', n: 1, usd: 0.0353 },
      { kind: 'invitation', status: 'failed', n: 1, usd: 0.0353 },
      { kind: 'invitation', status: 'queued', n: 1, usd: 0.0353 },
      { kind: 'invitation', status: 'read', n: 3, usd: 0.1059 },
      { kind: 'invitation', status: 'sent', n: 1, usd: 0.0353 },
      { kind: 'table', status: 'failed', n: 1, usd: 0.0353 },
      { kind: 'table', status: 'read', n: 2, usd: 0.0706 },
    ]);
    // each on the day it was queued, Israel time
    expect(m.days.filter((d) => d.day === '2026-08-31' || d.day === '2026-09-01')).toEqual([
      { day: '2026-08-31', kind: 'invitation', status: 'read', n: 1 },
      { day: '2026-09-01', kind: 'invitation', status: 'read', n: 1 },
    ]);
    // what Meta charges for this month (not the failed, not the queued, not August's)
    expect(m.monthUsd).toBe(0.2471);
  });

  it('the queues now, the failures by error and the latest ones, the numbers that asked to stop, the emails', async () => {
    const m = await overview();
    expect(m.queue).toEqual([
      {
        kind: 'invitation',
        queued: 1,
        retrying: 0,
        sending: 0,
        stuck: 0,
        oldestAt: '2026-09-15T08:00:00+00:00',
      },
      { kind: 'table', queued: 0, retrying: 0, sending: 0, stuck: 0, oldestAt: null },
      { kind: 'gallery', queued: 0, retrying: 0, sending: 0, stuck: 0, oldestAt: null },
    ]);
    expect(m.errors).toEqual([
      {
        error: '(#131026) Message undeliverable',
        n: 2,
        invitation: 1,
        table: 0,
        gallery: 1,
        lastAt: '2026-09-08T07:30:00+00:00',
      },
      {
        error: '(#131049) Meta chose not to deliver',
        n: 1,
        invitation: 0,
        table: 1,
        gallery: 0,
        lastAt: '2026-09-07T08:00:00+00:00',
      },
    ]);
    expect(m.failures.map((f) => [f.kind, f.error])).toEqual([
      ['gallery', '(#131026) Message undeliverable'],
      ['table', '(#131049) Meta chose not to deliver'],
      ['invitation', '(#131026) Message undeliverable'],
    ]);
    expect(m.failures[0]).toMatchObject({
      invitationId: inv,
      slug: 'adm-money-wedding',
      hosts: { primary: { he: 'אורית' } },
      ownerId: A,
      ownerName: 'אורית אביב',
      ownerEmail: 'a-cust@example.com',
    });
    expect(m.optOuts).toEqual({ total: 3, last30: 2, reply: 2, meta: 1 });
    expect(m.emails).toEqual([
      { day: '2026-09-10', kind: 'billing_alert', status: 'skipped', n: 1 },
      { day: '2026-09-10', kind: 'contact', status: 'sent', n: 2 },
      { day: '2026-09-14', kind: 'rsvp_reply', status: 'failed', n: 1 },
      { day: '2026-09-14', kind: 'rsvp_reply', status: 'sent', n: 3 },
    ]);
  });

  it('every role sees the messages; a viewer without the owners’ contact details; not staff: no', async () => {
    const m = await overview(VIEWER);
    expect(m.failures[0]).toMatchObject({ ownerName: 'אורית אביב', ownerEmail: 'a***@example.com' });
    expect(JSON.stringify(m)).not.toContain('a-cust@example.com');
    expect(await overview(SUPPORT)).toMatchObject({ monthUsd: 0.2471 });
    expect(await reason(overview(HOST))).toContain('forbidden');
  });

  it('the log of emails keeps a kind and an outcome, nothing else', async () => {
    await commit('email_log_add', ['review', 'sent']);
    await commit('email_log_add', ['Not A Kind!', 'weird']);
    const rows = (await q(`select kind, status from public.email_log order by id desc limit 2`)).rows;
    expect(rows).toEqual([
      { kind: 'other', status: 'failed' },
      { kind: 'review', status: 'sent' },
    ]);
    await q(`delete from public.email_log where kind in ('other', 'review')`);
  });
});

// ─── Badook Events ─────────────────────────────────────────────────────────────────────────────

describe('where Badook Events accounts came from', () => {
  const plan = { path: 'venues/x/plan.png', contentType: 'image/png', width: 1000, height: 800, bytes: 5000 };
  const MOSHE = { id: 'be-u-1', name: 'משה לוי', email: 'Moshe@Venue.Example.com', role: 'owner' };
  const RONIT = { id: 'be-u-7', name: 'רונית כהן', email: 'ronit@venue.example.com', role: 'manager' };

  it('a venue keeps its owner: set with it, kept when not sent, cleared by null; the older call still works', async () => {
    const put = (venue: string, fields: string[], name: string | null, owner: object | null) =>
      commit<{ ok: boolean; venue: { owner: unknown } }>('partner_venue_put', [
        P,
        venue,
        fields,
        name,
        'הרצל 1',
        null,
        fields.includes('floorPlan') ? plan : null,
        owner,
      ]);
    const made = await put('hall-17', ['name', 'address', 'floorPlan', 'owner'], 'אולמי הגן', MOSHE);
    expect(made.venue.owner).toEqual({
      id: 'be-u-1',
      name: 'משה לוי',
      email: 'moshe@venue.example.com',
      role: 'owner',
    });
    expect((await put('hall-17', ['address'], null, null)).venue.owner).toMatchObject({ id: 'be-u-1' });
    expect(
      (
        await call<{ venue: { owner: unknown } }>('partner_venue_put', [
          P,
          'hall-17',
          ['owner'],
          null,
          null,
          null,
          null,
          null,
        ])
      ).venue.owner,
    ).toBeNull();
    // the call as it was before owners (seven arguments)
    const second = await commit<{ ok: boolean; created: boolean; venue: { owner: unknown } }>(
      'partner_venue_put',
      [P, 'hall-22', ['name'], 'לגונה', null, null, null],
    );
    expect(second).toMatchObject({ ok: true, created: true, venue: { owner: null } });
    for (const [user, venue] of [
      [C, 'hall-17'],
      [P2, 'hall-17'],
      [P3, 'hall-22'],
    ])
      expect(await commit('partner_user_venue_set', [P, user, venue])).toMatchObject({ ok: true });
  });

  it('records each provisioning with who in Badook Events made it and the account’s venue — only the partner’s accounts', async () => {
    expect(
      await commit('partner_provision_record', [
        P,
        C,
        'created',
        { ...RONIT, email: ' Ronit@Venue.Example.com ' },
      ]),
    ).toBe(true);
    expect(await commit('partner_provision_record', [P, C, 'login_link', null])).toBe(true);
    expect(await commit('partner_provision_record', [P, P2, 'created', null])).toBe(true);
    // a later update by someone else doesn't change who opened it
    expect(
      await commit('partner_provision_record', [P, P2, 'updated', { id: 'be-u-9', name: 'Someone' }]),
    ).toBe(true);
    expect(
      await commit('partner_provision_record', [
        P,
        P4,
        'linked',
        { id: 'be-u-7', name: 'רונית כהן', role: 'manager', email: '' },
      ]),
    ).toBe(true);
    // an account opened some other way: nothing
    expect(await commit('partner_provision_record', [P, A, 'created', RONIT])).toBe(false);
    // an empty id is nobody
    expect(await commit('partner_provision_record', [P, P4, 'updated', { id: '  ', name: 'x' }])).toBe(true);
    const rows = (
      await q(
        `select p.user_id, p.action, p.created_by_id, p.created_by_name, p.created_by_email, p.created_by_role, v.external_id as venue
         from public.partner_provisions p left join public.partner_venues v on v.id = p.venue_id order by p.id`,
      )
    ).rows;
    expect(rows).toEqual([
      {
        user_id: C,
        action: 'created',
        created_by_id: 'be-u-7',
        created_by_name: 'רונית כהן',
        created_by_email: 'ronit@venue.example.com',
        created_by_role: 'manager',
        venue: 'hall-17',
      },
      {
        user_id: C,
        action: 'login_link',
        created_by_id: null,
        created_by_name: null,
        created_by_email: null,
        created_by_role: null,
        venue: 'hall-17',
      },
      {
        user_id: P2,
        action: 'created',
        created_by_id: null,
        created_by_name: null,
        created_by_email: null,
        created_by_role: null,
        venue: 'hall-17',
      },
      {
        user_id: P2,
        action: 'updated',
        created_by_id: 'be-u-9',
        created_by_name: 'Someone',
        created_by_email: null,
        created_by_role: null,
        venue: 'hall-17',
      },
      {
        user_id: P4,
        action: 'linked',
        created_by_id: 'be-u-7',
        created_by_name: 'רונית כהן',
        created_by_email: null,
        created_by_role: 'manager',
        venue: null,
      },
      {
        user_id: P4,
        action: 'updated',
        created_by_id: null,
        created_by_name: null,
        created_by_email: null,
        created_by_role: null,
        venue: null,
      },
    ]);
    // P4 edited an invitation in the last 30 days (active)
    await q(
      `insert into public.invitations (owner_id, template_id, slug, status, event_type, draft, created_at, updated_at)
       values ($1, 'sahar-bordeaux', 'adm-money-p4', 'draft', 'wedding', '{}', '2026-09-13T10:00:00+03:00', '2026-09-13T10:00:00+03:00')`,
      [P4],
    );
  });

  it('the Badook Events area: its accounts, who opened them, its venues', async () => {
    const o = await call<Record<string, unknown>>('admin_partners_overview', [OWNER, P, NOW]);
    expect(o.accounts).toEqual({
      total: 4,
      // C (10 Sep) and P4 (12 Sep)
      last30: 2,
      // C signed in, P4 edited an invitation
      active30: 2,
      paid: 1,
      revenue: 39.2,
      revenueMonth: 39.2,
      // P3: opened before the calls said who, in a venue without an owner
      unknownOpener: 1,
    });
    expect(o.openers).toEqual([
      {
        id: 'be-u-7',
        name: 'רונית כהן',
        role: 'manager',
        email: 'ronit@venue.example.com',
        via: 'call',
        accounts: 2,
        paid: 1,
        venues: ['אולמי הגן'],
        lastAt: '2026-09-12T06:00:00+00:00',
      },
      {
        id: 'be-u-1',
        name: 'משה לוי',
        role: 'owner',
        email: 'moshe@venue.example.com',
        via: 'venue',
        accounts: 1,
        paid: 0,
        venues: ['אולמי הגן'],
        lastAt: '2026-08-01T06:00:00+00:00',
      },
    ]);
    expect(o.venues).toMatchObject([
      {
        id: 'hall-17',
        name: 'אולמי הגן',
        address: 'הרצל 1',
        floorPlan: true,
        planType: 'image/png',
        accounts: 2,
        owner: { id: 'be-u-1', name: 'משה לוי', role: 'owner', email: 'moshe@venue.example.com' },
      },
      { id: 'hall-22', name: 'לגונה', floorPlan: false, accounts: 1, owner: null },
    ]);
  });

  it('the accounts, searched; a viewer gets them without contact details', async () => {
    type Page = { total: number; rows: Record<string, unknown>[] };
    const page = (actor: string, query: string | null, limit = 50, offset = 0) =>
      call<Page>('admin_partners_accounts', [actor, P, query, limit, offset, NOW]);
    const all = await page(OWNER, null);
    expect(all.total).toBe(4);
    expect(all.rows.map((r) => r.userId)).toEqual([P4, C, P2, P3]);
    expect(all.rows[1]).toEqual({
      userId: C,
      name: 'רחל כהן',
      email: 'c-cust@example.com',
      phone: '+972521234567',
      externalId: 'be-c-1',
      openedAt: '2026-09-10T06:00:00+00:00',
      opener: {
        id: 'be-u-7',
        name: 'רונית כהן',
        email: 'ronit@venue.example.com',
        role: 'manager',
        via: 'call',
      },
      venue: { id: 'hall-17', name: 'אולמי הגן' },
      plan: 'pro',
      planStatus: 'active',
      paidPlan: true,
      active: true,
      invitations: 0,
      revenue: 39.2,
      lastSignInAt: '2026-09-14T06:00:00+00:00',
      userManaged: false,
    });
    expect(all.rows[2]).toMatchObject({ userId: P2, opener: { id: 'be-u-1', via: 'venue' } });
    expect(all.rows[3]).toMatchObject({
      userId: P3,
      opener: null,
      userManaged: true,
      venue: { id: 'hall-22' },
    });
    expect((await page(OWNER, 'רונית')).rows.map((r) => r.userId)).toEqual([P4, C]);
    expect((await page(OWNER, 'hall-22')).rows.map((r) => r.userId)).toEqual([P3]);
    expect((await page(OWNER, 'BE-C-2')).rows.map((r) => r.userId)).toEqual([P2]);
    expect((await page(OWNER, 'p2@example')).total).toBe(1);
    expect((await page(OWNER, null, 2, 2)).rows.map((r) => r.userId)).toEqual([P2, P3]);
    const viewer = await page(VIEWER, null);
    expect(viewer.rows[1]).toMatchObject({
      email: 'c***@example.com',
      phone: '+972 5X-XXX-X567',
      opener: { name: 'רונית כהן', email: 'r***@venue.example.com' },
    });
    expect(viewer.rows[2]).toMatchObject({ phone: '+14 XXX-X123' });
    expect(JSON.stringify(viewer)).not.toMatch(/c-cust@|0521234567|ronit@/);
    // a viewer can't find an account by the email they don't see
    expect((await page(VIEWER, 'p2@example')).total).toBe(0);
  });

  it('a user’s page: where the account came from; nothing for an account opened some other way', async () => {
    expect(await call('admin_partners_user_source', [OWNER, P, A])).toBeNull();
    const source = await call<Record<string, unknown>>('admin_partners_user_source', [OWNER, P, C]);
    expect(source).toEqual({
      source: P,
      externalId: 'be-c-1',
      openedAt: '2026-09-10T06:00:00+00:00',
      opener: {
        id: 'be-u-7',
        name: 'רונית כהן',
        email: 'ronit@venue.example.com',
        role: 'manager',
        via: 'call',
      },
      venue: { id: 'hall-17', name: 'אולמי הגן', address: 'הרצל 1' },
      userManaged: false,
      provisions: [
        { action: 'login_link', at: expect.any(String), by: null, venue: 'אולמי הגן' },
        {
          action: 'created',
          at: expect.any(String),
          by: { id: 'be-u-7', name: 'רונית כהן', role: 'manager', email: 'ronit@venue.example.com' },
          venue: 'אולמי הגן',
        },
      ],
    });
    // the venue's owner opened it when the call didn't say
    expect(await call('admin_partners_user_source', [OWNER, P, P2])).toMatchObject({
      opener: { id: 'be-u-1', name: 'משה לוי', via: 'venue' },
    });
    const masked = await call<{ opener: { email: string }; provisions: { by: { email: string } | null }[] }>(
      'admin_partners_user_source',
      [VIEWER, P, C],
    );
    expect(masked.opener.email).toBe('r***@venue.example.com');
    expect(masked.provisions[1]!.by!.email).toBe('r***@venue.example.com');
  });

  it('the activity feed: accounts opened, with who opened them — names only', async () => {
    const lines = await call<Record<string, unknown>[]>('admin_partners_activity', [VIEWER, P, 10]);
    expect(lines.map((l) => [l.userId, l.action, l.byName, l.byRole, l.venue])).toEqual([
      [P4, 'linked', 'רונית כהן', 'manager', null],
      [P2, 'created', 'משה לוי', 'owner', 'אולמי הגן'],
      [C, 'created', 'רונית כהן', 'manager', 'אולמי הגן'],
    ]);
    expect(JSON.stringify(lines)).not.toContain('@');
  });

  it('the API’s health: calls a day, the last 24 hours, the last call and error, by endpoint', async () => {
    for (const [method, endpoint, status, code, ms, at] of [
      ['POST', '/users', 201, null, 100, '2026-09-15T10:00:00+03:00'],
      ['POST', '/users', 409, 'account_exists', 50, '2026-09-15T10:30:00+03:00'],
      ['GET', '/users', 200, null, 120, '2026-09-15T11:00:00+03:00'],
      ['PUT', '/venues/{venueId}', 500, 'server_error', 900, '2026-09-14T09:00:00+03:00'],
      // before the 30 days
      ['POST', '/discounts', 200, null, 80, '2026-08-10T10:00:00+03:00'],
    ] as const)
      await q(
        `insert into public.partner_api_calls (source, method, endpoint, status, code, duration_ms, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [P, method, endpoint, status, code, ms, at],
      );
    const { api } = await call<{ api: Record<string, unknown> & { days: { day: string }[] } }>(
      'admin_partners_overview',
      [VIEWER, P, NOW],
    );
    expect(api.days).toHaveLength(30);
    expect(api.days.slice(-2)).toEqual([
      { day: '2026-09-14', ok: 0, refused: 0, failed: 1 },
      { day: '2026-09-15', ok: 2, refused: 1, failed: 0 },
    ]);
    expect(api.last24h).toEqual({ calls: 3, refused: 1, failed: 0, avgMs: 90 });
    expect(api.lastCall).toEqual({
      at: '2026-09-15T08:00:00+00:00',
      method: 'GET',
      endpoint: '/users',
      status: 200,
      code: null,
      durationMs: 120,
    });
    expect(api.lastError).toMatchObject({ method: 'POST', status: 409, code: 'account_exists' });
    expect(api.endpoints).toEqual([
      { method: 'POST', endpoint: '/users', calls: 2, refused: 1, failed: 0, avgMs: 75 },
      { method: 'GET', endpoint: '/users', calls: 1, refused: 0, failed: 0, avgMs: 120 },
      { method: 'PUT', endpoint: '/venues/{venueId}', calls: 1, refused: 0, failed: 1, avgMs: 900 },
    ]);
  });

  it('the call log keeps a route, an answer and an account — what isn’t one is left out', async () => {
    await commit('partner_api_call_log', [P, 'patch', '/users', 400, 'Invalid Code!', id(999), -5]);
    await commit('partner_api_call_log', [P, 'POST', '/login-links', 200, null, C, 42]);
    const rows = (
      await q(
        `select method, endpoint, status, code, user_id, duration_ms from public.partner_api_calls order by id desc limit 2`,
      )
    ).rows;
    expect(rows).toEqual([
      { method: 'POST', endpoint: '/login-links', status: 200, code: null, user_id: C, duration_ms: 42 },
      { method: 'PATCH', endpoint: '/users', status: 400, code: null, user_id: null, duration_ms: 0 },
    ]);
    expect(
      await reason(
        commit('partner_api_call_log', [P, 'GET', 'users?email=x@example.com', 200, null, null, 1]),
      ),
    ).not.toBe('ok');
  });

  it('every role sees the Badook Events area; anyone who isn’t staff doesn’t', async () => {
    for (const actor of [SUPPORT, FINANCE, VIEWER])
      expect(await call('admin_partners_overview', [actor, P, NOW])).toMatchObject({
        accounts: { total: 4 },
      });
    for (const [fn, args] of [
      ['admin_partners_overview', [HOST, P, NOW]],
      ['admin_partners_accounts', [HOST, P, null, 10, 0, NOW]],
      ['admin_partners_user_source', [HOST, P, C]],
      ['admin_partners_activity', [HOST, P, 10]],
    ] as const)
      expect(await reason(call(fn, [...args])), fn).toContain('forbidden');
  });
});

// ─── what is kept, and who may call ────────────────────────────────────────────────────────────

describe('keeping and privileges', () => {
  it('the partner API’s calls and the log of emails are kept 90 days', async () => {
    await q(
      `insert into public.partner_api_calls (source, method, endpoint, status, duration_ms, created_at) values
         ($1, 'GET', '/users', 200, 1, now() - interval '91 days'),
         ($1, 'GET', '/users', 200, 1, now() - interval '89 days')`,
      [P],
    );
    await q(
      `insert into public.email_log (kind, status, created_at) values
         ('contact', 'sent', now() - interval '91 days'), ('contact', 'sent', now() - interval '89 days')`,
    );
    const old = async () =>
      (
        await q(
          `select (select count(*) from public.partner_api_calls where created_at < now() - interval '90 days')::int as calls,
                  (select count(*) from public.email_log where created_at < now() - interval '90 days')::int as emails`,
        )
      ).rows[0] as { calls: number; emails: number };
    const before = await old();
    expect(await commit('admin_logs_maintenance', [])).toEqual({
      partnerCalls: before.calls,
      emails: before.emails,
    });
    expect(await old()).toEqual({ calls: 0, emails: 0 });
    const kept = await q(
      `select count(*)::int as n from public.partner_api_calls where created_at > now() - interval '90 days' and created_at < now() - interval '88 days'`,
    );
    expect(kept.rows[0].n).toBe(1);
  });

  it('only the server calls the functions; the helpers not even the server; the tables are closed', async () => {
    for (const role of ['anon', 'authenticated'] as const)
      for (const sql of [
        `select public.admin_finance_overview('${OWNER}', '{}', now())`,
        `select public.admin_messages_overview('${OWNER}', now())`,
        `select public.admin_partners_overview('${OWNER}', 'x', now())`,
        `select public.partner_provision_record('x', '${C}', 'created', null)`,
        `select public.partner_api_call_log('x', 'GET', '/users', 200, null, null, 1)`,
        `select public.email_log_add('other', 'sent')`,
        `select public.admin_logs_maintenance()`,
      ])
        expect(await reason(as(c, role, HOST, () => q(sql))), `${role}: ${sql}`).toContain(
          'permission denied',
        );
    for (const helper of [
      `select public.admin_view_email('a@example.com', 'owner')`,
      `select public.admin_view_phone('+972501234567', 'owner')`,
      `select * from public.admin_payments_between(null, null)`,
      `select * from public.admin_whatsapp_between(now(), now())`,
      `select public.admin_partner_opener('${C}', 'owner')`,
      `select * from public.admin_partner_rows('owner', 'x', now())`,
      `select * from public.admin_payments_rows('owner', '{}')`,
      `select public.partner_actor_json('{"id":"x"}')`,
    ])
      expect(await reason(as(c, 'service_role', null, () => q(helper))), helper).toContain(
        'permission denied',
      );
    for (const table of ['partner_provisions', 'partner_api_calls', 'email_log'])
      expect(
        await reason(as(c, 'authenticated', HOST, () => q(`select * from public.${table}`))),
        table,
      ).toContain('permission denied');
  });
});

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { effectivePlan, type AccountPlanState, type PlanId } from '@/features/billing/plans';
import { as, createTestDatabase } from './harness';

// The admin console's core (supabase/migrations/*_admin_core.sql): the overview's numbers and feed, the
// users and invitations, the team's actions on them, the record of actions in words and the system.

const OWNER = '88888888-8888-4888-8888-888888888801';
const ADMIN = '88888888-8888-4888-8888-888888888802';
const SUPPORT = '88888888-8888-4888-8888-888888888803';
const FINANCE = '88888888-8888-4888-8888-888888888804';
const VIEWER = '88888888-8888-4888-8888-888888888805';
const ADMIN2 = '88888888-8888-4888-8888-888888888806';
const OWNER2 = '88888888-8888-4888-8888-888888888807';
// customers
const DANA = '99999999-9999-4999-8999-999999999901'; // signed up with Google, pro, credits
const EYAL = '99999999-9999-4999-8999-999999999902'; // opened by Badook Events, at a venue
const NOA = '99999999-9999-4999-8999-999999999903'; // signed up by email, no account row yet
const PAYER = '99999999-9999-4999-8999-999999999904'; // pays for Business through PayPlus
const OLD = '99999999-9999-4999-8999-999999999905'; // joined 90 days ago
const DEMO = '00000000-0000-4000-8000-00000000d3e0';

const INV_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'; // Dana's wedding, published 3 days ago
const INV_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'; // Dana's draft, today
const INV_C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'; // Eyal's bar mitzvah, 10 days ago, published
const INV_D = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04'; // Old's archived birthday, 40 days ago

let db: { url: string; drop: () => Promise<void> };
let c: Client;

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
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await c.query(sql, params)).rows[0] as T;

// Times relative to now that fall in exactly one period each ("today" is Israel's).
const D0 = `(date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem')`;
const T = {
  today: `(${D0} + (now() - ${D0}) / 2)`,
  yesterday: `((${D0} - interval '1 day') + ((now() - interval '1 day') - (${D0} - interval '1 day')) / 2)`,
  d3: `(now() - interval '3 days')`,
  d10: `(now() - interval '10 days')`,
  d40: `(now() - interval '40 days')`,
  d90: `(now() - interval '90 days')`,
};

const doc = (primary: string, secondary: string | null, date: string) => ({
  defaultLocale: 'he',
  locales: ['he', 'en'],
  hosts: {
    primary: { he: primary, en: primary },
    secondary: secondary ? { he: secondary, en: secondary } : null,
    joiner: null,
  },
  event: { date },
});

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  const partner = { provider: 'email', providers: ['email'], provisioned_by: 'partner:badook-events' };
  await c.query(
    `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, email_confirmed_at, last_sign_in_at) values
       ($1, 'owner@example.com', '{}', '{"name":"Avichai"}', now() - interval '200 days', now(), now()),
       ($2, 'admin@example.com', '{}', '{"name":"Adi Admin"}', now() - interval '200 days', now(), now()),
       ($3, 'support@example.com', '{}', '{"name":"Sapir"}', now() - interval '200 days', now(), now()),
       ($4, 'finance@example.com', '{}', '{}', now() - interval '200 days', now(), now()),
       ($5, 'viewer@example.com', '{}', '{"name":"Vered"}', now() - interval '200 days', now(), now()),
       ($6, 'admin2@example.com', '{}', '{"name":"Second Admin"}', now() - interval '200 days', now(), null),
       ($7, 'owner2@example.com', '{}', '{"name":"Second Owner"}', now() - interval '200 days', now(), null)`,
    [OWNER, ADMIN, SUPPORT, FINANCE, VIEWER, ADMIN2, OWNER2],
  );
  await c.query(
    `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, email_confirmed_at, last_sign_in_at) values
       ($1, 'dana.cohen@gmail.example.com', '{"provider":"google","providers":["google"]}', '{"full_name":"Dana Cohen"}', ${T.today}, now(), now()),
       ($2, 'eyal@example.com', $6, '{}', ${T.d3}, now(), ${T.d10}),
       ($3, 'noa@example.com', '{"provider":"email","providers":["email"]}', '{"name":"Noa Levi"}', ${T.d10}, now(), null),
       ($4, 'payer@example.com', '{"provider":"email","providers":["email"]}', '{"name":"Paying Customer"}', ${T.d40}, now(), now()),
       ($5, 'old@example.com', '{"provider":"email","providers":["email"]}', '{"name":"Old Timer"}', ${T.d90}, now(), ${T.d40})`,
    [DANA, EYAL, NOA, PAYER, OLD, partner],
  );
  // the staff (the owner as production adds the first one; the rest through the console)
  await c.query(`insert into public.admin_staff (email, role) values ('owner@example.com', 'owner')`);
  for (const [email, role] of [
    ['admin@example.com', 'admin'],
    ['support@example.com', 'support'],
    ['finance@example.com', 'finance'],
    ['viewer@example.com', 'viewer'],
    ['admin2@example.com', 'admin'],
    ['owner2@example.com', 'owner'],
  ])
    await commit('admin_staff_set', [OWNER, email, role, null]);
  // accounts (Noa has none yet: she never opened the app)
  await c.query(
    `insert into public.accounts (user_id, full_name, phone, plan, plan_status, plan_renews_at, message_credits, source,
                                  billing_provider, billing_subscription_id, plan_price, created_at) values
       ($1, 'Dana Cohen', '+972501234567', 'pro', 'active', now() + interval '20 days', 40, 'google', null, null, null, ${T.today}),
       ($2, 'Eyal Mizrahi', '+972521112233', 'free', 'active', null, 0, 'partner:badook-events', null, null, null, ${T.d3}),
       ($3, 'Paying Customer', '+972541234000', 'business', 'active', now() + interval '10 days', 300, 'signup', 'payplus', 'sub-123', 149, ${T.d40}),
       ($4, 'Old Timer', null, 'free', 'active', null, 5, 'signup', null, null, null, ${T.d90})`,
    [DANA, EYAL, PAYER, OLD],
  );
  await c.query(`update public.accounts set external_id = 'be-777' where user_id = $1`, [EYAL]);
  await c.query(
    `insert into public.partner_venues (id, source, external_id, name) values
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'partner:badook-events', 'venue-1', 'Gan Eden Hall')`,
  );
  await c.query(
    `insert into public.partner_venue_users (user_id, venue_id) values ($1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01')`,
    [EYAL],
  );
  // invitations
  await c.query(
    `insert into public.invitations (id, owner_id, template_id, slug, status, event_type, draft, published, created_at, published_at) values
       ($1, $5, 'sahar-bordeaux', 'dana-and-omer', 'published', 'wedding', $6, $6, ${T.d3}, ${T.d3}),
       ($2, $5, 'sahar-bordeaux', 'dana-draft', 'draft', 'engagement', $7, null, ${T.today}, null),
       ($3, $8, 'jerusalem-stone', 'eyal-bar-mitzvah', 'published', 'bar_mitzvah', $9, $9, ${T.d10}, ${T.d10}),
       ($4, $10, 'kalanit', 'old-birthday', 'archived', 'birthday', $11, $11, ${T.d40}, ${T.d40})`,
    [
      INV_A,
      INV_B,
      INV_C,
      INV_D,
      DANA,
      doc('דנה', 'עומר', '2027-01-10'),
      doc('Dana', null, '2027-03-01'),
      EYAL,
      { ...doc('איל', null, '2026-10-20'), locales: ['he', 'ru'] },
      OLD,
      doc('Old', null, '2026-08-01'),
    ],
  );
  // first publishes (they went live then); INV_A was published twice
  await c.query(
    `insert into public.invitation_versions (invitation_id, version, document, kind, created_at) values
       ($1, 1, '{}', 'publish', ${T.d3}), ($1, 2, '{}', 'publish', ${T.today}),
       ($2, 1, '{}', 'publish', ${T.d10}), ($3, 1, '{}', 'publish', ${T.d40})`,
    [INV_A, INV_C, INV_D],
  );
  // guests
  await c.query(
    `insert into public.invitation_guests (invitation_id, name, phone, token) values
       ($1, 'Guest 1', '+972500000001', 'tok-a-000000000001'), ($1, 'Guest 2', '+972500000002', 'tok-a-000000000002'),
       ($1, 'Guest 3', null, 'tok-a-000000000003'), ($2, 'Guest 4', '+972500000004', 'tok-c-000000000004')`,
    [INV_A, INV_C],
  );
  // RSVPs: today 2 (coming 3 + 2 people... one declines), yesterday 1, 3 days 1, 10 days 1, 40 days 1
  await c.query(
    `insert into public.rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, created_at) values
       ($1, true, 'he', 'Rsvp 1', 2, 1, 'h1', ${T.today}),
       ($1, false, 'he', 'Rsvp 2', 0, 0, 'h2', ${T.today}),
       ($1, true, 'he', 'Rsvp 3', 2, 0, 'h3', ${T.yesterday}),
       ($2, true, 'he', 'Rsvp 4', 1, 0, 'h4', ${T.d3}),
       ($2, true, 'he', 'Rsvp 5', 4, 2, 'h5', ${T.d10}),
       ($3, true, 'he', 'Rsvp 6', 1, 0, 'h6', ${T.d40})`,
    [INV_A, INV_C, INV_D],
  );
  // a reply to one of the site's samples: never counted
  await c.query(
    `insert into public.rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, created_at)
     select id, true, 'he', 'Demo', 9, 0, 'hd', now() from public.invitations where owner_id = $1 limit 1`,
    [DEMO],
  );
  // WhatsApp: a batch of 3 today to INV_A (2 delivered/read, 1 failed now), 2 sent 3 days ago, 1 queued now
  await c.query(
    `insert into public.whatsapp_messages (invitation_id, owner_id, to_phone, status, created_at, updated_at) values
       ($1, $3, '+972500000001', 'delivered', date_trunc('minute', ${T.today}), now()),
       ($1, $3, '+972500000002', 'read', date_trunc('minute', ${T.today}), now()),
       ($1, $3, '+972500000009', 'failed', date_trunc('minute', ${T.today}), now()),
       ($1, $3, '+972500000001', 'sent', date_trunc('minute', ${T.d3}), ${T.d3}),
       ($1, $3, '+972500000002', 'sent', date_trunc('minute', ${T.d3}), ${T.d3}),
       ($2, $4, '+972500000004', 'queued', now(), now())`,
    [INV_A, INV_C, DANA, EYAL],
  );
  // a table number (event day) and a gallery link, both from the system's number, 10 days ago
  await c.query(
    `insert into public.seating_units (id, invitation_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', $1)`,
    [INV_C],
  );
  await c.query(
    `insert into public.seating_notices (invitation_id, unit_id, owner_id, table_number, channel, status, to_phone, created_at, updated_at) values
       ($1, 'cccccccc-cccc-4ccc-8ccc-cccccccccc01', $2, 4, 'whatsapp', 'delivered', '+972500000004', ${T.d10}, ${T.d10}),
       ($1, 'cccccccc-cccc-4ccc-8ccc-cccccccccc01', $2, 4, 'manual', 'sent', null, ${T.d10}, ${T.d10})`,
    [INV_C, EYAL],
  );
  await c.query(
    `insert into public.gallery_notices (invitation_id, owner_id, channel, status, to_phone, created_at, updated_at) values
       ($1, $2, 'whatsapp', 'read', '+972500000004', ${T.d10}, ${T.d10})`,
    [INV_C, EYAL],
  );
  // visits
  await c.query(
    `insert into public.insight_daily (invitation_id, day, visits) values ($1, current_date, 12)`,
    [INV_A],
  );
  // credits this month: Dana sent 3 (one refunded); Payer bought 300
  await c.query(
    `insert into public.credit_ledger (user_id, delta, reason, ref, created_at) values
       ($1, -3, 'whatsapp_send', $3, now()), ($1, 1, 'whatsapp_refund', null, now()),
       ($2, 300, 'purchase', 'evt-1', now())`,
    [DANA, PAYER, INV_A],
  );
  // payments: Payer's plan and a renewal
  await c.query(
    `insert into public.billing_checkouts (user_id, product, amount, provider, status, created_at, completed_at) values
       ($1, 'business', 149, 'payplus', 'paid', ${T.d40}, ${T.d40}),
       ($1, 'credits_100', 16, 'payplus', 'failed', ${T.d10}, ${T.d10})`,
    [PAYER],
  );
  await c.query(
    `insert into public.billing_events (id, provider, type, user_id, payload, product, amount, created_at) values
       ('payplus:renew-1', 'payplus', 'renewal.paid', $1, '{}', 'business', 149, ${T.d10})`,
    [PAYER],
  );
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

type Periods = { today: number; yesterday: number; d7: number; prev7: number; d30: number; prev30: number };

describe('who may read and act', () => {
  it('someone who isn’t staff can do nothing', async () => {
    for (const [fn, args] of [
      ['admin_overview', [DANA]],
      ['admin_activity', [DANA, 10]],
      ['admin_users', [DANA, {}]],
      ['admin_user', [DANA, DANA]],
      ['admin_audit_search', [DANA, {}]],
      ['admin_user_credits', [DANA, DANA, 10, 'a reason']],
      ['admin_user_gift', [DANA, DANA, 'pro', '2027-01-01', 'a reason']],
      ['admin_user_discount', [DANA, DANA, 10, null, null, 'a reason']],
      ['admin_user_suspend_check', [DANA, EYAL, true, 'a reason']],
      ['admin_invitations', [DANA, {}]],
      ['admin_invitation', [DANA, INV_A]],
      ['admin_invitation_feature', [DANA, INV_A, 'voice', true, 'a reason']],
      ['admin_system', [DANA]],
    ] as const)
      expect(await reason(call(fn, [...args])), fn).toBe('forbidden');
  });

  it('each role only what its permissions allow', async () => {
    for (const [fn, args] of [
      // viewer: no credits, plans, suspensions, features, record of actions or system
      ['admin_user_credits', [VIEWER, DANA, 1, 'a reason']],
      ['admin_user_gift', [VIEWER, DANA, 'pro', '2027-01-01', 'a reason']],
      ['admin_user_suspend_check', [VIEWER, EYAL, true, 'a reason']],
      ['admin_invitation_feature', [VIEWER, INV_A, 'voice', true, 'a reason']],
      ['admin_audit_search', [VIEWER, {}]],
      ['admin_system', [VIEWER]],
      // support: credits yes, plans and discounts no
      ['admin_user_gift', [SUPPORT, DANA, 'pro', '2027-01-01', 'a reason']],
      ['admin_user_discount', [SUPPORT, DANA, 10, null, null, 'a reason']],
      ['admin_user_suspend_check', [SUPPORT, EYAL, true, 'a reason']],
      ['admin_audit_search', [FINANCE, {}]],
      ['admin_system', [FINANCE]],
    ] as const)
      expect(await reason(call(fn, [...args])), `${fn} ${String(args[0])}`).toBe('forbidden');
    // what they may do
    expect(await reason(call('admin_user_credits', [SUPPORT, DANA, 5, 'a reason']))).toBe('ok');
    expect(await reason(call('admin_users', [VIEWER, {}]))).toBe('ok');
    expect(await reason(call('admin_invitations', [VIEWER, {}]))).toBe('ok');
  });

  it('only the server calls them; the helpers not even the server', async () => {
    for (const role of ['anon', 'authenticated'] as const)
      expect(
        await reason(as(c, role, DANA, () => c.query(`select public.admin_overview($1)`, [OWNER]))),
      ).toContain('permission denied');
    for (const helper of [
      `public.admin_mask_email('a@b.c')`,
      `public.admin_user_name('${DANA}')`,
      `public.admin_effective_plan('pro', 'active', now(), null, false)`,
      `public.admin_whatsapp_batches(5)`,
      `public.admin_audit_rows(null, null, null, null, null, 5)`,
    ])
      expect(await reason(as(c, 'service_role', null, () => c.query(`select ${helper}`)))).toContain(
        'permission denied',
      );
  });
});

describe('the overview', () => {
  it('counts users, invitations, RSVPs, messages and credits exactly (the samples left out)', async () => {
    const o = await call<{
      today: string;
      users: {
        total: number;
        new: Periods;
        bySource: Record<string, number>;
        bySourceTotal: Record<string, number>;
        active7: number;
      };
      invitations: { total: number; status: Record<string, number>; created: Periods; published: Periods };
      rsvps: { responses: Periods; people: Periods; declined: { d7: number; d30: number } };
      whatsapp: {
        sent: Periods;
        byKind: Record<string, number>;
        delivery: { delivered: number; read: number; settled: number };
        failed24h: number;
        queued: Record<string, number>;
      };
      credits: { inSystem: number; usedMonth: number; boughtMonth: number; teamMonth: number };
      series: { day: string; signups: number; invitations: number; rsvps: number; messages: number }[];
    }>('admin_overview', [VIEWER]);
    // 12 accounts: 7 staff (200 days ago), Dana today, Eyal 3 days, Noa 10 days, Payer 40, Old 90
    expect(o.users.total).toBe(12);
    expect(o.users.new).toEqual({ today: 1, yesterday: 0, d7: 2, prev7: 1, d30: 3, prev30: 1 });
    expect(o.users.bySource).toEqual({ signup: 1, google: 1, partner: 1 });
    expect(o.users.bySourceTotal).toEqual({ signup: 10, google: 1, partner: 1 });
    // signed in within 7 days: the 5 staff with a sign-in, Dana, Payer
    expect(o.users.active7).toBe(7);
    expect(o.invitations.total).toBe(4);
    expect(o.invitations.status).toEqual({ draft: 1, published: 2, archived: 1 });
    expect(o.invitations.created).toEqual({ today: 1, yesterday: 0, d7: 2, prev7: 1, d30: 3, prev30: 1 });
    // first publishes only (INV_A's second publish today isn't a new one)
    expect(o.invitations.published).toEqual({ today: 0, yesterday: 0, d7: 1, prev7: 1, d30: 2, prev30: 1 });
    expect(o.rsvps.responses).toEqual({ today: 2, yesterday: 1, d7: 4, prev7: 1, d30: 5, prev30: 1 });
    expect(o.rsvps.people).toEqual({ today: 3, yesterday: 2, d7: 6, prev7: 6, d30: 12, prev30: 1 });
    expect(o.rsvps.declined).toEqual({ d7: 1, d30: 1 });
    // left: 2 today (1 failed), 2 three days ago, a table number and a gallery link 10 days ago
    expect(o.whatsapp.sent).toEqual({ today: 2, yesterday: 0, d7: 4, prev7: 2, d30: 6, prev30: 0 });
    expect(o.whatsapp.byKind).toEqual({ invitation: 4, table: 1, gallery: 1 });
    expect(o.whatsapp.delivery).toEqual({ delivered: 4, read: 2, settled: 7 });
    expect(o.whatsapp.failed24h).toBe(1);
    expect(o.whatsapp.queued).toEqual({ invitation: 1, table: 0, gallery: 0 });
    expect(o.credits).toEqual({ inSystem: 345, usedMonth: 2, boughtMonth: 300, teamMonth: 0 });
    // the chart: 30 days of Israel's calendar, today last
    expect(o.series).toHaveLength(30);
    expect(o.series[29]!.day).toBe(o.today);
    const dayOf = async (expr: string) =>
      (
        await one<{ d: string }>(
          `select to_char((${expr} at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD') as d`,
        )
      ).d;
    expect(o.series[29]).toMatchObject({ signups: 1, invitations: 1, rsvps: 2, messages: 2 });
    const byDay = new Map(o.series.map((s) => [s.day, s]));
    expect(byDay.get(await dayOf(T.d3))).toMatchObject({ signups: 1, invitations: 1, rsvps: 1, messages: 2 });
    expect(byDay.get(await dayOf(T.d10))).toMatchObject({
      signups: 1,
      invitations: 1,
      rsvps: 1,
      messages: 2,
    });
    const totals = o.series.reduce(
      (t, s) => ({
        signups: t.signups + s.signups,
        invitations: t.invitations + s.invitations,
        rsvps: t.rsvps + s.rsvps,
        messages: t.messages + s.messages,
      }),
      { signups: 0, invitations: 0, rsvps: 0, messages: 0 },
    );
    expect(totals).toEqual({ signups: 3, invitations: 3, rsvps: 5, messages: 6 });
  });
});

describe('the live feed', () => {
  it('lists what happened, newest first: names only, amounts for finance.view', async () => {
    type Item = {
      id: string;
      kind: string;
      at: string;
      actor: string | null;
      subject: string | null;
      amount: number | null;
      userId: string | null;
      invitationId: string | null;
      detail: Record<string, unknown>;
    };
    const feed = await call<Item[]>('admin_activity', [VIEWER, 100]);
    const times = feed.map((f) => Date.parse(f.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const kinds = new Set(feed.map((f) => f.kind));
    for (const k of [
      'signup',
      'invitation_created',
      'invitation_published',
      'rsvp',
      'whatsapp_batch',
      'payment',
    ])
      expect(kinds.has(k), k).toBe(true);
    // Eyal's account came from Badook Events; Dana's from Google
    expect(feed.find((f) => f.id === `signup:${EYAL}`)).toMatchObject({
      actor: 'Eyal Mizrahi',
      detail: { source: 'partner:badook-events' },
    });
    expect(feed.find((f) => f.id === `signup:${DANA}`)?.detail).toEqual({ source: 'google' });
    // one line per batch: 3 today, 2 three days ago, one queued now (another minute)
    const batches = feed.filter((f) => f.kind === 'whatsapp_batch' && f.invitationId === INV_A);
    expect(batches.map((b) => b.amount)).toEqual([3, 2]);
    expect(batches[0]).toMatchObject({
      subject: 'דנה & עומר',
      userId: DANA,
      detail: { channel: 'invitation' },
    });
    expect(feed.filter((f) => f.kind === 'whatsapp_batch').map((f) => f.detail.channel)).toEqual(
      expect.arrayContaining(['invitation', 'table', 'gallery']),
    );
    // an RSVP: how many are coming; the guest isn't named
    const rsvp = feed.find((f) => f.kind === 'rsvp' && f.amount === 3)!;
    expect(rsvp).toMatchObject({ actor: null, subject: 'דנה & עומר', detail: { attending: true } });
    // the first publish only
    expect(
      feed
        .filter((f) => f.kind === 'invitation_published')
        .map((f) => f.invitationId)
        .sort(),
    ).toEqual([INV_A, INV_C, INV_D].sort());
    // a viewer has finance.view: the amounts
    expect(feed.find((f) => f.kind === 'payment' && f.detail.renewal === true)?.amount).toBe(149);
    // support hasn't: the same lines without amounts
    const support = await call<Item[]>('admin_activity', [SUPPORT, 100]);
    expect(support.filter((f) => f.kind === 'payment').map((f) => f.amount)).toEqual([null, null]);
    // no customer's email or phone anywhere in it
    const text = JSON.stringify(feed);
    for (const secret of ['dana.cohen@gmail', 'eyal@example.com', '+97250', 'payer@example.com'])
      expect(text).not.toContain(secret);
    // the samples' reply isn't there
    expect(feed.some((f) => f.kind === 'rsvp' && f.amount === 9)).toBe(false);
  });

  it('the team’s actions show as they happen, the staff member by name', async () => {
    await c.query('begin');
    try {
      await c.query(`select public.admin_user_credits($1, $2, 25, 'compensation')`, [SUPPORT, DANA]);
      await c.query(`select public.admin_staff_set($1, 'new-staff@example.com', 'viewer', null)`, [OWNER]);
      const feed = (await c.query(`select public.admin_activity($1, 5) as r`, [VIEWER])).rows[0].r as {
        kind: string;
        actor: string;
        subject: string;
        amount: number | null;
        detail: Record<string, unknown>;
      }[];
      expect(feed[0]).toMatchObject({
        kind: 'staff',
        actor: 'Avichai',
        detail: { action: 'staff.set', role: 'viewer' },
      });
      // the new member hasn't signed up: their email masked
      expect(feed[0]!.subject).toBe('n***@example.com');
      expect(feed[1]).toMatchObject({ kind: 'credits', actor: 'Sapir', subject: 'Dana Cohen', amount: 25 });
    } finally {
      await c.query('rollback');
    }
  });
});

describe('users', () => {
  type Row = {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    source: string;
    venue: string | null;
    plan: string;
    effectivePlan: string;
    credits: number;
    invitations: { active: number; total: number };
    messagesSent: number;
    staffRole: string | null;
    suspended: boolean;
    discount: { percent: number } | null;
  };
  type List = { total: number; page: number; pageSize: number; rows: Row[] };

  it('lists every account (not the samples’ owner), newest first, with their numbers', async () => {
    const list = await call<List>('admin_users', [SUPPORT, {}]);
    expect(list.total).toBe(12);
    expect(list.rows.map((r) => r.id).slice(0, 5)).toEqual([DANA, EYAL, NOA, PAYER, OLD]);
    const dana = list.rows[0]!;
    expect(dana).toMatchObject({
      name: 'Dana Cohen',
      email: 'dana.cohen@gmail.example.com',
      phone: '+972501234567',
      source: 'google',
      plan: 'pro',
      effectivePlan: 'pro',
      credits: 40,
      invitations: { active: 2, total: 2 },
      messagesSent: 4,
      staffRole: null,
      suspended: false,
    });
    expect(list.rows[1]).toMatchObject({ source: 'partner:badook-events', venue: 'Gan Eden Hall' });
    // before the account's first use: from how they signed up
    expect(list.rows[2]).toMatchObject({ name: 'Noa Levi', source: 'signup', plan: 'free', credits: 0 });
    expect(list.rows.find((r) => r.id === OWNER)?.staffRole).toBe('owner');
  });

  it('masks contact details for a role without users.pii — and searches them only with it', async () => {
    const viewer = await call<List>('admin_users', [VIEWER, {}]);
    expect(viewer.rows[0]).toMatchObject({ email: 'd***@gmail.example.com', phone: '+972 5X-XXX-X567' });
    expect(JSON.stringify(viewer)).not.toContain('dana.cohen@');
    expect(JSON.stringify(viewer)).not.toContain('1234567');
    // by name: everyone; by email or phone: users.pii only
    expect((await call<List>('admin_users', [VIEWER, { q: 'dana' }])).total).toBe(1);
    expect((await call<List>('admin_users', [VIEWER, { q: 'gmail.example' }])).total).toBe(0);
    expect((await call<List>('admin_users', [SUPPORT, { q: 'gmail.example' }])).total).toBe(1);
    expect((await call<List>('admin_users', [VIEWER, { q: '050-1234567' }])).total).toBe(0);
    expect((await call<List>('admin_users', [SUPPORT, { q: '050-1234567' }])).rows[0]?.id).toBe(DANA);
    expect((await call<List>('admin_users', [SUPPORT, { q: DANA }])).rows[0]?.id).toBe(DANA);
    // LIKE's wildcards are only characters
    expect((await call<List>('admin_users', [SUPPORT, { q: '%' }])).total).toBe(0);
  });

  it('filters by source, plan, discount, staff and suspension; sorts; pages of 50', async () => {
    const ids = async (query: object) =>
      (await call<List>('admin_users', [OWNER, query])).rows.map((r) => r.id);
    expect(await ids({ source: 'partner' })).toEqual([EYAL]);
    expect(await ids({ source: 'google' })).toEqual([DANA]);
    // the plan in force: the platform's owners have none here (none are INVITES_ADMIN_EMAILS)
    expect(await ids({ plan: 'business' })).toEqual([PAYER]);
    expect(await ids({ plan: 'pro' })).toEqual([DANA]);
    expect((await ids({ staff: true })).length).toBe(7);
    expect(await ids({ discount: true })).toEqual([]);
    expect(await ids({ suspended: true })).toEqual([]);
    expect((await ids({ sort: 'credits' })).slice(0, 3)).toEqual([PAYER, DANA, OLD]);
    expect((await ids({ sort: 'invitations' })).slice(0, 3)).toEqual([DANA, EYAL, OLD]);
    expect((await ids({ sort: 'messages' })).slice(0, 2)).toEqual([DANA, EYAL]);
    expect((await ids({ sort: 'last_sign_in' })).at(-1)).toBe(OWNER2);
    // 60 more accounts: two pages
    await c.query('begin');
    try {
      await c.query(
        `insert into auth.users (id, email, raw_app_meta_data, created_at)
         select gen_random_uuid(), 'bulk' || g || '@example.com', '{}', now() - g * interval '1 hour'
         from generate_series(1, 60) g`,
      );
      const p1 = (await c.query(`select public.admin_users($1, '{"page":1}') as r`, [OWNER])).rows[0]
        .r as List;
      const p2 = (await c.query(`select public.admin_users($1, '{"page":2}') as r`, [OWNER])).rows[0]
        .r as List;
      expect([p1.total, p1.rows.length, p2.rows.length, p2.page]).toEqual([72, 50, 22, 2]);
      expect(new Set([...p1.rows, ...p2.rows].map((r) => r.id)).size).toBe(72);
    } finally {
      await c.query('rollback');
    }
  });

  it('one user’s page: identity, plan, the ledger with who and why, invitations, messages, payments', async () => {
    await c.query('begin');
    try {
      await c.query(`select public.admin_user_credits($1, $2, 10, 'late invitation')`, [FINANCE, DANA]);
      const u = (await c.query(`select public.admin_user($1, $2) as r`, [SUPPORT, DANA])).rows[0].r;
      expect(u).toMatchObject({
        id: DANA,
        name: 'Dana Cohen',
        email: 'dana.cohen@gmail.example.com',
        source: 'google',
        providers: ['google'],
        suspended: false,
        staff: null,
        plan: { plan: 'pro', status: 'active', effective: 'pro', price: null, gift: false, running: true },
        credits: { balance: 50 },
        messages: {
          invitation: { queued: 0, sending: 0, sent: 2, delivered: 1, read: 1, failed: 1 },
          table: { sent: 0, delivered: 0 },
          gallery: { read: 0 },
        },
        // support may not see money, nor the record of actions
        audit: null,
      });
      expect(u.credits.ledger[0]).toMatchObject({
        delta: 10,
        reason: 'support',
        by: { name: null, email: 'finance@example.com', reason: 'late invitation' },
      });
      expect(
        u.credits.ledger.find((l: { reason: string }) => l.reason === 'whatsapp_send').invitationId,
      ).toBe(INV_A);
      expect(u.invitations.map((i: { id: string }) => i.id)).toEqual([INV_B, INV_A]);
      expect(u.invitations[1]).toMatchObject({
        title: 'דנה & עומר',
        guests: 3,
        rsvps: { yes: 2, no: 1, people: 5 },
        messages: 4,
      });
      // the payer, as the owner: money, the provider's name (never its ids), the record of actions
      const payer = (await c.query(`select public.admin_user($1, $2) as r`, [OWNER, PAYER])).rows[0].r;
      expect(payer.plan).toMatchObject({
        provider: 'payplus',
        price: 149,
        hasSubscription: true,
        running: true,
      });
      expect(JSON.stringify(payer)).not.toContain('sub-123');
      expect(
        payer.payments.checkouts.map((k: { amount: number; status: string }) => [k.amount, k.status]),
      ).toEqual([
        [16, 'failed'],
        [149, 'paid'],
      ]);
      expect(payer.payments.renewals).toEqual([
        expect.objectContaining({ product: 'business', amount: 149, status: 'paid' }),
      ]);
      expect(payer.audit).toEqual([]);
      // Noa: no account row yet
      expect((await c.query(`select public.admin_user($1, $2) as r`, [VIEWER, NOA])).rows[0].r).toMatchObject(
        {
          email: 'n***@example.com',
          plan: { plan: 'free', effective: 'free' },
          credits: { balance: 0, ledger: [] },
        },
      );
      expect((await c.query(`select public.admin_user($1, $2) as r`, [OWNER, DEMO])).rows[0].r).toBeNull();
    } finally {
      await c.query('rollback');
    }
  });
});

describe('credits', () => {
  it('adds and removes within the role’s cap, never below zero, with a reason — ledger and record', async () => {
    expect(await reason(call('admin_user_credits', [SUPPORT, DANA, 101, 'too many']))).toBe('over_cap');
    expect(await reason(call('admin_user_credits', [SUPPORT, DANA, -101, 'too many']))).toBe('over_cap');
    expect(await reason(call('admin_user_credits', [FINANCE, DANA, 1001, 'too many']))).toBe('over_cap');
    expect(await reason(call('admin_user_credits', [FINANCE, DANA, 1000, 'a big one']))).toBe('ok');
    expect(await reason(call('admin_user_credits', [ADMIN, DANA, 100000, 'the most']))).toBe('ok');
    expect(await reason(call('admin_user_credits', [ADMIN, DANA, 100001, 'too many']))).toBe('over_cap');
    expect(await reason(call('admin_user_credits', [OWNER, DANA, 0, 'nothing']))).toBe('invalid_delta');
    expect(await reason(call('admin_user_credits', [OWNER, DANA, 5, 'no']))).toBe('invalid_reason');
    expect(await reason(call('admin_user_credits', [OWNER, DANA, 5, 'x'.repeat(201)]))).toBe(
      'invalid_reason',
    );
    expect(await reason(call('admin_user_credits', [OWNER, DANA, -41, 'below zero']))).toBe('below_zero');
    expect(await reason(call('admin_user_credits', [OWNER, DEMO, 5, 'the samples']))).toBe('not_found');
    await c.query('begin');
    try {
      const r = (
        await c.query(`select public.admin_user_credits($1, $2, -40, '  a mistake  ') as r`, [SUPPORT, DANA])
      ).rows[0].r;
      expect(r.balance).toBe(0);
      const ledger = await one<{ delta: number; reason: string; ref: string }>(
        `select delta, reason, ref from public.credit_ledger where user_id = $1 order by id desc limit 1`,
        [DANA],
      );
      expect(ledger).toEqual({ delta: -40, reason: 'support', ref: `admin:${r.auditId}` });
      const audit = await one(
        `select actor_email, action, target_type, target_id, details from public.admin_audit where id = $1`,
        [r.auditId],
      );
      expect(audit).toEqual({
        actor_email: 'support@example.com',
        action: 'users.credits',
        target_type: 'user',
        target_id: DANA,
        details: { delta: -40, before: 40, after: 0, reason: 'a mistake' },
      });
      // Noa's first credits make her account
      expect(
        (await c.query(`select public.admin_user_credits($1, $2, 20, 'welcome gift') as r`, [SUPPORT, NOA]))
          .rows[0].r.balance,
      ).toBe(20);
    } finally {
      await c.query('rollback');
    }
  });
});

describe('a plan as a gift', () => {
  it('gives pro or business until a day (a year at most); it ends by itself; not over a paid plan', async () => {
    const today = (
      await one<{ d: string }>(
        `select to_char((now() at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD') as d`,
      )
    ).d;
    const inDays = async (n: number) =>
      (await one<{ d: string }>(`select to_char($1::date + $2::int, 'YYYY-MM-DD') as d`, [today, n])).d;
    expect(await reason(call('admin_user_gift', [ADMIN, PAYER, 'pro', await inDays(30), 'a gift']))).toBe(
      'has_subscription',
    );
    expect(
      await reason(call('admin_user_gift', [ADMIN, NOA, 'enterprise', await inDays(30), 'a gift'])),
    ).toBe('invalid_plan');
    expect(await reason(call('admin_user_gift', [ADMIN, NOA, 'pro', await inDays(-1), 'a gift']))).toBe(
      'invalid_until',
    );
    expect(await reason(call('admin_user_gift', [ADMIN, NOA, 'pro', await inDays(367), 'a gift']))).toBe(
      'invalid_until',
    );
    expect(await reason(call('admin_user_gift', [ADMIN, NOA, null, null, 'take it back']))).toBe('not_gift');
    await c.query('begin');
    try {
      const last = await inDays(30);
      const g = (
        await c.query(
          `select public.admin_user_gift($1, $2, 'business', $3, 'hosting a charity event') as r`,
          [ADMIN, NOA, last],
        )
      ).rows[0].r;
      expect(g).toMatchObject({ plan: 'business', planStatus: 'canceled', billingProvider: 'gift' });
      // it ends at the end of that day in Israel
      const end = await one<{ ok: boolean }>(
        `select $1::timestamptz = (($2::date + 1)::timestamp at time zone 'Asia/Jerusalem') as ok`,
        [g.planRenewsAt, last],
      );
      expect(end.ok).toBe(true);
      const u = (await c.query(`select public.admin_user($1, $2) as r`, [VIEWER, NOA])).rows[0].r;
      expect(u.plan).toMatchObject({ plan: 'business', effective: 'business', gift: true, running: false });
      // the account itself (as the app reads it) is canceled at that date: effectivePlan gives business, then free
      const account = (await c.query(`select public.account_get($1) as r`, [NOA])).rows[0].r;
      expect(effectivePlan(account, Date.now())).toBe('business');
      expect(effectivePlan(account, Date.parse(g.planRenewsAt) + 1000)).toBe('free');
      // the renewals' check never hears of it
      expect(
        (await c.query(`select public.billing_overdue(0) as r`)).rows[0].r.map(
          (x: { userId: string }) => x.userId,
        ),
      ).not.toContain(NOA);
      // a gift can replace a gift; it's taken back
      expect(
        (
          await c.query(`select public.admin_user_gift($1, $2, 'pro', $3, 'changed my mind') as r`, [
            OWNER,
            NOA,
            last,
          ])
        ).rows[0].r.plan,
      ).toBe('pro');
      const back = (
        await c.query(`select public.admin_user_gift($1, $2, null, null, 'taken back') as r`, [OWNER, NOA])
      ).rows[0].r;
      expect(back).toEqual({ plan: 'free', planStatus: 'active', planRenewsAt: null, billingProvider: null });
      const actions = await c.query(
        `select action, details ->> 'plan' as plan from public.admin_audit where target_id = $1 order by id`,
        [NOA],
      );
      expect(actions.rows).toEqual([
        { action: 'users.plan_gift', plan: 'business' },
        { action: 'users.plan_gift', plan: 'pro' },
        { action: 'users.plan_gift', plan: null },
      ]);
      // a paid plan that was canceled (still in its period) may be replaced by a gift
      await c.query(`update public.accounts set plan_status = 'canceled' where user_id = $1`, [PAYER]);
      expect(
        (
          await c.query(`select public.admin_user_gift($1, $2, 'business', $3, 'loyal customer') as r`, [
            OWNER,
            PAYER,
            last,
          ])
        ).rows[0].r.billingProvider,
      ).toBe('gift');
    } finally {
      await c.query('rollback');
    }
  });

  it('the plan in force is the same in the database and in the app', async () => {
    const DAY = 86_400_000;
    const cases: (AccountPlanState & { billingProvider: string | null; owner: boolean })[] = [];
    for (const plan of ['free', 'pro', 'business'] as PlanId[])
      for (const planStatus of ['active', 'trialing', 'past_due', 'canceled'] as const)
        for (const renews of [null, 20, 2, -3, -20])
          for (const billingProvider of [null, 'payplus', 'gift'])
            cases.push({
              plan,
              planStatus,
              planRenewsAt: renews === null ? null : new Date(Date.now() + renews * DAY).toISOString(),
              billingProvider,
              owner: false,
            });
    cases.push({
      plan: 'free',
      planStatus: 'active',
      planRenewsAt: null,
      billingProvider: null,
      owner: true,
    });
    // (the helper is internal: run as the functions' owner, the test's own connection)
    for (const k of cases) {
      const { rows } = await c.query(`select public.admin_effective_plan($1, $2, $3, $4, $5) as r`, [
        k.plan,
        k.planStatus,
        k.planRenewsAt,
        k.billingProvider,
        k.owner,
      ]);
      expect(rows[0].r, JSON.stringify(k)).toBe(effectivePlan(k, Date.now(), k.owner));
    }
  });
});

describe('a discount from the team', () => {
  it('sets a percent until a day with a note, replacing any other; removes it', async () => {
    expect(await reason(call('admin_user_discount', [ADMIN, DANA, 91, null, null, 'too much']))).toBe(
      'invalid_percent',
    );
    expect(await reason(call('admin_user_discount', [ADMIN, DANA, 0, null, null, 'too little']))).toBe(
      'invalid_percent',
    );
    expect(
      await reason(call('admin_user_discount', [ADMIN, DANA, null, null, null, 'nothing to remove'])),
    ).toBe('no_discount');
    expect(
      await reason(call('admin_user_discount', [ADMIN, DANA, 20, '2020-01-01', null, 'in the past'])),
    ).toBe('invalid_until');
    await c.query('begin');
    try {
      // a partner's discount first: the team's replaces it
      await c.query(
        `update public.accounts set discount_percent = 15, discount_source = 'partner:badook-events' where user_id = $1`,
        [EYAL],
      );
      const d = (
        await c.query(
          `select public.admin_user_discount($1, $2, 25, '2030-12-31', ' spring promo ', 'marketing campaign') as r`,
          [ADMIN, EYAL],
        )
      ).rows[0].r;
      expect(d).toMatchObject({ percent: 25, note: 'spring promo', source: 'admin' });
      expect((await c.query(`select public.account_get($1) as r`, [EYAL])).rows[0].r.discount).toMatchObject({
        percent: 25,
        source: 'admin',
      });
      const list = (await c.query(`select public.admin_users($1, '{"discount": true}') as r`, [VIEWER]))
        .rows[0].r;
      expect(list.rows.map((r: { id: string }) => r.id)).toEqual([EYAL]);
      const audit = await one(`select action, details from public.admin_audit order by id desc limit 1`);
      expect(audit).toEqual({
        action: 'users.discount',
        details: {
          percent: 25,
          lastDay: '2030-12-31',
          note: 'spring promo',
          reason: 'marketing campaign',
          before: { percent: 15, until: null, source: 'partner:badook-events' },
        },
      });
      expect(
        (
          await c.query(`select public.admin_user_discount($1, $2, null, null, null, 'campaign over') as r`, [
            OWNER,
            EYAL,
          ])
        ).rows[0].r,
      ).toBeNull();
    } finally {
      await c.query('rollback');
    }
  });
});

describe('suspending sign-in', () => {
  it('never oneself, never a staff member of one’s rank or above', async () => {
    expect(await reason(call('admin_user_suspend_check', [ADMIN, ADMIN, true, 'myself']))).toBe('self');
    expect(await reason(call('admin_user_suspend_check', [ADMIN, ADMIN2, true, 'an equal']))).toBe(
      'staff_rank',
    );
    expect(await reason(call('admin_user_suspend_check', [ADMIN, OWNER, true, 'above']))).toBe('staff_rank');
    expect(await reason(call('admin_user_suspend_check', [OWNER, OWNER2, true, 'an equal']))).toBe(
      'staff_rank',
    );
    expect(await reason(call('admin_user_suspend_check', [ADMIN, EYAL, true, 'no']))).toBe('invalid_reason');
    expect(await reason(call('admin_user_suspend_check', [ADMIN, EYAL, false, 'not suspended']))).toBe(
      'not_suspended',
    );
    expect(await call('admin_user_suspend_check', [ADMIN, SUPPORT, true, 'left the company'])).toEqual({
      email: 'support@example.com',
      suspended: false,
    });
    expect(await call('admin_user_suspend_check', [OWNER, ADMIN, true, 'left the company'])).toMatchObject({
      suspended: false,
    });
    await c.query('begin');
    try {
      await c.query(`update auth.users set banned_until = now() + interval '100 years' where id = $1`, [
        EYAL,
      ]);
      await c.query('savepoint again');
      expect(
        await reason(c.query(`select public.admin_user_suspend_check($1, $2, true, 'again')`, [ADMIN, EYAL])),
      ).toBe('already_suspended');
      await c.query('rollback to savepoint again');
      expect(
        (
          await c.query(`select public.admin_user_suspend_check($1, $2, false, 'appealed') as r`, [
            ADMIN,
            EYAL,
          ])
        ).rows[0].r,
      ).toEqual({ email: 'eyal@example.com', suspended: true });
      const list = (await c.query(`select public.admin_users($1, '{"suspended": true}') as r`, [VIEWER]))
        .rows[0].r;
      expect(list.rows.map((r: { id: string; suspended: boolean }) => [r.id, r.suspended])).toEqual([
        [EYAL, true],
      ]);
    } finally {
      await c.query('rollback');
    }
  });
});

describe('invitations', () => {
  type Row = {
    id: string;
    title: string;
    status: string;
    owner: { id: string; name: string; email: string };
    guests: number;
    rsvps: { yes: number; no: number; people: number };
    messages: number;
    visits: number;
    publishedAt: string | null;
  };
  type List = {
    total: number;
    counts: {
      total: number;
      status: Record<string, number>;
      eventType: Record<string, number>;
      template: Record<string, number>;
    };
    rows: Row[];
  };

  it('lists them with counts by status, event and design, and each one’s numbers', async () => {
    const list = await call<List>('admin_invitations', [SUPPORT, {}]);
    expect(list.total).toBe(4);
    expect(list.counts).toEqual({
      total: 4,
      status: { draft: 1, published: 2, archived: 1 },
      eventType: { wedding: 1, engagement: 1, bar_mitzvah: 1, birthday: 1 },
      template: { 'sahar-bordeaux': 2, 'jerusalem-stone': 1, kalanit: 1 },
    });
    expect(list.rows.map((r) => r.id)).toEqual([INV_B, INV_A, INV_C, INV_D]);
    expect(list.rows[1]).toMatchObject({
      title: 'דנה & עומר',
      owner: { id: DANA, name: 'Dana Cohen', email: 'dana.cohen@gmail.example.com' },
      guests: 3,
      rsvps: { yes: 2, no: 1, people: 5 },
      messages: 4,
      visits: 12,
    });
    expect(list.rows[2]).toMatchObject({ messages: 2, rsvps: { yes: 2, no: 0, people: 7 } });
    // the first publish is when it went live
    const first = await one<{ at: Date }>(
      `select created_at as at from public.invitation_versions where invitation_id = $1 and version = 1`,
      [INV_A],
    );
    expect(Date.parse(list.rows[1]!.publishedAt!)).toBe(first.at.getTime());
    // a viewer: the owner's email masked
    const viewer = await call<List>('admin_invitations', [VIEWER, {}]);
    expect(viewer.rows[1]!.owner.email).toBe('d***@gmail.example.com');
  });

  it('searches the hosts, the address and the owner; filters; sorts', async () => {
    const ids = async (actor: string, query: object) =>
      (await call<List>('admin_invitations', [actor, query])).rows.map((r) => r.id);
    expect(await ids(VIEWER, { q: 'עומר' })).toEqual([INV_A]);
    expect(await ids(VIEWER, { q: 'eyal-bar' })).toEqual([INV_C]);
    expect(await ids(VIEWER, { q: 'Old Timer' })).toEqual([INV_D]);
    expect(await ids(VIEWER, { q: 'old@example' })).toEqual([]);
    expect(await ids(SUPPORT, { q: 'old@example' })).toEqual([INV_D]);
    expect(await ids(VIEWER, { status: 'published' })).toEqual([INV_A, INV_C]);
    expect(await ids(VIEWER, { eventType: 'bar_mitzvah' })).toEqual([INV_C]);
    expect(await ids(VIEWER, { template: 'kalanit' })).toEqual([INV_D]);
    expect(await ids(VIEWER, { lang: 'ru' })).toEqual([INV_C]);
    const d7 = (
      await one<{ d: string }>(
        `select to_char(((now() - interval '7 days') at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD') as d`,
      )
    ).d;
    expect(await ids(VIEWER, { from: d7 })).toEqual([INV_B, INV_A]);
    expect(await ids(VIEWER, { to: d7 })).toEqual([INV_C, INV_D]);
    expect(await ids(VIEWER, { sort: 'oldest' })).toEqual([INV_D, INV_C, INV_A, INV_B]);
    expect(await ids(VIEWER, { sort: 'rsvps' })).toEqual([INV_A, INV_C, INV_D, INV_B]);
    // upcoming first (INV_C in October, then January, March), then past ones (INV_D)
    expect(await ids(VIEWER, { sort: 'event' })).toEqual([INV_C, INV_A, INV_B, INV_D]);
  });

  it('one invitation: its numbers, owner and features; grants audited, the samples out of reach', async () => {
    const inv = await call<{
      title: string;
      firstPublishedAt: string;
      owner: { email: string };
      counts: Record<string, unknown>;
    }>('admin_invitation', [VIEWER, INV_A]);
    expect(inv).toMatchObject({
      title: 'דנה & עומר',
      status: 'published',
      owner: { id: DANA, name: 'Dana Cohen', email: 'd***@gmail.example.com' },
      features: {},
      counts: {
        guests: 3,
        guestsWithPhone: 2,
        rsvps: { yes: 2, no: 1, people: 5 },
        messages: { invitation: { sent: 2, delivered: 1, read: 1, failed: 1, queued: 0, sending: 0 } },
        gallery: { enabled: null, items: 0, published: 0 },
        versions: { publishes: 2, saves: 0 },
        visits: { total: 12, d30: 12 },
      },
    });
    const demoId = (
      await one<{ id: string }>(`select id from public.invitations where owner_id = $1 limit 1`, [DEMO])
    ).id;
    expect(await call('admin_invitation', [OWNER, demoId])).toBeNull();
    expect(await reason(call('admin_invitation_feature', [ADMIN, demoId, 'voice', true, 'a reason']))).toBe(
      'not_found',
    );
    expect(
      await reason(call('admin_invitation_feature', [ADMIN, INV_A, 'Bad Feature', true, 'a reason'])),
    ).toBe('invalid_feature');
    await c.query('begin');
    try {
      const after = (
        await c.query(
          `select public.admin_invitation_feature($1, $2, 'face_albums', true, 'a VIP wedding') as r`,
          [ADMIN, INV_A],
        )
      ).rows[0].r;
      expect(after).toEqual({ grant: ['face_albums'] });
      // the same again changes nothing and isn't recorded twice
      await c.query(`select public.admin_invitation_feature($1, $2, 'face_albums', true, 'again')`, [
        OWNER,
        INV_A,
      ]);
      await c.query(
        `select public.admin_invitation_feature($1, $2, 'face_albums', false, 'the event is over')`,
        [OWNER, INV_A],
      );
      const rows = await c.query(
        `select actor_email, details from public.admin_audit where action = 'invitations.feature' and target_id = $1 order by id`,
        [INV_A],
      );
      expect(rows.rows).toEqual([
        {
          actor_email: 'admin@example.com',
          details: { feature: 'face_albums', grant: true, reason: 'a VIP wedding', owner: DANA },
        },
        {
          actor_email: 'owner@example.com',
          details: { feature: 'face_albums', grant: false, reason: 'the event is over', owner: DANA },
        },
      ]);
      expect(
        (await one<{ f: unknown }>(`select features as f from public.invitations where id = $1`, [INV_A])).f,
      ).toEqual({
        grant: [],
      });
    } finally {
      await c.query('rollback');
    }
  });
});

describe('the record of actions', () => {
  it('in words: who, what, about whom — filtered by who, the area and the target; a page at a time', async () => {
    await c.query('begin');
    try {
      await c.query(`select public.admin_user_credits($1, $2, 50, 'compensation')`, [SUPPORT, DANA]);
      await c.query(`select public.admin_user_credits($1, $2, 5, 'goodwill')`, [OWNER, EYAL]);
      await c.query(`select public.admin_invitation_feature($1, $2, 'voice', true, 'a demo')`, [
        ADMIN,
        INV_C,
      ]);
      const all = (await c.query(`select public.admin_audit_search($1, '{"limit": 2}') as r`, [OWNER]))
        .rows[0].r;
      expect(all.rows.map((r: { action: string }) => r.action)).toEqual([
        'invitations.feature',
        'users.credits',
      ]);
      expect(all.rows[0]).toMatchObject({
        actorName: 'Adi Admin',
        targetName: 'איל',
        targetType: 'invitation',
      });
      expect(all.rows[1]).toMatchObject({
        actorName: 'Avichai',
        actorEmail: 'owner@example.com',
        targetName: 'Eyal Mizrahi',
        details: { delta: 5, reason: 'goodwill' },
      });
      const next = (
        await c.query(`select public.admin_audit_search($1, $2) as r`, [
          OWNER,
          { limit: 2, before: all.next },
        ])
      ).rows[0].r;
      expect(next.rows[0]).toMatchObject({
        actorName: 'Sapir',
        targetName: 'Dana Cohen',
        action: 'users.credits',
      });
      const bySupport = (
        await c.query(`select public.admin_audit_search($1, $2) as r`, [OWNER, { actor: SUPPORT }])
      ).rows[0].r;
      expect(bySupport.rows.map((r: { targetId: string }) => r.targetId)).toEqual([DANA]);
      const users = (
        await c.query(`select public.admin_audit_search($1, '{"action": "users"}') as r`, [ADMIN])
      ).rows[0].r;
      expect(users.rows.every((r: { action: string }) => r.action.startsWith('users.'))).toBe(true);
      expect(users.rows).toHaveLength(2);
      const aboutDana = (
        await c.query(`select public.admin_audit_search($1, $2) as r`, [
          ADMIN,
          { targetType: 'user', targetId: DANA },
        ])
      ).rows[0].r;
      expect(aboutDana.rows).toHaveLength(1);
      expect(all.actions).toEqual(
        expect.arrayContaining(['users.credits', 'invitations.feature', 'staff.set']),
      );
      expect(all.actors.map((a: { email: string }) => a.email)).toEqual(
        expect.arrayContaining(['owner@example.com', 'support@example.com']),
      );
      // a user's page shows the record about them (to roles with audit.view)
      const page = (await c.query(`select public.admin_user($1, $2) as r`, [OWNER, DANA])).rows[0].r;
      expect(page.audit.map((a: { action: string }) => a.action)).toEqual(['users.credits']);
    } finally {
      await c.query('rollback');
    }
  });
});

describe('the staff, with a reason', () => {
  it('adds, changes and removes through the foundation’s rules, the reason in the same record', async () => {
    expect(
      await reason(call('admin_staff_change', [SUPPORT, 'x@example.com', 'viewer', null, 'a reason'])),
    ).toBe('forbidden');
    expect(await reason(call('admin_staff_change', [OWNER, 'x@example.com', 'viewer', null, 'no']))).toBe(
      'invalid_reason',
    );
    expect(await reason(call('admin_staff_change', [ADMIN, 'x@example.com', 'owner', null, 'promote']))).toBe(
      'forbidden',
    );
    expect(
      await reason(call('admin_staff_change', [ADMIN, 'admin@example.com', 'viewer', null, 'myself'])),
    ).toBe('self');
    await c.query('begin');
    try {
      const m = (
        await c.query(
          `select public.admin_staff_change($1, 'helper@example.com', 'support', 'tickets', 'busy season') as r`,
          [ADMIN],
        )
      ).rows[0].r;
      expect(m).toMatchObject({ email: 'helper@example.com', role: 'support', note: 'tickets' });
      await c.query(
        `select public.admin_staff_change($1, 'helper@example.com', 'finance', null, 'moved to billing')`,
        [OWNER],
      );
      expect(
        (
          await c.query(`select public.admin_staff_drop($1, 'helper@example.com', 'season over') as r`, [
            ADMIN,
          ])
        ).rows[0].r,
      ).toBe(true);
      expect(
        (await c.query(`select public.admin_staff_drop($1, 'nobody@example.com', 'not there') as r`, [ADMIN]))
          .rows[0].r,
      ).toBe(false);
      const rows = await c.query(
        `select actor_email, action, details from public.admin_audit where target_id = 'helper@example.com' order by id`,
      );
      expect(rows.rows).toEqual([
        {
          actor_email: 'admin@example.com',
          action: 'staff.set',
          details: { role: 'support', before: null, note: 'tickets', reason: 'busy season' },
        },
        {
          actor_email: 'owner@example.com',
          action: 'staff.set',
          details: { role: 'finance', before: 'support', note: null, reason: 'moved to billing' },
        },
        {
          actor_email: 'admin@example.com',
          action: 'staff.remove',
          details: { role: 'finance', reason: 'season over' },
        },
      ]);
    } finally {
      await c.query('rollback');
    }
  });
});

describe('the system', () => {
  it('the jobs, the queues, the seed version and the live channel (never its name)', async () => {
    await c.query('begin');
    try {
      await c.query(`select public.app_job_claim('whatsapp', now(), 60)`);
      await c.query(`select public.app_job_done('daily')`);
      await c.query(`select public.admin_channel($1, 'aChannelName_12345')`, [OWNER]);
      const s = (await c.query(`select public.admin_system($1) as r`, [ADMIN])).rows[0].r;
      expect(s.jobs.whatsapp).toMatchObject({ finished: '-infinity' });
      expect(Date.parse(s.jobs.daily.finished)).toBeGreaterThan(Date.now() - 60_000);
      expect(s.queues.invitation).toMatchObject({ queued: 1, sending: 0, failed24h: 1 });
      expect(s.queues.table).toMatchObject({ queued: 0, failed24h: 0 });
      expect(s.seedVersion.value).toMatch(/^[0-9a-f]+$/);
      expect(s.channel.namedAt).toBeTruthy();
      expect(JSON.stringify(s)).not.toContain('aChannelName_12345');
    } finally {
      await c.query('rollback');
    }
  });
});

describe('the credit ledger', () => {
  it('takes the team’s reason, and still refuses unknown ones', async () => {
    await c.query('begin');
    try {
      await c.query(`insert into public.credit_ledger (user_id, delta, reason) values ($1, 1, 'support')`, [
        DANA,
      ]);
      expect(
        await reason(
          c.query(`insert into public.credit_ledger (user_id, delta, reason) values ($1, 1, 'gift')`, [DANA]),
        ),
      ).toContain('credit_ledger_reason_check');
    } finally {
      await c.query('rollback');
    }
  });
});

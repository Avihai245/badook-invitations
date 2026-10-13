import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAN_LIMITS, effectivePlan } from '@/features/billing/plans';
import type { DueRenewal } from '@/features/billing/server/billing';

// Does cancelling really stop the billing? What cancelPlan does for an account billed through Tranzila
// (we charge its stored token ourselves) and through PayPlus (its own monthly charge, stopped at PayPlus),
// what happens when PayPlus will not stop it, a second cancel, and — pinned as they are today, not as
// they should be — the two places where a cancel is not the end of it (see the DEFECT / DECISION tests).
// The Tranzila side of "a canceled plan is never charged" is the database's rule: tests/db/billing-cancel.test.ts.

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/request-url', () => ({ requestBaseUrl: async () => 'https://invitations.example.com' }));
const sendEmail = vi.fn(async (_email: { subject: string; text: string }) => true);
vi.mock('@/features/invitations/server/email', () => ({
  sendEmail: (email: { subject: string; text: string }) => sendEmail(email),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const SECRET = 'pp-secret-key';
const NOW = Date.parse('2026-10-20T09:00:00Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

// ─── an in-memory database behind serviceDb().rpc — billing_apply really applies its patch ───────

type Account = {
  userId: string;
  plan: 'free' | 'pro' | 'business';
  planStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  planRenewsAt: string | null;
  billingProvider: string | null;
  billingSubscriptionId: string | null;
  credits: number;
  [k: string]: unknown;
};
const state = {
  account: null as Account | null,
  events: new Map<string, Record<string, unknown>>(),
  claims: new Set<string>(),
  due: [] as DueRenewal[],
  calls: [] as [string, Record<string, unknown>][],
};
const calls = (fn: string) => state.calls.filter(([name]) => name === fn).map(([, args]) => args);

const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  state.calls.push([fn, args]);
  const data = ((): unknown => {
    switch (fn) {
      case 'account_get':
        return state.account && { ...state.account };
      case 'account_by_billing':
        return state.account?.billingProvider === args.p_provider &&
          state.account?.billingSubscriptionId === args.p_subscription_id
          ? USER
          : null;
      case 'account_note_limit':
        return null;
      case 'billing_claim': {
        const fresh = !state.claims.has(String(args.p_id));
        state.claims.add(String(args.p_id));
        return fresh;
      }
      case 'billing_renewals_due':
        return state.due;
      case 'billing_apply': {
        const id = String(args.p_event_id);
        if (state.events.has(id)) return false;
        state.events.set(id, args);
        const a = state.account!;
        const patch = args.p_patch as Record<string, unknown>;
        if (patch.plan) a.plan = patch.plan as Account['plan'];
        if (patch.planStatus) a.planStatus = patch.planStatus as Account['planStatus'];
        if ('planRenewsAt' in patch) a.planRenewsAt = patch.planRenewsAt as string | null;
        if ('billingSubscriptionId' in patch)
          a.billingSubscriptionId = patch.billingSubscriptionId as string | null;
        a.credits += Math.max(Number(args.p_credits ?? 0), 0);
        return true;
      }
    }
    throw new Error(`unexpected rpc ${fn}`);
  })();
  return { data, error: null };
});
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));

// ─── the providers' APIs ─────────────────────────────────────────────────────────────────────────

const payplus = { cancel: 'success' as 'success' | 'error' | 'down' };
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url.includes('payplus.test') && /\/RecurringPayments\/[^/]+\/Valid$/.test(new URL(url).pathname)) {
    if (payplus.cancel === 'down') throw new Error('network down');
    return answer({ results: { status: payplus.cancel } });
  }
  if (url.endsWith('/v1/transaction/credit_card/create'))
    return answer({
      error_code: 0,
      message: 'Success',
      transaction_result: { processor_response_code: '000', transaction_id: 9001, auth_number: '0123456' },
    });
  return answer({ error_code: 404 }, 404);
});
const providerCalls = () => fetchMock.mock.calls.map(([url]) => String(url));

function account(over: Partial<Account> = {}): Account {
  return {
    userId: USER,
    fullName: 'Dana',
    avatarUrl: null,
    phone: null,
    plan: 'pro',
    planStatus: 'active',
    planRenewsAt: at(10),
    billingProvider: 'tranzila',
    billingSubscriptionId: 'tranzila:22222222-2222-4222-8222-222222222222',
    hasSubscription: true,
    credits: 0,
    source: 'signup',
    createdAt: '2026-09-01T00:00:00Z',
    activeInvitations: 0,
    discount: null,
    planPrice: null,
    ...over,
  };
}
const user = { id: USER, email: 'dana@example.com' };

beforeAll(() => {
  vi.stubEnv('INVITES_PAYPLUS_API_KEY', 'pp-api-key');
  vi.stubEnv('INVITES_PAYPLUS_SECRET_KEY', SECRET);
  vi.stubEnv('INVITES_PAYPLUS_PAGE_UID', 'pp-page');
  vi.stubEnv('INVITES_PAYPLUS_API_BASE', 'https://payplus.test/api/v1.0/');
  vi.stubEnv('INVITES_TRANZILA_APP_KEY', 'tz-app-key');
  vi.stubEnv('INVITES_TRANZILA_SECRET', 'tz-secret');
  vi.stubEnv('INVITES_TRANZILA_API_BASE', 'https://tranzila.test/');
  vi.stubEnv('INVITES_PUBLIC_BASE_URL', 'https://invitations.example.com');
  vi.stubEnv('INVITES_SUPPORT_EMAIL', 'support@example.com');
  vi.stubEnv('INVITES_PRICE_PRO', '49');
  vi.stubEnv('INVITES_PRICE_BUSINESS', '149');
  vi.stubGlobal('fetch', fetchMock);
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  state.account = account();
  state.events = new Map();
  state.claims = new Set();
  state.due = [];
  state.calls = [];
  payplus.cancel = 'success';
  fetchMock.mockClear();
  sendEmail.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

const billing = () => import('@/features/billing/server/billing');
const accountApi = () => import('@/features/billing/server/account');
const alerts = () => sendEmail.mock.calls.map(([email]) => email.subject);

describe('cancelling a plan billed through Tranzila', () => {
  it('the plan is canceled at once; the renewal date is not touched; no provider is called', async () => {
    const renews = state.account!.planRenewsAt;
    const { cancelPlan } = await billing();
    expect(await cancelPlan(user)).toEqual({ status: 200, body: { ok: true } });
    expect(state.account).toMatchObject({ plan: 'pro', planStatus: 'canceled', planRenewsAt: renews });
    // the one write: a plan.canceled event whose patch is the status and nothing else (no date, no credits)
    const [apply, ...rest] = calls('billing_apply');
    expect(rest).toEqual([]);
    expect(apply).toMatchObject({
      p_type: 'plan.canceled',
      p_provider: 'tranzila',
      p_user_id: USER,
      p_patch: { planStatus: 'canceled' },
      p_credits: 0,
    });
    // Tranzila has no subscription to stop (we hold the token and charge it ourselves): nothing is sent
    expect(providerCalls()).toEqual([]);
    expect(alerts()).toEqual([]);
  });

  it('the paid plan stays until the paid period ends, then the account is free', async () => {
    const { cancelPlan } = await billing();
    const { loadAccount } = await accountApi();
    await cancelPlan(user);
    expect((await loadAccount(user)).effective).toBe('pro');
    // the day after the period it paid for
    vi.setSystemTime(NOW + 11 * DAY);
    const after = await loadAccount(user);
    expect(after.effective).toBe('free');
    expect(after.plan).toBe('pro');
    // and with no grace days (those are for a charge that failed, not for a cancel)
    const record = state.account!;
    expect(effectivePlan(record, Date.parse(record.planRenewsAt!) - 1)).toBe('pro');
    expect(effectivePlan(record, Date.parse(record.planRenewsAt!) + 1)).toBe('free');
  });

  it('a plan whose charge failed (past due) can be canceled too', async () => {
    state.account = account({ planStatus: 'past_due', planRenewsAt: at(-3) });
    const { cancelPlan } = await billing();
    expect((await cancelPlan(user)).status).toBe(200);
    expect(state.account.planStatus).toBe('canceled');
  });

  it('a second cancel is refused: 409 nothing_to_cancel, and nothing is written', async () => {
    const { cancelPlan } = await billing();
    await cancelPlan(user);
    state.calls = [];
    expect(await cancelPlan(user)).toEqual({ status: 409, body: { ok: false, code: 'nothing_to_cancel' } });
    expect(calls('billing_apply')).toEqual([]);
    expect(providerCalls()).toEqual([]);
  });

  it('a free account has nothing to cancel (409), and so has one whose plan is already canceled', async () => {
    const { cancelPlan } = await billing();
    state.account = account({
      plan: 'free',
      planRenewsAt: null,
      billingProvider: null,
      billingSubscriptionId: null,
    });
    expect(await cancelPlan(user)).toEqual({ status: 409, body: { ok: false, code: 'nothing_to_cancel' } });
    state.account = account({ planStatus: 'canceled' });
    expect((await cancelPlan(user)).status).toBe(409);
    expect(calls('billing_apply')).toEqual([]);
  });

  it('the cancel event id is its own: a repeated cancel never collides with the first', async () => {
    const { cancelPlan } = await billing();
    await cancelPlan(user);
    state.account!.planStatus = 'active';
    vi.setSystemTime(NOW + 1000);
    await cancelPlan(user);
    expect([...state.events.keys()]).toEqual([`cancel:${USER}:${NOW}`, `cancel:${USER}:${NOW + 1000}`]);
  });
});

describe('cancelling a plan billed through PayPlus', () => {
  const payplusAccount = () =>
    account({ billingProvider: 'payplus', billingSubscriptionId: 'rec-77', planRenewsAt: at(12) });

  it('PayPlus is told to stop that subscription, and the plan is canceled', async () => {
    state.account = payplusAccount();
    const { cancelPlan } = await billing();
    expect(await cancelPlan(user)).toEqual({ status: 200, body: { ok: true } });
    expect(providerCalls()).toEqual(['https://payplus.test/api/v1.0/RecurringPayments/rec-77/Valid']);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ valid: false });
    expect(state.account).toMatchObject({ planStatus: 'canceled', billingSubscriptionId: 'rec-77' });
    expect(alerts()).toEqual([]);
  });

  it('PayPlus refuses: support is told which subscription to stop by hand, and the host still sees canceled', async () => {
    state.account = payplusAccount();
    payplus.cancel = 'error';
    const { cancelPlan } = await billing();
    // documented current behaviour: the host is told it worked
    expect(await cancelPlan(user)).toEqual({ status: 200, body: { ok: true } });
    expect(state.account.planStatus).toBe('canceled');
    expect(alerts()).toEqual(['[Badook billing] Stop a monthly charge by hand (the host canceled)']);
    expect(sendEmail.mock.calls[0]![0].text).toContain('subscription: rec-77');
    expect(sendEmail.mock.calls[0]![0].text).toContain(`userId: ${USER}`);
  });

  it('PayPlus unreachable: the same', async () => {
    state.account = payplusAccount();
    payplus.cancel = 'down';
    const { cancelPlan } = await billing();
    expect((await cancelPlan(user)).status).toBe(200);
    expect(state.account.planStatus).toBe('canceled');
    expect(alerts()).toEqual(['[Badook billing] Stop a monthly charge by hand (the host canceled)']);
  });

  it('a second cancel does not ask PayPlus again', async () => {
    state.account = payplusAccount();
    const { cancelPlan } = await billing();
    await cancelPlan(user);
    fetchMock.mockClear();
    expect((await cancelPlan(user)).status).toBe(409);
    expect(providerCalls()).toEqual([]);
  });

  it('a PayPlus plan without a subscription id (nothing to stop) is just canceled', async () => {
    state.account = account({ billingProvider: 'payplus', billingSubscriptionId: null });
    const { cancelPlan } = await billing();
    expect((await cancelPlan(user)).status).toBe(200);
    expect(providerCalls()).toEqual([]);
    expect(alerts()).toEqual([]);
  });
});

// ─── where a cancel is not the end of it — pinned as it is today ─────────────────────────────────

const sign = (raw: string) => createHmac('sha256', SECRET).update(raw, 'utf8').digest('base64');
const renewalNotice = (status = '000', uid = 'tx-renew-1') =>
  JSON.stringify({
    transaction_type: 'Charge',
    transaction: {
      uid,
      status_code: status,
      amount: 49,
      recurring_charge_information: { recurring_uid: 'rec-77', charge_number: 2 },
    },
    data: { customer_uid: 'cus-1' },
  });

describe('DEFECT / DECISION (pinned as it is, not as it should be): a PayPlus notice after the cancel', () => {
  // PayPlus failed to stop the subscription (the case above, where support is alerted), so it charges
  // the host again and posts the renewal. applyRenewal (billing.ts) does not look at the cancel.
  beforeEach(() => {
    state.account = account({
      billingProvider: 'payplus',
      billingSubscriptionId: 'rec-77',
      planStatus: 'canceled',
      planRenewsAt: at(-1),
    });
  });

  it('a paid renewal extends planRenewsAt by a month and grants the plan’s monthly credits — the status stays canceled', async () => {
    const { payplusCallback } = await billing();
    const raw = renewalNotice('000');
    expect(await payplusCallback(raw, sign(raw))).toEqual({ status: 200, body: 'ok' });
    const [apply] = calls('billing_apply');
    expect(apply).toMatchObject({ p_type: 'renewal.paid', p_user_id: USER, p_product: 'pro', p_amount: 49 });
    expect(apply!.p_patch).toEqual({ planStatus: 'canceled', planRenewsAt: '2026-11-20T09:00:00.000Z' });
    expect(apply!.p_credits).toBe(PLAN_LIMITS.pro.monthlyCredits);
    expect(state.account).toMatchObject({
      planStatus: 'canceled',
      planRenewsAt: '2026-11-20T09:00:00.000Z',
      credits: PLAN_LIMITS.pro.monthlyCredits,
    });
    // so a plan canceled and already lapsed is in force again for another month
    const { loadAccount } = await accountApi();
    expect((await loadAccount(user)).effective).toBe('pro');
  });

  it('a failed renewal turns the canceled plan into past_due (the screen stops saying canceled)', async () => {
    const { payplusCallback } = await billing();
    const raw = renewalNotice('004', 'tx-renew-2');
    await payplusCallback(raw, sign(raw));
    expect(calls('billing_apply')[0]).toMatchObject({
      p_type: 'renewal.failed',
      p_patch: { planStatus: 'past_due' },
    });
    expect(state.account!.planStatus).toBe('past_due');
  });

  it('the same notice twice is applied once', async () => {
    const { payplusCallback } = await billing();
    const raw = renewalNotice('000');
    await payplusCallback(raw, sign(raw));
    await payplusCallback(raw, sign(raw));
    expect(state.account!.credits).toBe(PLAN_LIMITS.pro.monthlyCredits);
  });
});

describe('DECISION (pinned): the stored Tranzila token', () => {
  it('cancelling keeps the card’s token (billing_cards): no call removes it', async () => {
    const { cancelPlan } = await billing();
    await cancelPlan(user);
    // the only calls cancelPlan makes: read the account, apply the cancel event
    expect([...new Set(state.calls.map(([fn]) => fn))].sort()).toEqual(['account_get', 'billing_apply']);
    expect(state.calls.some(([fn]) => /card/.test(fn))).toBe(false);
  });
});

describe('DEFECT (low): the daily run trusts the list it read', () => {
  it('a plan canceled after the due list was read is still charged in that run', async () => {
    // billing_renewals_due is the guard (a canceled plan is not in it: tests/db/billing-cancel.test.ts);
    // chargeRenewals does not look at the account again before it charges the token
    state.account = account({ planStatus: 'canceled', planRenewsAt: at(-1) });
    state.due = [
      {
        userId: USER,
        email: 'dana@example.com',
        fullName: 'Dana',
        plan: 'pro',
        planStatus: 'active',
        planRenewsAt: at(-1),
        planPrice: null,
        token: 'Z5f3c1a2b3c4d5e6f71234',
        expireMonth: 8,
        expireYear: 2029,
      },
    ];
    const { chargeRenewals } = await billing();
    expect(await chargeRenewals(NOW)).toEqual({ paid: 1, failed: 0 });
    expect(providerCalls().filter((u) => u.endsWith('/v1/transaction/credit_card/create'))).toHaveLength(1);
    expect(calls('account_get')).toEqual([]);
  });
});

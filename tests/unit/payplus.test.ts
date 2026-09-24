import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Checkout } from '@/features/billing/server/billing';
import type { PayplusTransaction } from '@/features/billing/server/payplus';

// PayPlus: the callback's signature, reading its payloads (callback and IPN shapes), the API calls,
// and what the callback handler decides — a first payment settled only when PayPlus confirms it (or
// a signed notice vouches for it), kept pending (and support told) when a notice says paid but
// PayPlus doesn't confirm, a failed purchase that turns out paid, renewals, and the rest of billing
// that talks to PayPlus: buying a lapsed plan again, the daily check, deleting an account.

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/request-url', () => ({ requestBaseUrl: async () => 'https://invitations.example.com' }));
const sendEmail = vi.fn(async (_email: { subject: string; text: string }) => true);
vi.mock('@/features/invitations/server/email', () => ({
  sendEmail: (email: { subject: string; text: string }) => sendEmail(email),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const CHECKOUT = '22222222-2222-4222-8222-222222222222';
const SECRET = 'pp-secret-key';

// ─── an in-memory database behind serviceDb().rpc ────────────────────────────────────────────────

type Account = Record<string, unknown> & { plan: string; planStatus: string; planRenewsAt: string | null };
const state = {
  checkouts: new Map<string, Checkout>(),
  account: null as Account | null,
  calls: [] as [string, Record<string, unknown>][],
};
const calls = (fn: string) => state.calls.filter(([name]) => name === fn).map(([, args]) => args);

const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  state.calls.push([fn, args]);
  const data = ((): unknown => {
    switch (fn) {
      case 'account_get':
        return state.account;
      case 'account_by_billing':
        return state.account?.billingSubscriptionId === args.p_subscription_id ? USER : null;
      case 'account_note_limit':
      case 'checkout_attach':
        return null;
      case 'billing_apply':
        return true;
      case 'checkout_create': {
        const id = `33333333-3333-4333-8333-${String(state.checkouts.size).padStart(12, '0')}`;
        state.checkouts.set(id, checkout({ id, product: args.p_product as Checkout['product'] }));
        return id;
      }
      case 'checkout_get':
        return state.checkouts.get(String(args.p_id)) ?? null;
      case 'checkout_complete': {
        const k = state.checkouts.get(String(args.p_id));
        if (!k || !(k.status === 'pending' || (k.status === 'failed' && args.p_status === 'paid')))
          return { settled: false };
        k.status = args.p_status as Checkout['status'];
        return { settled: true, userId: k.userId, product: k.product };
      }
      case 'billing_pending_checkouts':
        return [...state.checkouts.values()].filter((k) => k.status === 'pending');
      case 'billing_overdue':
        return [];
      case 'billing_history':
        return { checkouts: [], renewals: [], credits: [] };
      case 'owner_invitations':
        return [];
    }
    throw new Error(`unexpected rpc ${fn}`);
  })();
  return { data, error: null };
});
const deleteUser = vi.fn(async (_id: string) => ({ error: null }));
vi.mock('@/lib/supabase/server', () => ({
  serviceDb: () => ({
    rpc,
    storage: { from: () => ({ list: async () => ({ data: [], error: null }), remove: vi.fn() }) },
    auth: { admin: { deleteUser: (id: string) => deleteUser(id) } },
  }),
}));

// ─── PayPlus's API ───────────────────────────────────────────────────────────────────────────────

const payplus = {
  /** what PaymentPages/ipn answers for our page request */
  ipn: {} as Record<string, unknown>,
  cancel: 'success',
};
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  const path = new URL(url).pathname;
  if (path.endsWith('/PaymentPages/ipn'))
    return answer({ results: { status: 'success' }, data: payplus.ipn });
  if (path.endsWith('/PaymentPages/generateLink'))
    return answer({
      results: { status: 'success' },
      data: { payment_page_link: 'https://pay.test/page', page_request_uid: 'page-new' },
    });
  if (/\/RecurringPayments\/[^/]+\/Valid$/.test(path)) return answer({ results: { status: payplus.cancel } });
  return answer({ results: { status: 'error' } }, 404);
});

function checkout(over: Partial<Checkout> = {}): Checkout {
  return {
    id: CHECKOUT,
    userId: USER,
    product: 'pro',
    amount: 49,
    provider: 'payplus',
    providerRef: 'page-1',
    status: 'pending',
    createdAt: '2026-09-24T10:00:00Z',
    completedAt: null,
    ...over,
  };
}

function account(over: Partial<Account> = {}): Account {
  return {
    userId: USER,
    fullName: 'Dana',
    phone: null,
    plan: 'free',
    planStatus: 'active',
    planRenewsAt: null,
    billingProvider: null,
    billingSubscriptionId: null,
    hasSubscription: false,
    credits: 0,
    source: 'signup',
    createdAt: '2026-09-01T00:00:00Z',
    activeInvitations: 0,
    ...over,
  };
}

/** A notice as PayPlus posts it to refURL_callback. */
function notice(over: Record<string, unknown> = {}, charge = 1) {
  return {
    transaction_type: 'Charge',
    transaction: {
      uid: 'tx-1',
      payment_page_request_uid: 'page-1',
      status_code: '000',
      amount: 49,
      more_info: CHECKOUT,
      recurring_charge_information: { recurring_uid: 'rec-1', charge_number: charge },
      ...over,
    },
    data: { customer_uid: 'cus-1' },
  };
}
const sign = (raw: string) => createHmac('sha256', SECRET).update(raw, 'utf8').digest('base64');

beforeAll(() => {
  vi.stubEnv('INVITES_PAYPLUS_API_KEY', 'pp-api-key');
  vi.stubEnv('INVITES_PAYPLUS_SECRET_KEY', SECRET);
  vi.stubEnv('INVITES_PAYPLUS_PAGE_UID', 'pp-page');
  vi.stubEnv('INVITES_PAYPLUS_API_BASE', 'https://payplus.test/api/v1.0/');
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
  state.checkouts = new Map([[CHECKOUT, checkout()]]);
  state.account = account();
  state.calls = [];
  payplus.ipn = { transaction_uid: 'tx-1', page_request_uid: 'page-1', status_code: '000', amount: 49 };
  payplus.cancel = 'success';
  fetchMock.mockClear();
  sendEmail.mockClear();
  deleteUser.mockClear();
});

const billing = () => import('@/features/billing/server/billing');
const client = () => import('@/features/billing/server/payplus');
const alerts = () => sendEmail.mock.calls.map(([email]) => email.subject);

describe('PayPlus: signature and payloads', () => {
  it('the callback’s signature is base64 HMAC-SHA256 of the raw body with the secret key', async () => {
    const { validCallbackHash } = await client();
    const raw = JSON.stringify(notice());
    expect(validCallbackHash(raw, sign(raw))).toBe(true);
    expect(validCallbackHash(raw, ` ${sign(raw)}\n`)).toBe(true);
    expect(validCallbackHash(`${raw} `, sign(raw))).toBe(false);
    expect(validCallbackHash(raw, sign(raw).slice(0, -2))).toBe(false);
    expect(validCallbackHash(raw, createHmac('sha256', 'other').update(raw).digest('base64'))).toBe(false);
    expect(validCallbackHash(raw, null)).toBe(false);
  });

  it('reads a callback, a renewal, the IPN answer, a decline and garbage', async () => {
    const { readTransaction } = await client();
    expect(readTransaction(notice())).toEqual({
      paid: true,
      statusCode: '000',
      transactionUid: 'tx-1',
      pageRequestUid: 'page-1',
      moreInfo: CHECKOUT,
      amount: 49,
      recurringUid: 'rec-1',
      customerUid: 'cus-1',
      renewal: false,
    });
    expect(readTransaction(notice({}, 2))).toMatchObject({ renewal: true, recurringUid: 'rec-1' });
    // the IPN answer is flat, amounts may be strings
    expect(
      readTransaction({
        transaction_uid: 'tx-9',
        page_request_uid: 'page-9',
        status_code: '000',
        amount: '16.00',
        more_info: 'x',
      }),
    ).toMatchObject({
      paid: true,
      transactionUid: 'tx-9',
      pageRequestUid: 'page-9',
      amount: 16,
      renewal: false,
    });
    // nested under data.transaction
    expect(readTransaction({ data: { transaction: { uid: 'tx-5', status_code: '000' } } })).toMatchObject({
      paid: true,
      transactionUid: 'tx-5',
    });
    expect(readTransaction(notice({ status_code: '006' }))).toMatchObject({ paid: false, statusCode: '006' });
    for (const junk of [null, 'x', 42, { transaction: 'x' }])
      expect(readTransaction(junk)).toMatchObject({
        paid: false,
        transactionUid: null,
        amount: null,
        renewal: false,
      });
  });
});

describe('PayPlus: the API calls', () => {
  it('a payment page: monthly for a plan (charge_method 3), once for a pack, with our purchase id', async () => {
    const { generatePaymentLink } = await client();
    const urls = { success: 's', failure: 'f', cancel: 'c', callback: 'cb' };
    const page = await generatePaymentLink({
      ref: CHECKOUT,
      amount: 49,
      itemName: 'Pro',
      customer: { name: 'Dana', email: 'dana@example.com', phone: '+972501234567' },
      recurring: true,
      locale: 'he',
      urls,
    });
    expect(page).toEqual({ url: 'https://pay.test/page', pageRequestUid: 'page-new' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://payplus.test/api/v1.0/PaymentPages/generateLink');
    expect((init!.headers as Record<string, string>)['api-key']).toBe('pp-api-key');
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({
      payment_page_uid: 'pp-page',
      charge_method: 3,
      amount: 49,
      currency_code: 'ILS',
      more_info: CHECKOUT,
      refURL_callback: 'cb',
      customer: { customer_name: 'Dana', email: 'dana@example.com', phone: '+972501234567' },
      recurring_settings: { recurring_type: 2, number_of_charges: 0 },
    });
    await generatePaymentLink({
      ref: CHECKOUT,
      amount: 16,
      itemName: 'x',
      customer: { name: 'D', email: 'd@example.com' },
      recurring: false,
      locale: 'en',
      urls,
    });
    const once = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body));
    expect(once.charge_method).toBe(1);
    expect(once.recurring_settings).toBeUndefined();
    expect(once.customer.phone).toBeUndefined();
  });

  it('a refused page, the IPN question, and stopping a monthly charge', async () => {
    const { cancelRecurring, confirmPayment, generatePaymentLink } = await client();
    const refused = vi.fn(async () => answer({ results: { status: 'error', description: 'bad page' } }));
    await expect(
      generatePaymentLink(
        {
          ref: 'r',
          amount: 1,
          itemName: 'x',
          customer: { name: 'x', email: 'x@example.com' },
          recurring: false,
          locale: 'he',
          urls: { success: '', failure: '', cancel: '', callback: '' },
        },
        refused as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/bad page/);
    payplus.ipn = { transaction_uid: 'tx-7', status_code: '000', amount: 49 };
    expect(await confirmPayment('page-1')).toMatchObject({ paid: true, transactionUid: 'tx-7' });
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)![1]!.body))).toEqual({
      payment_request_uid: 'page-1',
      related_transaction: true,
    });
    expect(await cancelRecurring('rec-1')).toBe(true);
    expect(fetchMock.mock.calls.at(-1)![0]).toBe(
      'https://payplus.test/api/v1.0/RecurringPayments/rec-1/Valid',
    );
    payplus.cancel = 'error';
    expect(await cancelRecurring('rec-1')).toBe(false);
    const down = vi.fn(async () => {
      throw new Error('network');
    });
    expect(await cancelRecurring('rec-1', down as unknown as typeof fetch)).toBe(false);
  });
});

describe('the first payment: what counts as paid', () => {
  const tx = (over: Partial<PayplusTransaction> = {}): PayplusTransaction => ({
    paid: true,
    statusCode: '000',
    transactionUid: 'tx-1',
    pageRequestUid: 'page-1',
    moreInfo: CHECKOUT,
    amount: 49,
    recurringUid: null,
    customerUid: null,
    renewal: false,
    ...over,
  });
  const unpaid = tx({ paid: false, statusCode: null, transactionUid: null, amount: null });
  const k = { amount: 49, providerRef: 'page-1' };

  it('PayPlus’s answer decides; the amount must match', async () => {
    const { decideFirstPayment } = await billing();
    expect(decideFirstPayment(k, tx(), tx(), false)).toMatchObject({ outcome: 'paid' });
    expect(decideFirstPayment(k, tx(), null, false)).toMatchObject({ outcome: 'paid' });
    expect(decideFirstPayment(k, tx({ amount: 1 }), tx(), true)).toEqual({
      outcome: 'amount_mismatch',
      paid: 1,
    });
    // "49.00" and 49 are the same price
    expect(
      decideFirstPayment({ ...k, amount: '49.00' as unknown as number }, tx(), null, false).outcome,
    ).toBe('paid');
  });

  it('a signed notice for that very page request, with the right amount, vouches for it', async () => {
    const { decideFirstPayment } = await billing();
    expect(decideFirstPayment(k, unpaid, tx(), true)).toMatchObject({ outcome: 'paid' });
    expect(decideFirstPayment(k, unpaid, tx({ pageRequestUid: 'page-2' }), true).outcome).toBe('pending');
    expect(decideFirstPayment(k, unpaid, tx({ amount: null }), true).outcome).toBe('pending');
    expect(decideFirstPayment(k, unpaid, tx({ amount: 4.9 }), true).outcome).toBe('amount_mismatch');
  });

  it('never failed while anything says paid; failed only when both say so', async () => {
    const { decideFirstPayment } = await billing();
    expect(decideFirstPayment(k, unpaid, tx(), false).outcome).toBe('pending');
    expect(decideFirstPayment(k, unpaid, null, false).outcome).toBe('pending');
    expect(decideFirstPayment(k, unpaid, tx({ paid: false, statusCode: '006' }), true).outcome).toBe(
      'failed',
    );
  });
});

describe('the callback', () => {
  const post = async (body: unknown, signed = false) => {
    const { payplusCallback } = await billing();
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    return payplusCallback(raw, signed ? sign(raw) : null);
  };

  it('a confirmed first payment gives the plan, its credits and the subscription — once', async () => {
    expect(await post(notice())).toEqual({ status: 200, body: 'paid' });
    const [complete] = calls('checkout_complete');
    expect(complete).toMatchObject({
      p_id: CHECKOUT,
      p_status: 'paid',
      p_event_id: 'payplus:tx-1',
      p_credits: 50,
      p_patch: {
        plan: 'pro',
        planStatus: 'active',
        billingSubscriptionId: 'rec-1',
        billingCustomerId: 'cus-1',
      },
    });
    // the same notice again: already paid — a repeat goes the renewal way, deduplicated by its id
    state.account = account({ plan: 'pro', billingProvider: 'payplus', billingSubscriptionId: 'rec-1' });
    expect(await post(notice(), true)).toEqual({ status: 200, body: 'ok' });
    expect(calls('billing_apply').at(-1)).toMatchObject({ p_event_id: 'payplus:tx-1' });
    expect(calls('checkout_complete')).toHaveLength(1);
  });

  it('a notice that says paid but PayPlus doesn’t confirm: kept pending, support told', async () => {
    payplus.ipn = { page_request_uid: 'page-1', status_code: null };
    expect(await post(notice())).toEqual({ status: 200, body: 'pending' });
    expect(calls('checkout_complete')).toEqual([]);
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('pending');
    expect(alerts()).toEqual(['[Badook billing] A payment PayPlus has not confirmed (kept pending)']);
    // a later notice, once PayPlus confirms it, is taken (not "a renewal of an unknown subscription")
    payplus.ipn = { transaction_uid: 'tx-1', status_code: '000', amount: 49 };
    expect(await post(notice())).toEqual({ status: 200, body: 'paid' });
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('paid');
  });

  it('a signed notice vouches for a payment PayPlus’s answer doesn’t show yet', async () => {
    payplus.ipn = {};
    expect(await post(notice(), true)).toEqual({ status: 200, body: 'paid' });
    expect(calls('checkout_complete')[0]).toMatchObject({ p_status: 'paid', p_event_id: 'payplus:tx-1' });
  });

  it('a decline both sides agree on fails the purchase — and a later payment on the same page still counts', async () => {
    payplus.ipn = { page_request_uid: 'page-1', status_code: '006' };
    expect(await post(notice({ status_code: '006', uid: 'tx-bad' }))).toEqual({
      status: 200,
      body: 'failed',
    });
    expect(calls('checkout_complete')[0]).toMatchObject({
      p_status: 'failed',
      p_event_id: 'payplus:tx-bad',
    });
    // the same failure again settles nothing more (on the renewal way it carries the same event id,
    // which billing_apply takes once)
    state.account = account({ plan: 'pro', billingProvider: 'payplus', billingSubscriptionId: 'rec-1' });
    expect(await post(notice({ status_code: '006', uid: 'tx-bad' }), true)).toMatchObject({ status: 200 });
    expect(calls('checkout_complete')).toHaveLength(1);
    expect(calls('billing_apply').map((a) => a.p_event_id)).toEqual(['payplus:tx-bad']);
    // paid after all (another card, same page)
    payplus.ipn = { transaction_uid: 'tx-2', status_code: '000', amount: 49 };
    expect(await post(notice({ uid: 'tx-2' }))).toEqual({ status: 200, body: 'paid' });
    expect(calls('checkout_complete').at(-1)).toMatchObject({ p_status: 'paid', p_event_id: 'payplus:tx-2' });
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('paid');
  });

  it('the wrong amount is never given; support is told', async () => {
    payplus.ipn = { transaction_uid: 'tx-1', status_code: '000', amount: 4.9 };
    expect(await post(notice())).toEqual({ status: 200, body: 'amount mismatch' });
    expect(calls('checkout_complete')).toEqual([]);
    expect(alerts()).toEqual(['[Badook billing] Paid amount differs from the price']);
  });

  it('a message pack is paid once: its notices never renew anything', async () => {
    state.checkouts.set(CHECKOUT, checkout({ product: 'credits_100', amount: 16, status: 'paid' }));
    expect(await post(notice({ amount: 16, recurring_charge_information: undefined }), true)).toEqual({
      status: 200,
      body: 'ok',
    });
    expect(calls('billing_apply')).toEqual([]);
  });

  it('a monthly renewal: signed, applied with the plan and the amount charged', async () => {
    state.checkouts.get(CHECKOUT)!.status = 'paid';
    state.account = account({
      plan: 'pro',
      billingProvider: 'payplus',
      billingSubscriptionId: 'rec-1',
      planRenewsAt: '2026-10-24T10:00:00Z',
    });
    expect(await post(notice({ uid: 'tx-month-2' }, 2))).toEqual({ status: 401, body: 'bad signature' });
    expect(alerts()).toEqual(['[Badook billing] Unsigned PayPlus callback']);
    expect(await post(notice({ uid: 'tx-month-2' }, 2), true)).toEqual({ status: 200, body: 'ok' });
    expect(calls('billing_apply').at(-1)).toMatchObject({
      p_event_id: 'payplus:tx-month-2',
      p_type: 'renewal.paid',
      p_credits: 50,
      p_product: 'pro',
      p_amount: 49,
    });
    await post(notice({ uid: 'tx-month-3', status_code: '006', amount: 49 }, 3), true);
    expect(calls('billing_apply').at(-1)).toMatchObject({
      p_type: 'renewal.failed',
      p_patch: { planStatus: 'past_due' },
      p_credits: 0,
    });
    expect(await post('not json')).toEqual({ status: 400, body: 'bad json' });
  });
});

describe('the rest of billing that talks to PayPlus', () => {
  it('a plan that lapsed (or whose charge failed) can be bought again; a running one can’t', async () => {
    const { startCheckout } = await billing();
    const user = { id: USER, email: 'dana@example.com', user_metadata: {} };
    const DAY = 86_400_000;
    const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
    state.account = account({ plan: 'pro', planStatus: 'active', planRenewsAt: ago(-20) });
    expect(await startCheckout(user, { product: 'pro' }, 'he')).toEqual({
      status: 409,
      body: { ok: false, code: 'already' },
    });
    // the renewal never came and the grace ended: free in force
    state.account = account({ plan: 'pro', planStatus: 'active', planRenewsAt: ago(20) });
    const res = await startCheckout(user, { product: 'pro' }, 'he');
    expect(res).toEqual({ status: 200, body: { ok: true, url: 'https://pay.test/page' } });
    const body = JSON.parse(String(fetchMock.mock.calls.at(-1)![1]!.body));
    // back to the address the host is on
    expect(body.refURL_success).toMatch(
      /^https:\/\/invitations\.example\.com\/app\/billing\?status=success&checkout=/,
    );
    expect(body.amount).toBe(49);
    state.account = account({ plan: 'pro', planStatus: 'past_due', planRenewsAt: ago(2) });
    expect((await startCheckout(user, { product: 'pro' }, 'he')).status).toBe(200);
    // packs are priced with VAT: 100 × 0.16
    expect(await startCheckout(user, { product: 'credits_100' }, 'he')).toMatchObject({ status: 200 });
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)![1]!.body)).amount).toBe(16);
  });

  it('back from paying while the notice is late: the billing page asks PayPlus itself', async () => {
    const { loadBillingPage } = await billing();
    payplus.ipn = { page_request_uid: 'page-1' };
    let page = await loadBillingPage({ id: USER, email: 'dana@example.com' }, CHECKOUT, 'success');
    expect(page.returned?.status).toBe('pending');
    // never failed from here, even when PayPlus says nothing yet
    expect(calls('checkout_complete')).toEqual([]);
    payplus.ipn = { transaction_uid: 'tx-1', status_code: '000', amount: 49 };
    page = await loadBillingPage({ id: USER, email: 'dana@example.com' }, CHECKOUT, 'success');
    expect(page.returned?.status).toBe('paid');
    expect(alerts()).toEqual([]);
    // coming back from a cancel doesn't ask
    state.checkouts.set(CHECKOUT, checkout());
    fetchMock.mockClear();
    await loadBillingPage({ id: USER, email: 'dana@example.com' }, CHECKOUT, 'cancel');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the daily check settles purchases whose notice never came, and tells support', async () => {
    const { reportOverdue } = await billing();
    expect(await reportOverdue()).toBe(0);
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('paid');
    expect(alerts()).toEqual(['[Badook billing] 1 payments settled without their PayPlus notice']);
  });

  it('deleting an account whose monthly charge PayPlus won’t stop: support is told, and so is the host', async () => {
    const { deleteAccount } = await import('@/features/billing/server/account-api');
    state.account = account({
      plan: 'pro',
      billingProvider: 'payplus',
      billingSubscriptionId: 'rec-1',
      planRenewsAt: '2026-10-24T10:00:00Z',
    });
    payplus.cancel = 'error';
    expect(await deleteAccount({ id: USER, email: 'dana@example.com' }, { confirm: true })).toEqual({
      status: 200,
      body: { ok: true, chargeStopped: false },
    });
    expect(deleteUser).toHaveBeenCalledWith(USER);
    expect(alerts()).toEqual(['[Badook billing] Stop a monthly charge by hand (the account was deleted)']);
    expect(sendEmail.mock.calls[0]![0].text).toContain('subscription: rec-1');
    payplus.cancel = 'success';
    sendEmail.mockClear();
    expect((await deleteAccount({ id: USER, email: 'dana@example.com' }, { confirm: true })).body).toEqual({
      ok: true,
      chargeStopped: true,
    });
    expect(alerts()).toEqual([]);
  });
});

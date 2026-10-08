import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Checkout, DueRenewal } from '@/features/billing/server/billing';

// Tranzila: the API's authentication, the iframe's address, reading what the iframe sends back and the
// API's answers, and what billing does with them — a purchase opened as an iframe, the card's token
// charged once for the purchase's own amount (whichever notice comes first), a declined or unclear
// charge, another card after a decline, the monthly charges with their retries, and the return page.

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/request-url', () => ({ requestBaseUrl: async () => 'https://invitations.example.com' }));
const sendEmail = vi.fn(async (_email: { subject: string; text: string }) => true);
vi.mock('@/features/invitations/server/email', () => ({
  sendEmail: (email: { subject: string; text: string }) => sendEmail(email),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const CHECKOUT = '22222222-2222-4222-8222-222222222222';
const APP_KEY = 'tz-app-key';
const SECRET = 'tz-secret';

// ─── an in-memory database behind serviceDb().rpc ────────────────────────────────────────────────

type Account = Record<string, unknown> & { plan: string; planStatus: string; planRenewsAt: string | null };
const state = {
  checkouts: new Map<string, Checkout>(),
  account: null as Account | null,
  claims: new Set<string>(),
  due: [] as DueRenewal[],
  /** Supabase → Vault → Secrets */
  vault: {} as Record<string, string>,
  calls: [] as [string, Record<string, unknown>][],
};
const calls = (fn: string) => state.calls.filter(([name]) => name === fn).map(([, args]) => args);

const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  state.calls.push([fn, args]);
  const data = ((): unknown => {
    switch (fn) {
      case 'account_get':
        return state.account;
      case 'account_note_limit':
      case 'billing_card_save':
        return null;
      case 'billing_apply':
        return true;
      case 'billing_claim': {
        const fresh = !state.claims.has(String(args.p_id));
        state.claims.add(String(args.p_id));
        return fresh;
      }
      case 'billing_secrets':
        return Object.fromEntries(
          (args.p_names as string[]).filter((n) => n in state.vault).map((n) => [n, state.vault[n]]),
        );
      case 'billing_renewals_due':
        return state.due;
      case 'checkout_create': {
        const id = `33333333-3333-4333-8333-${String(state.checkouts.size).padStart(12, '0')}`;
        state.checkouts.set(
          id,
          checkout({ id, product: args.p_product as Checkout['product'], amount: Number(args.p_amount) }),
        );
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
      case 'billing_overdue':
      case 'billing_pending_checkouts':
        return [];
    }
    throw new Error(`unexpected rpc ${fn}`);
  })();
  return { data, error: null };
});
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));

// ─── Tranzila's API ──────────────────────────────────────────────────────────────────────────────

const tranzila = {
  /** what the next charges answer, in turn (then approved) */
  answers: [] as (() => Response | Promise<Response>)[],
};
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const approved = (id = 9001) =>
  answer({
    error_code: 0,
    message: 'Success',
    transaction_result: { processor_response_code: '000', transaction_id: id, auth_number: '0123456' },
  });
const declined = () =>
  answer({
    error_code: 0,
    message: 'Success',
    transaction_result: { processor_response_code: '004', transaction_id: 9002 },
  });
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (!url.endsWith('/v1/transaction/credit_card/create')) return answer({ error_code: 404 }, 404);
  const next = tranzila.answers.shift();
  return next ? next() : approved();
});
const charges = () =>
  fetchMock.mock.calls.map(([, init]) => ({
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    headers: init?.headers as Record<string, string>,
  }));

function checkout(over: Partial<Checkout> = {}): Checkout {
  return {
    id: CHECKOUT,
    userId: USER,
    product: 'pro',
    amount: 49,
    provider: 'tranzila',
    providerRef: null,
    status: 'pending',
    createdAt: '2026-10-07T10:00:00Z',
    completedAt: null,
    ...over,
  };
}

function account(over: Partial<Account> = {}): Account {
  return {
    userId: USER,
    fullName: 'Dana',
    phone: '+972501234567',
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
    discount: null,
    planPrice: null,
    ...over,
  };
}

/** What the iframe sends to the notify address (a form), for our purchase. */
function form(over: Record<string, string> = {}): Record<string, string> {
  return {
    Response: '000',
    sum: '1.00', // what the form says is never what is charged
    TranzilaTK: 'Z5f3c1a2b3c4d5e6f71234',
    expmonth: '08',
    expyear: '29',
    ccno: '1234',
    myid: '123456782',
    contact: 'Dana',
    email: 'dana@example.com',
    index: '77',
    badook_checkout: CHECKOUT,
    ...over,
  };
}

function due(over: Partial<DueRenewal> = {}): DueRenewal {
  return {
    userId: USER,
    email: 'dana@example.com',
    fullName: 'Dana',
    plan: 'pro',
    planStatus: 'active',
    planRenewsAt: '2026-10-01T09:00:00.000Z',
    planPrice: 39.2,
    token: 'Z5f3c1a2b3c4d5e6f71234',
    expireMonth: 8,
    expireYear: 2029,
    ...over,
  };
}

beforeAll(() => {
  vi.stubEnv('INVITES_TRANZILA_APP_KEY', APP_KEY);
  vi.stubEnv('INVITES_TRANZILA_SECRET', SECRET);
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
  state.checkouts = new Map([[CHECKOUT, checkout()]]);
  state.account = account();
  state.claims = new Set();
  state.due = [];
  state.vault = {};
  state.calls = [];
  tranzila.answers = [];
  fetchMock.mockClear();
  sendEmail.mockClear();
});

const billing = () => import('@/features/billing/server/billing');
const client = () => import('@/features/billing/server/tranzila');
const alerts = () => sendEmail.mock.calls.map(([email]) => email.subject);

describe('Tranzila: the API and the iframe', () => {
  it('signs each request: HMAC-SHA256 of the app key, keyed by secret + time + nonce, in hex', async () => {
    const { authHeaders } = await client();
    const keys = { appKey: APP_KEY, secret: SECRET };
    const headers = authHeaders(keys, 1_760_000_000_400, 'n0nce');
    expect(headers).toEqual({
      'X-tranzila-api-app-key': APP_KEY,
      'X-tranzila-api-request-time': '1760000000',
      'X-tranzila-api-nonce': 'n0nce',
      'X-tranzila-api-access-token': createHmac('sha256', `${SECRET}1760000000n0nce`)
        .update(APP_KEY)
        .digest('hex'),
    });
    // a fresh nonce each time
    expect(authHeaders(keys)['X-tranzila-api-nonce']).toMatch(/^[0-9a-f]{80}$/);
    expect(authHeaders(keys)['X-tranzila-api-nonce']).not.toBe(authHeaders(keys)['X-tranzila-api-nonce']);
  });

  it('the iframe: the iframe terminal’s form, the sum, a token, our purchase and our addresses', async () => {
    const { iframeUrl } = await client();
    const url = new URL(
      iframeUrl({
        ref: CHECKOUT,
        amount: 49,
        itemName: 'חבילת Badook Pro',
        customer: { name: 'Dana', email: 'dana@example.com', phone: '+972501234567' },
        locale: 'he',
        urls: { success: 'https://x.test/ok', failure: 'https://x.test/no', notify: 'https://x.test/n' },
      }),
    );
    expect(url.origin + url.pathname).toBe('https://direct.tranzila.com/badookinvit/iframenew.php');
    const p = Object.fromEntries(url.searchParams);
    expect(p).toMatchObject({
      sum: '49.00',
      currency: '1',
      cred_type: '1',
      tranmode: 'NK',
      lang: 'il',
      pdesc: 'חבילת Badook Pro',
      contact: 'Dana',
      email: 'dana@example.com',
      phone: '+972501234567',
      success_url_address: 'https://x.test/ok',
      fail_url_address: 'https://x.test/no',
      notify_url_address: 'https://x.test/n',
      badook_checkout: CHECKOUT,
    });
  });

  it('reads what the iframe sends back', async () => {
    const { readNotice } = await client();
    expect(readNotice(form())).toEqual({
      response: '000',
      ok: true,
      checkoutId: CHECKOUT,
      token: 'Z5f3c1a2b3c4d5e6f71234',
      expMonth: 8,
      expYear: 2029,
      last4: '1234',
      holderId: '123456782',
      index: '77',
      contact: 'Dana',
      email: 'dana@example.com',
    });
    // expdate instead of expmonth/expyear; a declined form; garbage
    expect(readNotice(form({ expmonth: '', expyear: '', expdate: '1130' }))).toMatchObject({
      expMonth: 11,
      expYear: 2030,
    });
    expect(readNotice(form({ Response: '033' })).ok).toBe(false);
    expect(readNotice({ badook_checkout: 'x; drop', TranzilaTK: 'a b', expmonth: '13' })).toMatchObject({
      ok: false,
      checkoutId: null,
      token: null,
      expMonth: null,
    });
  });

  it('reads the API’s answers: approved, declined, refused, and unclear', async () => {
    const { readChargeResponse } = await client();
    expect(
      readChargeResponse(200, {
        error_code: 0,
        transaction_result: { processor_response_code: '000', transaction_id: 5, auth_number: '77' },
      }),
    ).toEqual({ status: 'approved', transactionId: '5', authNumber: '77', code: '000' });
    expect(
      readChargeResponse(200, { error_code: 0, transaction_result: { processor_response_code: '004' } }),
    ).toMatchObject({ status: 'declined', code: '004' });
    expect(readChargeResponse(401, { error_code: 401, message: 'Unauthorized' })).toMatchObject({
      status: 'declined',
      message: 'Unauthorized',
    });
    expect(readChargeResponse(502, null).status).toBe('unknown');
    expect(readChargeResponse(503, { error_code: 1 }).status).toBe('unknown');
  });
});

describe('Tranzila: buying', () => {
  it('with the keys set, a purchase opens Tranzila’s form as an iframe (no redirect)', async () => {
    const { billingMode, startCheckout } = await billing();
    expect(await billingMode()).toBe('tranzila');
    const res = await startCheckout(
      { id: USER, email: 'dana@example.com', user_metadata: {} },
      { product: 'business' },
      'en',
    );
    expect(res.status).toBe(200);
    const body = res.body as { iframe: string; checkout: string; amount: number; url?: string };
    expect(body.url).toBeUndefined();
    expect(body.amount).toBe(149);
    expect(calls('checkout_create')[0]).toMatchObject({ p_product: 'business', p_provider: 'tranzila' });
    const p = new URL(body.iframe).searchParams;
    expect(p.get('badook_checkout')).toBe(body.checkout);
    expect(p.get('sum')).toBe('149.00');
    expect(p.get('lang')).toBe('us');
    expect(p.get('notify_url_address')).toBe('https://invitations.example.com/api/billing/tranzila/notify');
    expect(p.get('success_url_address')).toBe(
      `https://invitations.example.com/api/billing/tranzila/return?result=success&checkout=${body.checkout}`,
    );
    // nothing is charged until the form gives a card
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the card’s token is charged on the token terminal for the purchase’s own amount: the plan is given', async () => {
    const { tranzilaNotice } = await billing();
    expect(await tranzilaNotice(form())).toEqual({ outcome: 'paid', checkoutId: CHECKOUT });
    const [charge] = charges();
    expect(charge!.body).toMatchObject({
      terminal_name: 'badookinvittok',
      txn_type: 'debit',
      txn_currency_code: 'ILS',
      card_number: 'Z5f3c1a2b3c4d5e6f71234',
      expire_month: 8,
      expire_year: 2029,
      card_holder_id: '123456782',
      items: [{ unit_price: 49, units_number: 1 }],
      remarks: CHECKOUT,
    });
    expect(charge!.headers['X-tranzila-api-app-key']).toBe(APP_KEY);
    // the plan renews with this card
    expect(calls('billing_card_save')[0]).toMatchObject({
      p_user_id: USER,
      p_provider: 'tranzila',
      p_token: 'Z5f3c1a2b3c4d5e6f71234',
      p_month: 8,
      p_year: 2029,
      p_last4: '1234',
    });
    const [done] = calls('checkout_complete');
    expect(done).toMatchObject({
      p_id: CHECKOUT,
      p_status: 'paid',
      p_event_id: `tranzila:paid:${CHECKOUT}`,
      p_credits: 50,
    });
    expect(done!.p_patch).toMatchObject({
      plan: 'pro',
      planStatus: 'active',
      billingProvider: 'tranzila',
      billingSubscriptionId: `tranzila:${CHECKOUT}`,
    });
    // Tranzila's transaction id is in the record; the token never is
    expect(JSON.stringify(done!.p_payload)).toContain('9001');
    expect(JSON.stringify(done!.p_payload)).not.toContain('Z5f3c1a2b3c4d5e6f71234');
  });

  it('the notify and the return page both bring the card: it is charged once', async () => {
    const { tranzilaNotice } = await billing();
    const [a, b] = await Promise.all([tranzilaNotice(form()), tranzilaNotice(form())]);
    expect([a.outcome, b.outcome].sort()).toEqual(['paid', 'pending']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await tranzilaNotice(form())).toEqual({ outcome: 'paid', checkoutId: CHECKOUT });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a message pack: its credits, and no card kept', async () => {
    state.checkouts.set(CHECKOUT, checkout({ product: 'credits_300', amount: 48 }));
    const { tranzilaNotice } = await billing();
    expect((await tranzilaNotice(form())).outcome).toBe('paid');
    expect(charges()[0]!.body.items).toMatchObject([{ unit_price: 48 }]);
    expect(calls('billing_card_save')).toEqual([]);
    expect(calls('checkout_complete')[0]).toMatchObject({ p_credits: 300, p_patch: {} });
  });

  it('a declined charge fails the purchase; another card in the same form still pays for it', async () => {
    tranzila.answers = [declined];
    const { tranzilaNotice } = await billing();
    expect((await tranzilaNotice(form())).outcome).toBe('failed');
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('failed');
    expect(calls('billing_card_save')).toEqual([]);
    // the same card again is not charged again
    expect((await tranzilaNotice(form())).outcome).toBe('pending');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // another card
    expect((await tranzilaNotice(form({ TranzilaTK: 'Zother0000000000001' }))).outcome).toBe('paid');
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('paid');
  });

  it('a form that failed (no card) fails a pending purchase, without charging', async () => {
    const { tranzilaNotice } = await billing();
    expect((await tranzilaNotice(form({ Response: '033', TranzilaTK: '' }))).outcome).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls('checkout_complete')[0]).toMatchObject({ p_status: 'failed' });
    // nothing changes a paid purchase
    state.checkouts.set(CHECKOUT, checkout({ status: 'paid' }));
    expect((await tranzilaNotice(form({ Response: '033' }))).outcome).toBe('paid');
  });

  it('no clear answer from Tranzila: kept pending, never charged again, and support is told', async () => {
    tranzila.answers = [() => Promise.reject(new Error('timeout'))];
    const { tranzilaNotice } = await billing();
    expect((await tranzilaNotice(form())).outcome).toBe('pending');
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('pending');
    expect(alerts()).toEqual([expect.stringContaining('without a clear answer')]);
    expect((await tranzilaNotice(form())).outcome).toBe('pending');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a notice for no purchase of ours, or for another provider’s, charges nothing', async () => {
    const { tranzilaNotice } = await billing();
    expect(await tranzilaNotice(form({ badook_checkout: '44444444-4444-4444-8444-444444444444' }))).toEqual({
      outcome: 'unknown_checkout',
      checkoutId: null,
    });
    state.checkouts.set(CHECKOUT, checkout({ provider: 'payplus' }));
    expect((await tranzilaNotice(form())).outcome).toBe('unknown_checkout');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Tranzila: the monthly charge', () => {
  const NOW = Date.parse('2026-10-01T12:00:00Z');

  it('a plan whose month is up is charged its price: another month (from its day) and its credits', async () => {
    state.due = [due()];
    const { chargeRenewals } = await billing();
    expect(await chargeRenewals(NOW)).toEqual({ paid: 1, failed: 0 });
    expect(charges()[0]!.body).toMatchObject({
      terminal_name: 'badookinvittok',
      card_number: 'Z5f3c1a2b3c4d5e6f71234',
      expire_month: 8,
      expire_year: 2029,
      items: [{ unit_price: 39.2 }],
    });
    expect(calls('billing_apply')[0]).toMatchObject({
      p_event_id: `tranzila:renewal:${USER}:2026-10-01T09:00:00.000Z:0`,
      p_provider: 'tranzila',
      p_type: 'renewal.paid',
      p_user_id: USER,
      p_patch: { planStatus: 'active', planRenewsAt: '2026-11-01T09:00:00.000Z' },
      p_credits: 50,
      p_product: 'pro',
      p_amount: 39.2,
    });
    // the same day's run again: not charged twice
    expect(await chargeRenewals(NOW)).toEqual({ paid: 0, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('declined: past due, and tried again 2, 5 and 9 days later — once each', async () => {
    state.due = [due({ planPrice: null, plan: 'business' })];
    tranzila.answers = [declined, declined, declined];
    const { chargeRenewals } = await billing();
    expect(await chargeRenewals(NOW)).toEqual({ paid: 0, failed: 1 });
    expect(calls('billing_apply')[0]).toMatchObject({
      p_type: 'renewal.failed',
      p_patch: { planStatus: 'past_due' },
      p_credits: 0,
      // no price kept: the list price
      p_amount: 149,
    });
    const day = 86_400_000;
    expect(await chargeRenewals(NOW + day)).toEqual({ paid: 0, failed: 0 });
    expect(await chargeRenewals(NOW + 2 * day)).toEqual({ paid: 0, failed: 1 });
    expect(await chargeRenewals(NOW + 4 * day)).toEqual({ paid: 0, failed: 0 });
    expect(await chargeRenewals(NOW + 5 * day)).toEqual({ paid: 0, failed: 1 });
    expect(await chargeRenewals(NOW + 9 * day)).toEqual({ paid: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(new Set(calls('billing_apply').map((c) => c.p_event_id)).size).toBe(4);
  });

  it('no clear answer: support is told, nothing is recorded, and that attempt is not made again', async () => {
    state.due = [due()];
    tranzila.answers = [() => answer({}, 504)];
    const { chargeRenewals } = await billing();
    expect(await chargeRenewals(NOW)).toEqual({ paid: 0, failed: 0 });
    expect(calls('billing_apply')).toEqual([]);
    expect(alerts()).toEqual([expect.stringContaining('monthly charge without a clear answer')]);
    expect(await chargeRenewals(NOW)).toEqual({ paid: 0, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('the daily run makes the monthly charges', async () => {
    state.due = [due()];
    const { reportOverdue } = await billing();
    await reportOverdue();
    expect(calls('billing_renewals_due')).toEqual([{ p_provider: 'tranzila', p_grace_days: 14 }]);
    expect(calls('billing_apply')[0]).toMatchObject({ p_type: 'renewal.paid' });
  });
});

describe('Tranzila: the iframe’s return page', () => {
  const route = () => import('@/app/api/billing/tranzila/return/route');
  const post = (query: string, fields: Record<string, string>) =>
    new Request(`https://invitations.example.com/api/billing/tranzila/return?${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
  const target = async (res: Response) =>
    /location\.replace\(t\)/.test(await res.clone().text())
      ? JSON.parse(/var t=("[^"]*")/.exec(await res.text())![1]!)
      : null;

  it('charges the card it brings and takes the billing screen to the result', async () => {
    const { POST } = await route();
    const res = await POST(post(`result=success&checkout=${CHECKOUT}`, form()));
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await target(res)).toBe(`/app/billing?status=success&checkout=${CHECKOUT}`);
    expect(state.checkouts.get(CHECKOUT)!.status).toBe('paid');
  });

  it('a declined charge, or the form’s failure page: the screen says it failed', async () => {
    const { POST } = await route();
    tranzila.answers = [declined];
    expect(await target(await POST(post(`result=success&checkout=${CHECKOUT}`, form())))).toBe(
      `/app/billing?status=failure&checkout=${CHECKOUT}`,
    );
    const { GET } = await route();
    expect(
      await target(
        await GET(
          new Request(
            `https://invitations.example.com/api/billing/tranzila/return?result=failure&checkout=${CHECKOUT}`,
          ),
        ),
      ),
    ).toBe(`/app/billing?status=failure&checkout=${CHECKOUT}`);
  });

  it('without the card’s details (only the notify brings them): the screen waits for the payment', async () => {
    const { GET } = await route();
    const res = await GET(
      new Request(
        `https://invitations.example.com/api/billing/tranzila/return?result=success&checkout=${CHECKOUT}`,
      ),
    );
    expect(await target(res)).toBe(`/app/billing?status=success&checkout=${CHECKOUT}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Tranzila: the API keys from the Vault', () => {
  const VAULT = { TRANZILA_API_APP_KEY: 'vault-app-key', TRANZILA_API_SECRET: 'vault-secret' };
  const withoutEnvKeys = () => {
    vi.stubEnv('INVITES_TRANZILA_APP_KEY', '');
    vi.stubEnv('INVITES_TRANZILA_SECRET', '');
  };
  const restore = () => {
    vi.stubEnv('INVITES_TRANZILA_APP_KEY', APP_KEY);
    vi.stubEnv('INVITES_TRANZILA_SECRET', SECRET);
  };

  it('Amplify’s variables win; without them, the Vault’s secrets are used (and kept a while)', async () => {
    state.vault = VAULT;
    expect(await (await client()).tranzilaKeys()).toEqual({ appKey: APP_KEY, secret: SECRET, source: 'env' });
    expect(calls('billing_secrets')).toEqual([]);
    try {
      withoutEnvKeys();
      // fresh modules: the environment is read again
      vi.resetModules();
      const { tranzilaKeys, resetTranzilaKeys } = await client();
      expect(await tranzilaKeys()).toEqual({
        appKey: 'vault-app-key',
        secret: 'vault-secret',
        source: 'vault',
      });
      await tranzilaKeys();
      expect(calls('billing_secrets')).toHaveLength(1);
      // the charge is signed with them
      const { tranzilaNotice, billingMode } = await billing();
      expect(await billingMode()).toBe('tranzila');
      expect((await tranzilaNotice(form())).outcome).toBe('paid');
      expect(charges()[0]!.headers['X-tranzila-api-app-key']).toBe('vault-app-key');
      // nothing in the Vault either: off, and a charge isn't even tried
      state.vault = {};
      resetTranzilaKeys();
      expect(await billingMode()).toBe('off');
    } finally {
      restore();
      vi.resetModules();
    }
  });
});

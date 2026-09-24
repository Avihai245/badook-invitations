import 'server-only';
import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { serverEnv } from '@/lib/env';
import type { UiLocale } from '@/lib/i18n/app';
import { requestBaseUrl } from '@/lib/request-url';
import { serviceDb } from '@/lib/supabase/server';
import {
  CREDIT_PACKS,
  PLAN_LIMITS,
  isProduct,
  messagePriceIls,
  packOf,
  packPriceIls,
  type PlanId,
  type Product,
} from '../plans';
import { accountDb, loadAccount, planPrices, type AccountView, type BillingPatch } from './account';
import { alertSupport } from './alert';
import {
  cancelRecurring,
  confirmPayment,
  generatePaymentLink,
  payplusConfigured,
  readTransaction,
  validCallbackHash,
  type PayplusTransaction,
} from './payplus';

/**
 * Plans and message packs: a purchase (billing_checkouts) → the provider's payment page → its callback,
 * confirmed with the provider → the plan or the credits (checkout_complete / billing_apply, once).
 * Monthly renewals come as callbacks for the subscription. INVITES_BILLING_TEST_MODE replaces PayPlus
 * with a test page of our own (local and end-to-end tests).
 */

const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export interface Checkout {
  id: string;
  userId: string;
  product: Product;
  amount: number;
  provider: string;
  providerRef: string | null;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  createdAt: string;
  completedAt: string | null;
}

/** A monthly charge of a plan, paid or failed (billing_events). */
export interface Renewal {
  /** null for renewals recorded before products were kept */
  product: Product | null;
  amount: number | null;
  status: 'paid' | 'failed';
  at: string;
}

export const checkoutDb = {
  create: (userId: string, product: Product, amount: number, provider: string) =>
    rpc<string>('checkout_create', {
      p_user_id: userId,
      p_product: product,
      p_amount: amount,
      p_provider: provider,
    }),
  attach: (id: string, ref: string) => rpc<null>('checkout_attach', { p_id: id, p_provider_ref: ref }),
  get: (id: string, userId: string | null) =>
    rpc<Checkout | null>('checkout_get', { p_id: id, p_user_id: userId }),
  complete: (
    id: string,
    status: 'paid' | 'failed' | 'canceled',
    eventId: string,
    patch: BillingPatch,
    credits: number,
    payload: unknown,
  ) =>
    rpc<{ settled: boolean; userId?: string; product?: Product }>('checkout_complete', {
      p_id: id,
      p_status: status,
      p_event_id: eventId,
      p_patch: patch,
      p_credits: credits,
      p_payload: payload ?? {},
    }),
  history: (userId: string) =>
    rpc<{
      checkouts: Checkout[];
      renewals: Renewal[];
      credits: { delta: number; reason: string; at: string }[];
    }>('billing_history', { p_user_id: userId }),
  /** purchases still waiting for the provider's notice */
  pending: (provider: string, minMinutes: number, maxDays: number) =>
    rpc<Checkout[]>('billing_pending_checkouts', {
      p_provider: provider,
      p_min_minutes: minMinutes,
      p_max_days: maxDays,
    }),
};

export type BillingMode = 'payplus' | 'test' | 'off';
export function billingMode(): BillingMode {
  const env = serverEnv();
  // the test payment page never runs on a public address, even if the flag is left on by mistake
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.INVITES_PUBLIC_BASE_URL);
  if (env.INVITES_BILLING_TEST_MODE && local) return 'test';
  return payplusConfigured() ? 'payplus' : 'off';
}

/** What a product costs now (shekels incl. VAT). */
export function productPrice(product: Product): number {
  const pack = packOf(product);
  if (pack) {
    const env = serverEnv();
    return packPriceIls(pack, env.INVITES_WHATSAPP_PRICE_USD, env.INVITES_USD_TO_ILS);
  }
  return planPrices()[product as Exclude<PlanId, 'free'>];
}

const isPlan = (p: Product): p is 'pro' | 'business' => p === 'pro' || p === 'business';

/** A month after `from` (the next renewal). */
export function nextRenewal(from: number): string {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

// ─── buying ──────────────────────────────────────────────────────────────────────────────────────

const CheckoutSchema = z.strictObject({ product: z.string().refine(isProduct) });

/** POST /api/billing/checkout — opens a purchase and returns the payment page to go to. */
export async function startCheckout(
  user: Pick<User, 'id' | 'email' | 'user_metadata'>,
  raw: unknown,
  locale: UiLocale,
): Promise<ApiResult> {
  const parsed = CheckoutSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const product = parsed.data.product as Product;
  const mode = billingMode();
  if (mode === 'off') return fail(503, 'not_configured');
  const account = await loadAccount(user);
  // the plan in force decides: a plan that lapsed can be bought again, and so can one whose monthly
  // charge failed (a new payment replaces it) or that was canceled
  const running = account.planStatus === 'active' || account.planStatus === 'trialing';
  if (isPlan(product) && account.effective === product && running && !account.admin)
    return fail(409, 'already');
  const amount = productPrice(product);
  if (!(amount > 0)) return fail(503, 'not_configured');
  const id = await checkoutDb.create(user.id, product, amount, mode);
  // back to the address the host is on (their session is there)
  const base = await requestBaseUrl();
  if (mode === 'test') return ok({ ok: true, url: `${base}/app/billing/test-checkout?id=${id}` });

  const t =
    locale === 'en'
      ? { plan: 'Badook plan', credits: 'WhatsApp messages' }
      : { plan: 'חבילת Badook', credits: 'הודעות וואטסאפ' };
  const pack = packOf(product);
  const page = await generatePaymentLink({
    ref: id,
    amount,
    itemName: pack ? `${t.credits} × ${pack}` : `${t.plan} ${product === 'pro' ? 'Pro' : 'Business'}`,
    customer: {
      name: account.fullName || String(user.user_metadata?.full_name ?? user.email ?? ''),
      email: user.email ?? '',
      phone: account.phone,
    },
    recurring: isPlan(product),
    locale,
    urls: {
      success: `${base}/app/billing?status=success&checkout=${id}`,
      failure: `${base}/app/billing?status=failure&checkout=${id}`,
      cancel: `${base}/app/billing?status=cancel&checkout=${id}`,
      callback: `${base}/api/billing/payplus/callback`,
    },
  });
  await checkoutDb.attach(id, page.pageRequestUid);
  return ok({ ok: true, url: page.url });
}

/** Gives the purchase: a plan (renewing monthly, with its credits) or a message pack. Once. */
async function settle(
  checkout: Checkout,
  outcome: 'paid' | 'failed' | 'canceled',
  {
    eventId,
    subscriptionId,
    customerId,
    payload,
  }: { eventId: string; subscriptionId: string | null; customerId: string | null; payload: unknown },
) {
  const account =
    outcome === 'paid' && isPlan(checkout.product) ? await accountDb.get(checkout.userId) : null;
  const patch: BillingPatch = {};
  let credits = 0;
  if (outcome === 'paid' && isPlan(checkout.product)) {
    Object.assign(patch, {
      plan: checkout.product,
      planStatus: 'active',
      planRenewsAt: nextRenewal(Date.now()),
      billingProvider: checkout.provider,
      billingSubscriptionId: subscriptionId,
      ...(customerId ? { billingCustomerId: customerId } : {}),
    });
    credits = PLAN_LIMITS[checkout.product].monthlyCredits;
  } else if (outcome === 'paid') credits = packOf(checkout.product) ?? 0;
  const done = await checkoutDb.complete(checkout.id, outcome, eventId, patch, credits, payload);
  // a new plan replaces the old one: its monthly charge stops
  const previous = account?.billingSubscriptionId;
  if (done.settled && previous && previous !== subscriptionId && account?.billingProvider === 'payplus')
    if (!(await cancelRecurring(previous)))
      await alertSupport('Stop an old monthly charge', { userId: checkout.userId, subscription: previous });
  return done;
}

// ─── the provider's callback ─────────────────────────────────────────────────────────────────────

export type FirstPayment =
  | { outcome: 'paid'; transaction: PayplusTransaction }
  | { outcome: 'failed' }
  | { outcome: 'pending' }
  | { outcome: 'amount_mismatch'; paid: number | null };

/**
 * How a purchase's first payment ended. PayPlus's own answer for the page request we opened decides
 * (`confirmed`, PaymentPages/ipn); a signed notice that says paid for that very page request, with the
 * right amount, counts too (the answer can lag behind the notice, or keep its fields elsewhere).
 * Nothing is marked failed while anything says it was paid: it stays pending until a later notice, the
 * billing page or the daily check settles it. `notice` null: no notice, just asking PayPlus again.
 */
export function decideFirstPayment(
  checkout: Pick<Checkout, 'amount' | 'providerRef'>,
  confirmed: PayplusTransaction,
  notice: PayplusTransaction | null,
  signed: boolean,
): FirstPayment {
  const price = Number(checkout.amount);
  const amountOk = (tx: PayplusTransaction) => tx.amount === null || Math.abs(tx.amount - price) < 0.01;
  if (confirmed.paid)
    return amountOk(confirmed)
      ? { outcome: 'paid', transaction: confirmed }
      : { outcome: 'amount_mismatch', paid: confirmed.amount };
  const vouched =
    notice?.paid &&
    signed &&
    notice.amount !== null &&
    (!notice.pageRequestUid || notice.pageRequestUid === checkout.providerRef);
  if (vouched)
    return amountOk(notice)
      ? { outcome: 'paid', transaction: notice }
      : { outcome: 'amount_mismatch', paid: notice.amount };
  if (!notice || notice.paid) return { outcome: 'pending' };
  return { outcome: 'failed' };
}

/** Settles a PayPlus purchase from what PayPlus says about it now (decideFirstPayment). */
async function reconcileCheckout(
  checkout: Checkout,
  notice: { tx: PayplusTransaction; signed: boolean; payload: unknown } | null,
): Promise<FirstPayment['outcome']> {
  const confirmed = await confirmPayment(checkout.providerRef!);
  const decision = decideFirstPayment(checkout, confirmed, notice?.tx ?? null, notice?.signed ?? false);
  const payload = notice?.payload ?? { confirmedWithPayplus: confirmed };
  switch (decision.outcome) {
    case 'amount_mismatch':
      await alertSupport('Paid amount differs from the price', {
        checkout: checkout.id,
        paid: decision.paid,
        price: checkout.amount,
      });
      break;
    case 'pending':
      // a notice said paid, and PayPlus doesn't confirm it (yet): kept pending, and a person looks
      if (notice?.tx.paid)
        await alertSupport('A payment PayPlus has not confirmed (kept pending)', {
          checkout: checkout.id,
          userId: checkout.userId,
          product: checkout.product,
          amount: checkout.amount,
          pageRequest: checkout.providerRef,
          transaction: notice.tx.transactionUid,
          signed: notice.signed,
        });
      break;
    case 'failed':
      if (checkout.status === 'pending')
        await settle(checkout, 'failed', {
          // the transaction's id (a repeat of this notice is applied once); without one, apart from
          // the paid event's fallback id — a failed purchase can still turn out paid
          eventId: `payplus:${notice?.tx.transactionUid ?? `failed:${checkout.id}`}`,
          subscriptionId: null,
          customerId: null,
          payload,
        });
      break;
    case 'paid': {
      const tx = decision.transaction;
      await settle(checkout, 'paid', {
        eventId: `payplus:${tx.transactionUid ?? notice?.tx.transactionUid ?? checkout.id}`,
        subscriptionId: tx.recurringUid ?? notice?.tx.recurringUid ?? null,
        customerId: tx.customerUid ?? notice?.tx.customerUid ?? null,
        payload,
      });
      break;
    }
  }
  return decision.outcome;
}

/**
 * POST /api/billing/payplus/callback — a first payment (matched to our purchase by `more_info` and
 * confirmed with PayPlus against the page request we stored; a purchase not settled as paid yet takes
 * a later notice too) or a monthly renewal (matched by the subscription; its signature must be valid).
 */
export async function payplusCallback(
  raw: string,
  hash: string | null,
): Promise<{ status: number; body: string }> {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { status: 400, body: 'bad json' };
  }
  const tx = readTransaction(payload);
  const signed = validCallbackHash(raw, hash);
  const checkoutId = tx.moreInfo && /^[0-9a-f-]{36}$/i.test(tx.moreInfo) ? tx.moreInfo : null;
  const checkout = checkoutId ? await checkoutDb.get(checkoutId, null) : null;

  if (checkout && (checkout.status === 'pending' || (checkout.status === 'failed' && tx.paid))) {
    if (checkout.provider !== 'payplus' || !checkout.providerRef) return { status: 404, body: 'unknown' };
    const outcome = await reconcileCheckout(checkout, { tx, signed, payload });
    if (!tx.renewal) return { status: 200, body: outcome.replace('_', ' ') };
  }
  // a message pack is paid once: nothing about it renews anything
  if (checkout && !isPlan(checkout.product)) return { status: 200, body: 'ok' };

  // a monthly charge of an existing plan (or a repeated notice of one already applied: the event id
  // is the transaction's, so it is applied once)
  if (!signed) {
    await alertSupport('Unsigned PayPlus callback', {
      transaction: tx.transactionUid,
      recurring: tx.recurringUid,
    });
    return { status: 401, body: 'bad signature' };
  }
  if ((!tx.recurringUid && !tx.customerUid) || !tx.transactionUid) return { status: 200, body: 'ignored' };
  await applyRenewal(
    'payplus',
    tx.recurringUid,
    tx.customerUid,
    tx.paid,
    tx.transactionUid,
    payload,
    tx.amount,
  );
  return { status: 200, body: 'ok' };
}

/**
 * A renewal of the plan paid through this subscription: another month and its credits, or past due.
 * Recorded with the plan and the amount charged (the price now when the notice doesn't say).
 */
export async function applyRenewal(
  provider: string,
  subscriptionId: string | null,
  customerId: string | null,
  paid: boolean,
  transactionId: string | null,
  payload: unknown,
  amount: number | null = null,
): Promise<boolean> {
  const userId = await accountDb.byBilling(provider, subscriptionId, customerId);
  if (!userId) {
    await alertSupport('Renewal for an unknown subscription', {
      provider,
      subscriptionId,
      customerId,
      transactionId,
    });
    return false;
  }
  const account = await accountDb.get(userId);
  if (!account || account.plan === 'free') return false;
  return accountDb.billingApply({
    id: `${provider}:${transactionId ?? `${subscriptionId}:${Date.now()}`}`,
    provider,
    type: paid ? 'renewal.paid' : 'renewal.failed',
    userId,
    patch: paid
      ? {
          planStatus: account.planStatus === 'canceled' ? 'canceled' : 'active',
          planRenewsAt: nextRenewal(Date.now()),
        }
      : { planStatus: 'past_due' },
    credits: paid ? PLAN_LIMITS[account.plan].monthlyCredits : 0,
    payload,
    product: account.plan,
    amount: amount ?? planPrices()[account.plan],
  });
}

// ─── canceling ───────────────────────────────────────────────────────────────────────────────────

/** POST /api/billing/cancel — no more monthly charges; the plan stays until the paid period ends. */
export async function cancelPlan(user: Pick<User, 'id' | 'email'>): Promise<ApiResult> {
  const account = await loadAccount(user);
  if (account.plan === 'free' || account.planStatus === 'canceled') return fail(409, 'nothing_to_cancel');
  if (account.billingProvider === 'payplus' && account.billingSubscriptionId) {
    const stopped = await cancelRecurring(account.billingSubscriptionId);
    if (!stopped)
      await alertSupport('Stop a monthly charge by hand (the host canceled)', {
        userId: user.id,
        email: user.email,
        subscription: account.billingSubscriptionId,
      });
  }
  await accountDb.billingApply({
    id: `cancel:${user.id}:${Date.now()}`,
    provider: account.billingProvider ?? 'none',
    type: 'plan.canceled',
    userId: user.id,
    patch: { planStatus: 'canceled' },
    credits: 0,
    payload: {},
  });
  return ok({ ok: true });
}

// ─── the test provider (INVITES_BILLING_TEST_MODE only) ──────────────────────────────────────────

const TestSchema = z.strictObject({ id: z.uuid(), outcome: z.enum(['paid', 'failed', 'canceled']) });

/** POST /api/billing/test-complete — the test payment page's buttons. 404 outside test mode. */
export async function testComplete(userId: string, raw: unknown): Promise<ApiResult> {
  if (billingMode() !== 'test') return fail(404, 'not_found');
  const parsed = TestSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const checkout = await checkoutDb.get(parsed.data.id, userId);
  if (!checkout || checkout.provider !== 'test') return fail(404, 'not_found');
  const done = await settle(checkout, parsed.data.outcome, {
    eventId: `test:${checkout.id}`,
    subscriptionId: isPlan(checkout.product) ? `test-sub-${checkout.id}` : null,
    customerId: `test-customer-${userId}`,
    payload: { test: true },
  });
  return ok({ ok: true, settled: done.settled });
}

/** POST /api/billing/test-renew — a monthly renewal of the signed-in user's test subscription. */
export async function testRenew(user: Pick<User, 'id' | 'email'>, raw: unknown): Promise<ApiResult> {
  if (billingMode() !== 'test') return fail(404, 'not_found');
  const parsed = z.strictObject({ paid: z.boolean() }).safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const account = await loadAccount(user);
  if (!account.billingSubscriptionId) return fail(409, 'no_subscription');
  const applied = await applyRenewal(
    'test',
    account.billingSubscriptionId,
    null,
    parsed.data.paid,
    `renew-${Date.now()}`,
    {},
  );
  return ok({ ok: true, applied });
}

// ─── the billing screen ──────────────────────────────────────────────────────────────────────────

export interface BillingPageData {
  account: Omit<AccountView, 'billingSubscriptionId'>;
  prices: Record<PlanId, number>;
  packs: { count: number; product: Product; price: number }[];
  messagePrice: number;
  mode: BillingMode;
  history: Awaited<ReturnType<typeof checkoutDb.history>>;
  /** the purchase the visitor just came back from, if any */
  returned: Checkout | null;
}

/**
 * The billing screen's data. Back from a successful payment whose notice hasn't come (or couldn't be
 * confirmed), PayPlus is asked directly — the screen looks again every few seconds while it waits.
 */
export async function loadBillingPage(
  user: Pick<User, 'id' | 'email'>,
  checkoutId: string | null,
  status: string | null = null,
): Promise<BillingPageData> {
  const env = serverEnv();
  const id = checkoutId && /^[0-9a-f-]{36}$/i.test(checkoutId) ? checkoutId : null;
  let returned = id ? await checkoutDb.get(id, user.id) : null;
  if (
    returned?.status === 'pending' &&
    status === 'success' &&
    returned.provider === 'payplus' &&
    returned.providerRef
  ) {
    const outcome = await reconcileCheckout(returned, null).catch((err) => {
      console.error('[billing] confirming a returned payment', err);
      return 'pending' as const;
    });
    if (outcome !== 'pending') returned = await checkoutDb.get(returned.id, user.id);
  }
  const [account, history] = await Promise.all([loadAccount(user), checkoutDb.history(user.id)]);
  const { billingSubscriptionId: _hidden, ...visible } = account;
  return {
    account: visible,
    prices: planPrices(),
    packs: CREDIT_PACKS.map((count) => ({
      count,
      product: `credits_${count}` as Product,
      price: packPriceIls(count, env.INVITES_WHATSAPP_PRICE_USD, env.INVITES_USD_TO_ILS),
    })),
    messagePrice: messagePriceIls(env.INVITES_WHATSAPP_PRICE_USD, env.INVITES_USD_TO_ILS),
    mode: billingMode(),
    history,
    returned,
  };
}

/**
 * PayPlus purchases still pending after 15 minutes (up to a week back) are asked about again: a
 * notice that was lost, came before PayPlus could confirm it, or never came. Those paid are settled,
 * and support hears about them. Abandoned payment pages simply stay pending.
 */
async function reconcilePending(): Promise<number> {
  const settled: string[] = [];
  for (const checkout of await checkoutDb.pending('payplus', 15, 7)) {
    const outcome = await reconcileCheckout(checkout, null).catch((err) => {
      console.error('[billing] pending checkout', checkout.id, err);
      return 'pending' as const;
    });
    if (outcome === 'paid') settled.push(checkout.id);
  }
  if (settled.length)
    await alertSupport(`${settled.length} payments settled without their PayPlus notice`, {
      checkouts: settled.join(', '),
    });
  return settled.length;
}

/**
 * For the daily job: settles PayPlus purchases whose notice never came (reconcilePending), and tells
 * support about paid plans whose renewal never arrived, to check in the provider's dashboard. Returns
 * how many plans are overdue.
 */
export async function reportOverdue(): Promise<number> {
  if (billingMode() === 'payplus')
    await reconcilePending().catch((err) => console.error('[billing] pending checkouts', err));
  const overdue = await rpc<{ userId: string; email: string; plan: string; renewsAt: string }[]>(
    'billing_overdue',
    { p_days: 3 },
  );
  if (overdue.length)
    await alertSupport(
      `${overdue.length} paid plans without a renewal`,
      Object.fromEntries(overdue.map((o) => [o.email, `${o.plan}, due ${o.renewsAt}`])),
    );
  return overdue.length;
}

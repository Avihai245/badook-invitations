import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * PayPlus (payplus.co.il) — the payment provider: cards, Bit, Apple Pay and Google Pay, with invoices.
 * REST API v1.0; every call carries the API key and secret key. The flow:
 *   1. PaymentPages/generateLink → a hosted payment page (one-time: charge_method 1; a monthly plan:
 *      charge_method 3 with recurring_settings), with our purchase id in `more_info`;
 *   2. PayPlus calls refURL_callback with the transaction (signed: header `hash` = base64
 *      HMAC-SHA256 of the raw body with the secret key) — also for every monthly renewal;
 *   3. we confirm server to server with PaymentPages/ipn before giving anything.
 * docs/billing-setup.md lists what to set up in the PayPlus dashboard.
 */

export function payplusConfigured(): boolean {
  const env = serverEnv();
  return !!(env.INVITES_PAYPLUS_API_KEY && env.INVITES_PAYPLUS_SECRET_KEY && env.INVITES_PAYPLUS_PAGE_UID);
}

function base(): string {
  const env = serverEnv();
  if (env.INVITES_PAYPLUS_API_BASE) return env.INVITES_PAYPLUS_API_BASE.replace(/\/+$/, '');
  return env.INVITES_PAYPLUS_SANDBOX
    ? 'https://restapidev.payplus.co.il/api/v1.0'
    : 'https://restapi.payplus.co.il/api/v1.0';
}

async function call<T>(path: string, body: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  const env = serverEnv();
  const res = await fetchImpl(`${base()}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: JSON.stringify({
        api_key: env.INVITES_PAYPLUS_API_KEY,
        secret_key: env.INVITES_PAYPLUS_SECRET_KEY,
      }),
      'api-key': env.INVITES_PAYPLUS_API_KEY,
      'secret-key': env.INVITES_PAYPLUS_SECRET_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !json) throw new Error(`PayPlus ${path}: HTTP ${res.status}`);
  return json;
}

type Results = { results?: { status?: string; code?: number | string; description?: string } };

export interface PageRequest {
  /** our purchase id (billing_checkouts.id), echoed back in the callback */
  ref: string;
  amount: number;
  /** what the invoice says */
  itemName: string;
  customer: { name: string; email: string; phone?: string | null };
  /** a monthly plan: charged now and every month until canceled */
  recurring: boolean;
  locale: 'he' | 'en';
  urls: { success: string; failure: string; cancel: string; callback: string };
}

/** A hosted payment page for one purchase: its address and PayPlus's id for the request. */
export async function generatePaymentLink(
  r: PageRequest,
  fetchImpl?: typeof fetch,
): Promise<{ url: string; pageRequestUid: string }> {
  const env = serverEnv();
  const body = {
    payment_page_uid: env.INVITES_PAYPLUS_PAGE_UID,
    charge_method: r.recurring ? 3 : 1,
    amount: r.amount,
    currency_code: 'ILS',
    language_code: r.locale,
    more_info: r.ref,
    refURL_success: r.urls.success,
    refURL_failure: r.urls.failure,
    refURL_cancel: r.urls.cancel,
    refURL_callback: r.urls.callback,
    sendEmailApproval: true,
    sendEmailFailure: false,
    create_token: r.recurring,
    customer: {
      customer_name: r.customer.name,
      email: r.customer.email,
      ...(r.customer.phone ? { phone: r.customer.phone } : {}),
    },
    items: [{ name: r.itemName, quantity: 1, price: r.amount }],
    ...(r.recurring
      ? {
          recurring_settings: {
            instant_first_payment: true,
            recurring_type: 2, // monthly
            recurring_range: 1,
            number_of_charges: 0, // until canceled
            start_date_on_payment_date: true,
            jump_payments: 0,
            successful_invoice: true,
            customer_failure_email: true,
            send_customer_success_email: true,
          },
        }
      : {}),
  };
  const json = await call<Results & { data?: { payment_page_link?: string; page_request_uid?: string } }>(
    'PaymentPages/generateLink',
    body,
    fetchImpl,
  );
  const url = json.data?.payment_page_link;
  const pageRequestUid = json.data?.page_request_uid;
  if (json.results?.status !== 'success' || !url || !pageRequestUid)
    throw new Error(`PayPlus generateLink: ${json.results?.description ?? 'no link'}`);
  return { url, pageRequestUid };
}

/** What a transaction (a callback, or the IPN answer) says, wherever PayPlus put each field. */
export interface PayplusTransaction {
  paid: boolean;
  statusCode: string | null;
  transactionUid: string | null;
  pageRequestUid: string | null;
  moreInfo: string | null;
  amount: number | null;
  recurringUid: string | null;
  customerUid: string | null;
  /** a monthly charge of an existing plan (not the first payment) */
  renewal: boolean;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);

export function readTransaction(payload: unknown): PayplusTransaction {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const data = (p.data && typeof p.data === 'object' ? p.data : {}) as Record<string, unknown>;
  const t = (
    p.transaction && typeof p.transaction === 'object'
      ? p.transaction
      : data.transaction && typeof data.transaction === 'object'
        ? data.transaction
        : p
  ) as Record<string, unknown>;
  const recurringInfo = (t.recurring_charge_information ?? p.recurring_charge_information ?? {}) as Record<
    string,
    unknown
  >;
  const statusCode = str(t.status_code ?? p.status_code);
  const recurringUid =
    str(recurringInfo.recurring_uid) ??
    str(t.recurring_uid) ??
    str(data.recurring_uid) ??
    str(p.recurring_uid);
  const chargeNumber = Number(recurringInfo.charge_number ?? t.recurring_number ?? p.recurring_number ?? 1);
  return {
    paid: statusCode === '000',
    statusCode,
    transactionUid: str(t.uid ?? t.transaction_uid ?? p.transaction_uid),
    pageRequestUid: str(t.payment_page_request_uid ?? p.payment_page_request_uid ?? data.page_request_uid),
    moreInfo: str(t.more_info ?? p.more_info),
    amount: Number.isFinite(Number(t.amount ?? p.amount)) ? Number(t.amount ?? p.amount) : null,
    recurringUid,
    customerUid: str(data.customer_uid ?? t.customer_uid ?? p.customer_uid),
    renewal: !!recurringUid && Number.isFinite(chargeNumber) && chargeNumber > 1,
  };
}

/** The callback's signature: header `hash` = base64(HMAC-SHA256(raw body, secret key)). */
export function validCallbackHash(raw: string, header: string | null): boolean {
  const secret = serverEnv().INVITES_PAYPLUS_SECRET_KEY;
  if (!secret || !header) return false;
  const expected = createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
  const a = Buffer.from(header.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Asks PayPlus directly how a payment page request ended (so a forged callback gives nothing). */
export async function confirmPayment(
  pageRequestUid: string,
  fetchImpl?: typeof fetch,
): Promise<PayplusTransaction> {
  const json = await call<Results & { data?: unknown }>(
    'PaymentPages/ipn',
    { payment_request_uid: pageRequestUid, related_transaction: true },
    fetchImpl,
  );
  return readTransaction(json.data ?? json);
}

/** Stops a monthly charge (the plan was canceled or replaced). false when PayPlus refused. */
export async function cancelRecurring(recurringUid: string, fetchImpl?: typeof fetch): Promise<boolean> {
  try {
    const json = await call<Results>(
      `RecurringPayments/${encodeURIComponent(recurringUid)}/Valid`,
      { valid: false },
      fetchImpl,
    );
    return json.results?.status === 'success';
  } catch (err) {
    console.error('[payplus] cancel recurring failed', err);
    return false;
  }
}

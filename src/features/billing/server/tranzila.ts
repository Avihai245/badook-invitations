import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';

/**
 * Tranzila (tranzila.com) — the payment provider, with two terminals:
 *   · the iframe terminal (INVITES_TRANZILA_TERMINAL, badookinvit): Tranzila's own card form, in an
 *     iframe on the billing screen. It checks the card (tranmode NK: J2, nothing is held) and hands back
 *     a token for it (TranzilaTK) — to our notify address, server to server, and to the page the iframe
 *     goes on to. The card number never reaches us;
 *   · the token terminal (INVITES_TRANZILA_TOKEN_TERMINAL, badookinvittok): charges that token through
 *     the API (POST /v1/transaction/credit_card/create) — the first payment right after the iframe, and
 *     each month of a plan.
 * Our server makes every charge itself and reads Tranzila's answer to it, so a forged notice (the
 * notify address is public) can't pay for anything: a token that isn't real is simply declined.
 * docs/billing-setup.md lists what to set up with Tranzila.
 */

/** The API keys, and where they were found. */
export interface TranzilaKeys {
  appKey: string;
  secret: string;
  /** Amplify's environment variables, or the database's Vault (Supabase → Vault → Secrets) */
  source: 'env' | 'vault';
}

/** The Vault secrets' names, in the order they are looked for (the first one set wins). */
export const VAULT_NAMES = {
  appKey: ['INVITES_TRANZILA_APP_KEY', 'TRANZILA_API_APP_KEY'],
  secret: ['INVITES_TRANZILA_SECRET', 'TRANZILA_API_SECRET'],
} as const;

let vaultCache: { keys: TranzilaKeys | null; at: number } | null = null;
/** for tests: forget what the Vault said */
export function resetTranzilaKeys(): void {
  vaultCache = null;
}

async function vaultKeys(): Promise<TranzilaKeys | null> {
  const { data, error } = await serviceDb().rpc('billing_secrets', {
    p_names: [...VAULT_NAMES.appKey, ...VAULT_NAMES.secret],
  });
  if (error) throw new Error(`billing_secrets: ${error.message}`);
  const found = (data ?? {}) as Record<string, string | null>;
  const pick = (names: readonly string[]) =>
    names.map((n) => found[n]?.trim()).find((v): v is string => !!v) ?? null;
  const appKey = pick(VAULT_NAMES.appKey);
  const secret = pick(VAULT_NAMES.secret);
  return appKey && secret ? { appKey, secret, source: 'vault' } : null;
}

/**
 * Tranzila's API keys: from the environment (Amplify) when both are set there, else from the Vault of
 * the database (read once and kept 10 minutes; a miss is asked again after a minute). null: payments
 * through Tranzila are off.
 */
export async function tranzilaKeys(now = Date.now()): Promise<TranzilaKeys | null> {
  const env = serverEnv();
  if (!env.INVITES_TRANZILA_TERMINAL || !env.INVITES_TRANZILA_TOKEN_TERMINAL) return null;
  if (env.INVITES_TRANZILA_APP_KEY && env.INVITES_TRANZILA_SECRET)
    return { appKey: env.INVITES_TRANZILA_APP_KEY, secret: env.INVITES_TRANZILA_SECRET, source: 'env' };
  if (vaultCache && now - vaultCache.at < (vaultCache.keys ? 600_000 : 60_000)) return vaultCache.keys;
  const keys = await vaultKeys().catch((err) => {
    console.error('[tranzila] reading the keys from the Vault', err);
    return null;
  });
  vaultCache = { keys, at: now };
  return keys;
}

export async function tranzilaConfigured(): Promise<boolean> {
  return !!(await tranzilaKeys());
}

/**
 * The API's authentication: the app key, the time (seconds), a random nonce, and
 * HMAC-SHA256(key: secret + time + nonce, message: app key) in hex.
 */
export function authHeaders(
  keys: Pick<TranzilaKeys, 'appKey' | 'secret'>,
  now = Date.now(),
  nonce = randomBytes(40).toString('hex'),
): Record<string, string> {
  const time = String(Math.round(now / 1000));
  const token = createHmac('sha256', keys.secret + time + nonce)
    .update(keys.appKey)
    .digest('hex');
  return {
    'X-tranzila-api-app-key': keys.appKey,
    'X-tranzila-api-request-time': time,
    'X-tranzila-api-nonce': nonce,
    'X-tranzila-api-access-token': token,
  };
}

// ─── the iframe ──────────────────────────────────────────────────────────────────────────────────

export interface IframeRequest {
  /** our purchase id (billing_checkouts.id): Tranzila sends it back with the card's token */
  ref: string;
  amount: number;
  /** what the purchase is (shown on Tranzila's form and its records) */
  itemName: string;
  customer: { name: string; email: string; phone?: string | null };
  locale: 'he' | 'en';
  urls: { success: string; failure: string; notify: string };
}

/** Our purchase id's field on the iframe's address — Tranzila sends extra fields back as they were. */
export const CHECKOUT_FIELD = 'badook_checkout';

/** The address of Tranzila's card form for one purchase (the iframe's src). */
export function iframeUrl(r: IframeRequest): string {
  const env = serverEnv();
  const params = new URLSearchParams({
    sum: r.amount.toFixed(2),
    currency: '1', // shekels
    cred_type: '1', // a regular charge
    tranmode: env.INVITES_TRANZILA_TRANMODE,
    lang: r.locale === 'en' ? 'us' : 'il',
    nologo: '1',
    accessibility: '2',
    pdesc: r.itemName,
    contact: r.customer.name,
    email: r.customer.email,
    ...(r.customer.phone ? { phone: r.customer.phone } : {}),
    success_url_address: r.urls.success,
    fail_url_address: r.urls.failure,
    notify_url_address: r.urls.notify,
    [CHECKOUT_FIELD]: r.ref,
  });
  return `${env.INVITES_TRANZILA_IFRAME_BASE}/${encodeURIComponent(env.INVITES_TRANZILA_TERMINAL)}/iframenew.php?${params}`;
}

/** What Tranzila sent back from the iframe (to the notify address, or to the page the iframe went to). */
export interface TranzilaNotice {
  /** Tranzila's answer: '000' is approved */
  response: string | null;
  ok: boolean;
  checkoutId: string | null;
  token: string | null;
  expMonth: number | null;
  /** four digits */
  expYear: number | null;
  last4: string | null;
  /** the card holder's ID number, when the form asked for it (passed on to the charge, never kept) */
  holderId: string | null;
  /** Tranzila's index of the iframe's transaction */
  index: string | null;
  /** the name and email on the form (we fill them in; the payer may change them) */
  contact: string | null;
  email: string | null;
}

const field = (f: Record<string, string>, ...names: string[]) => {
  for (const n of names) {
    const v = f[n] ?? f[n.toLowerCase()];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

export function readNotice(fields: Record<string, string>): TranzilaNotice {
  const response = field(fields, 'Response');
  const id = field(fields, CHECKOUT_FIELD);
  const token = field(fields, 'TranzilaTK');
  // expmonth / expyear, or expdate (MMYY)
  const expdate = field(fields, 'expdate');
  const month = Number(field(fields, 'expmonth') ?? expdate?.slice(0, 2));
  const yearRaw = Number(field(fields, 'expyear') ?? expdate?.slice(2, 4));
  const expMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
  const expYear =
    Number.isInteger(yearRaw) && yearRaw >= 0
      ? yearRaw < 100
        ? 2000 + yearRaw
        : yearRaw >= 2000 && yearRaw < 2200
          ? yearRaw
          : null
      : null;
  const digits = (field(fields, 'ccno', 'cardnum') ?? '').replace(/\D/g, '');
  const holder = (field(fields, 'myid') ?? '').replace(/\D/g, '');
  return {
    response,
    ok: response === '000',
    checkoutId: id && /^[0-9a-f-]{36}$/i.test(id) ? id : null,
    token: token && /^[A-Za-z0-9_-]{4,100}$/.test(token) ? token : null,
    expMonth,
    expYear,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    holderId: holder.length >= 5 && holder.length <= 9 ? holder : null,
    index: field(fields, 'index'),
    contact: field(fields, 'contact')?.slice(0, 120) ?? null,
    email: field(fields, 'email')?.slice(0, 254) ?? null,
  };
}

/** A card's short fingerprint for our records and claims (the token itself is kept in one place). */
export const cardKey = (token: string) => createHash('sha256').update(token).digest('hex').slice(0, 16);

// ─── charging a token ────────────────────────────────────────────────────────────────────────────

export interface ChargeRequest {
  token: string;
  expMonth: number;
  expYear: number;
  amount: number;
  itemName: string;
  customer?: { name: string; email: string } | null;
  holderId?: string | null;
  /** our reference, in Tranzila's records (a purchase id, a renewal) */
  remarks: string;
}

export type ChargeResult =
  | { status: 'approved'; transactionId: string | null; authNumber: string | null; code: string }
  /** Tranzila answered, and nothing was charged */
  | { status: 'declined'; code: string | null; message: string | null }
  /** no clear answer (a timeout, a server error): it may or may not have been charged */
  | { status: 'unknown'; error: string };

const str = (v: unknown) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);

/** Reads the API's answer to a charge: error_code 0 and processor_response_code 000 is approved. */
export function readChargeResponse(httpStatus: number, json: unknown): ChargeResult {
  if (!json || typeof json !== 'object') return { status: 'unknown', error: `HTTP ${httpStatus}: not JSON` };
  const j = json as Record<string, unknown>;
  const result = (
    j.transaction_result && typeof j.transaction_result === 'object' ? j.transaction_result : {}
  ) as Record<string, unknown>;
  const code = str(result.processor_response_code);
  const errorCode = Number(j.error_code ?? (httpStatus < 300 ? 0 : -1));
  if (errorCode === 0 && code === '000')
    return {
      status: 'approved',
      transactionId: str(result.transaction_id),
      authNumber: str(result.auth_number),
      code,
    };
  if (httpStatus >= 500) return { status: 'unknown', error: `HTTP ${httpStatus}` };
  return { status: 'declined', code: code ?? str(j.error_code), message: str(j.message) };
}

/** Charges a card's token on the token terminal (POST /v1/transaction/credit_card/create). */
export async function chargeToken(c: ChargeRequest, fetchImpl: typeof fetch = fetch): Promise<ChargeResult> {
  const env = serverEnv();
  const keys = await tranzilaKeys();
  if (!keys) return { status: 'unknown', error: 'Tranzila API keys are not set' };
  const amount = Math.round(c.amount * 100) / 100;
  const body = {
    terminal_name: env.INVITES_TRANZILA_TOKEN_TERMINAL,
    txn_type: 'debit',
    txn_currency_code: 'ILS',
    // a Tranzila token goes where the card number would
    card_number: c.token,
    expire_month: c.expMonth,
    expire_year: c.expYear,
    ...(c.holderId ? { card_holder_id: c.holderId } : {}),
    payment_plan: 1,
    items: [{ name: c.itemName, type: 'I', unit_price: amount, units_number: 1 }],
    ...(c.customer?.email || c.customer?.name
      ? { client: { name: c.customer.name, email: c.customer.email } }
      : {}),
    remarks: c.remarks,
    response_language: 'english',
  };
  let res: Response;
  try {
    res = await fetchImpl(`${env.INVITES_TRANZILA_API_BASE}/v1/transaction/credit_card/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...authHeaders(keys) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return { status: 'unknown', error: err instanceof Error ? err.message : String(err) };
  }
  const json = await res.json().catch(() => null);
  return readChargeResponse(res.status, json);
}

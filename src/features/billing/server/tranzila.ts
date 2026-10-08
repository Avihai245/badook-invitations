import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';

/**
 * Tranzila (tranzila.com) — the payment provider, with two terminals:
 *   · the iframe terminal (INVITES_TRANZILA_TERMINAL, badookinvit): Tranzila's own card form, in an
 *     iframe on the billing screen (directng.tranzila.com/<terminal>/iframenew.php). With tranmode VK it
 *     checks the card and holds the purchase's amount on it (J5, nothing taken), and hands back a token
 *     (TranzilaTK) — to our notify address, server to server, and to the page the iframe goes on to. The
 *     card number never reaches us;
 *   · the token terminal (INVITES_TRANZILA_TOKEN_TERMINAL, badookinvittok): charges the token.
 * Every charge goes through the Transactions API (POST /v1/transaction/credit_card/create, signed with
 * the API keys): the first payment takes the form's hold (force, on the iframe terminal — or charges the
 * token when there is none), and each month of a plan charges the token (debit, on the token terminal).
 * Our server makes every charge itself, for the purchase's own amount, and reads Tranzila's answer to
 * it, so a forged notice (the notify address is public) can't pay for anything.
 * docs/billing-setup.md lists what to set up with Tranzila.
 */

/** The API keys, and where they were found. */
export interface TranzilaKeys {
  appKey: string;
  secret: string;
  /** the iframe terminal's TranzilaPW (the handshake only); null when it isn't set */
  terminalPw: string | null;
  /** Amplify's environment variables, or the database's Vault (Supabase → Vault → Secrets) */
  source: 'env' | 'vault';
}

/** The Vault secrets' names, in the order they are looked for (the first one set wins). */
export const VAULT_NAMES = {
  appKey: ['INVITES_TRANZILA_APP_KEY', 'TRANZILA_API_APP_KEY'],
  secret: ['INVITES_TRANZILA_SECRET', 'TRANZILA_API_SECRET'],
  terminalPw: ['INVITES_TRANZILA_PW', 'TRANZILA_TERMINAL_PW'],
} as const;

let vaultCache: { keys: TranzilaKeys | null; at: number } | null = null;
/** for tests: forget what the Vault said */
export function resetTranzilaKeys(): void {
  vaultCache = null;
}

async function vaultKeys(): Promise<TranzilaKeys | null> {
  const { data, error } = await serviceDb().rpc('billing_secrets', {
    p_names: [...VAULT_NAMES.appKey, ...VAULT_NAMES.secret, ...VAULT_NAMES.terminalPw],
  });
  if (error) throw new Error(`billing_secrets: ${error.message}`);
  const found = (data ?? {}) as Record<string, string | null>;
  const pick = (names: readonly string[]) =>
    names.map((n) => found[n]?.trim()).find((v): v is string => !!v) ?? null;
  const appKey = pick(VAULT_NAMES.appKey);
  const secret = pick(VAULT_NAMES.secret);
  return appKey && secret
    ? { appKey, secret, terminalPw: pick(VAULT_NAMES.terminalPw), source: 'vault' }
    : null;
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
    return {
      appKey: env.INVITES_TRANZILA_APP_KEY,
      secret: env.INVITES_TRANZILA_SECRET,
      terminalPw: env.INVITES_TRANZILA_PW || null,
      source: 'env',
    };
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

/**
 * Our purchase's field on the iframe's address: Tranzila sends it back as it was (to the notify and to
 * the return page). The purchase id without its dashes.
 */
export const CHECKOUT_FIELD = 'benid';
const toBenid = (id: string) => id.replace(/-/g, '');
const fromBenid = (b: string | null) =>
  b && /^[0-9a-f]{32}$/i.test(b)
    ? `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`.toLowerCase()
    : null;

/** Shekels → Tranzila's `sum` ("49.00"). */
export const tranzilaSum = (amount: number) => (Math.round(amount * 100) / 100).toFixed(2);

/**
 * The handshake: the amount locked on Tranzila's side before the form opens (thtk), so the payer can't
 * change the sum on the iframe's address. Needs the iframe terminal's TranzilaPW; best effort — null
 * when it isn't set or Tranzila doesn't answer (the server charges the purchase's own amount anyway).
 */
export async function handshake(
  amount: number,
  order: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const env = serverEnv();
  const keys = await tranzilaKeys();
  if (!keys?.terminalPw) return null;
  try {
    const res = await fetchImpl(`${env.INVITES_TRANZILA_CGI_BASE}/cgi-bin/tranzila71dt.cgi`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        supplier: env.INVITES_TRANZILA_TERMINAL,
        TranzilaPW: keys.terminalPw,
        sum: tranzilaSum(amount),
        currency: '1',
        op: '1',
        order: toBenid(order),
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const thtk = new URLSearchParams((await res.text()).trim()).get('thtk');
    return thtk && /^[\w-]{4,200}$/.test(thtk) ? thtk : null;
  } catch (err) {
    console.error('[tranzila] handshake', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * The address of Tranzila's card form for one purchase (the iframe's src), on directng.tranzila.com
 * (Tranzila's current host for the form). tranmode VK: the card is checked and the purchase's amount is
 * held on it (J5, nothing taken yet) — the payer sees what they pay — and a token comes back; our server
 * then takes that hold (payFirst).
 */
export function iframeUrl(r: IframeRequest, thtk: string | null = null): string {
  const env = serverEnv();
  const params = new URLSearchParams({
    sum: tranzilaSum(r.amount),
    currency: '1', // shekels
    cred_type: '1', // a regular charge
    tranmode: env.INVITES_TRANZILA_TRANMODE,
    success_url_address: r.urls.success,
    fail_url_address: r.urls.failure,
    notify_url_address: r.urls.notify,
    [CHECKOUT_FIELD]: toBenid(r.ref),
    lang: r.locale === 'en' ? 'us' : 'il',
    nologo: '1',
    pdesc: r.itemName,
    ...(r.customer.name ? { contact: r.customer.name } : {}),
    ...(r.customer.email ? { email: r.customer.email } : {}),
    ...(r.customer.phone ? { phone: r.customer.phone } : {}),
    ...(thtk ? { thtk } : {}),
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
  /** the form's own transaction (the hold): Tranzila's id, its authorization number and its sum */
  index: string | null;
  confirmationCode: string | null;
  sum: number | null;
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
  const id = fromBenid(field(fields, CHECKOUT_FIELD));
  const token = field(fields, 'TranzilaTK');
  // expmonth / expyear, or expdate (MMYY)
  const expdate = (field(fields, 'expdate') ?? '').replace(/\D/g, '');
  const month = Number(field(fields, 'expmonth') ?? (expdate.length === 4 ? expdate.slice(0, 2) : NaN));
  const yearRaw = Number(field(fields, 'expyear') ?? (expdate.length === 4 ? expdate.slice(2, 4) : NaN));
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
  const index = field(fields, 'index');
  const confirmationCode = field(fields, 'ConfirmationCode');
  const sum = Number(field(fields, 'sum'));
  return {
    response,
    ok: response === '000',
    checkoutId: id,
    token: token && /^[A-Za-z0-9_-]{4,100}$/.test(token) ? token : null,
    expMonth,
    expYear,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    index: index && /^\d{1,15}$/.test(index) ? index : null,
    confirmationCode: confirmationCode && /^\d{1,10}$/.test(confirmationCode) ? confirmationCode : null,
    sum: Number.isFinite(sum) && sum > 0 ? sum : null,
  };
}

/** A card's short fingerprint for our records and claims (the token itself is kept in one place). */
export const cardKey = (token: string) => createHash('sha256').update(token).digest('hex').slice(0, 16);

// ─── the Transactions API (POST /v1/transaction/credit_card/create) ─────────────────────────────

export interface Card {
  token: string;
  expMonth: number;
  expYear: number;
}

export type ChargeResult =
  | { status: 'approved'; transactionId: string | null; authNumber: string | null; code: string }
  /** Tranzila answered, and nothing was taken (a card decline, or a request it refused) */
  | { status: 'declined'; code: string | null; message: string | null }
  /** no clear answer (a timeout, a server error): it may or may not have been charged */
  | { status: 'unknown'; error: string };

const str = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;

/** A processor code as Tranzila writes it on the form: three digits ("000", "004"). */
const processorCode = (v: unknown) => {
  const s = str(v);
  return s && /^\d{1,3}$/.test(s) ? s.padStart(3, '0') : s;
};

/** Tranzila's error when the token in card_number belongs to no card: the card's problem, a decline. */
export const CARD_NOT_FOUND_ERROR = '20401';

/**
 * Reads the API's answer, so a payment is never assumed: approved only on processor code 000; any other
 * processor code, an error code without one, or Tranzila's HTML refusal page (below 500) — nothing was
 * taken; anything else (a 5xx, an answer that can't be read) — unknown, the card may have been charged.
 */
export function readChargeResponse(httpStatus: number, text: string): ChargeResult {
  if (/<html|<body|<!doctype/i.test(text)) {
    if (httpStatus >= 500) return { status: 'unknown', error: `HTTP ${httpStatus}, HTML reply` };
    const visible = text
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { status: 'declined', code: 'REFUSED', message: visible.slice(0, 240) || 'HTML reply' };
  }
  let j: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) j = parsed as Record<string, unknown>;
  } catch {
    j = null;
  }
  if (!j) return { status: 'unknown', error: `HTTP ${httpStatus}, no JSON reply` };
  const result = (
    j.transaction_result && typeof j.transaction_result === 'object' ? j.transaction_result : {}
  ) as Record<string, unknown>;
  const code = processorCode(result.processor_response_code);
  const errorCode = str(j.error_code);
  // a card value Tranzila may quote back is never kept
  const message = str(j.message)
    ?.replace(/(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{12,}/g, '[redacted]')
    .slice(0, 300);
  if (code === '000')
    return {
      status: 'approved',
      transactionId: str(result.transaction_id),
      authNumber: str(result.auth_number),
      code,
    };
  if (code) return { status: 'declined', code, message: message ?? null };
  if (httpStatus < 500 && errorCode && errorCode !== '0')
    return { status: 'declined', code: `API_${errorCode}`, message: message ?? null };
  return {
    status: 'unknown',
    error: `HTTP ${httpStatus}, error_code ${errorCode ?? 'none'}, no processor code`,
  };
}

interface Transaction extends Card {
  terminal: string;
  txnType: 'debit' | 'force' | 'reversal';
  amount: number;
  itemName: string;
  /** force / reversal: the hold they act on — its transaction id and authorization number */
  hold?: { id: string; authNumber: string };
}

async function transaction(t: Transaction, fetchImpl: typeof fetch = fetch): Promise<ChargeResult> {
  const env = serverEnv();
  const keys = await tranzilaKeys();
  if (!keys) return { status: 'declined', code: 'NO_KEYS', message: 'Tranzila API keys are not set' };
  const body = {
    terminal_name: t.terminal,
    txn_type: t.txnType,
    txn_currency_code: 'ILS',
    payment_plan: 1,
    // a Tranzila token goes where the card number would
    card_number: t.token,
    expire_month: t.expMonth,
    expire_year: t.expYear,
    items: [
      {
        name: t.itemName.slice(0, 100),
        type: 'I',
        unit_price: Math.round(t.amount * 100) / 100,
        units_number: 1,
        // gross: charged as is, VAT included
        price_type: 'G',
      },
    ],
    response_language: 'english',
    ...(t.hold ? { reference_txn_id: Number(t.hold.id), authorization_number: t.hold.authNumber } : {}),
  };
  let res: Response;
  try {
    res = await fetchImpl(`${env.INVITES_TRANZILA_API_BASE}/v1/transaction/credit_card/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...authHeaders(keys) },
      body: JSON.stringify(body),
      // a charge waits for the card company
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    return { status: 'unknown', error: err instanceof Error ? err.message : String(err) };
  }
  return readChargeResponse(res.status, await res.text().catch(() => ''));
}

/** Charges a card's token on the token terminal (each month of a plan; a first payment without a hold). */
export function chargeToken(
  c: Card & { amount: number; itemName: string },
  fetchImpl?: typeof fetch,
): Promise<ChargeResult> {
  return transaction(
    { ...c, terminal: serverEnv().INVITES_TRANZILA_TOKEN_TERMINAL, txnType: 'debit' },
    fetchImpl,
  );
}

/**
 * A purchase's first payment, after the form: the form held exactly this amount (VK) on a transaction we
 * can name → that hold is taken (force, on the iframe terminal). Tranzila refusing the capture as a
 * request (an API error: nothing taken) → the token is charged instead, and the hold let go. No hold
 * (tranmode NK / K, or another sum) → the token is charged.
 */
export async function payFirst(
  card: Card,
  notice: Pick<TranzilaNotice, 'index' | 'confirmationCode' | 'sum'>,
  amount: number,
  itemName: string,
  fetchImpl?: typeof fetch,
): Promise<ChargeResult & { via: 'capture' | 'charge' }> {
  const held =
    notice.index &&
    notice.confirmationCode &&
    notice.sum !== null &&
    Math.round(notice.sum * 100) === Math.round(amount * 100)
      ? { id: notice.index, authNumber: notice.confirmationCode }
      : null;
  if (!held) return { ...(await chargeToken({ ...card, amount, itemName }, fetchImpl)), via: 'charge' };
  const terminal = serverEnv().INVITES_TRANZILA_TERMINAL;
  const captured = await transaction(
    { ...card, terminal, txnType: 'force', amount, itemName, hold: held },
    fetchImpl,
  );
  if (captured.status !== 'declined' || !captured.code?.startsWith('API_'))
    return { ...captured, via: 'capture' };
  console.warn('[tranzila] capture refused, charging the card instead', captured.code, captured.message);
  const charged = await chargeToken({ ...card, amount, itemName }, fetchImpl);
  if (charged.status === 'approved') {
    const released = await transaction(
      { ...card, terminal, txnType: 'reversal', amount, itemName, hold: held },
      fetchImpl,
    );
    if (released.status !== 'approved')
      console.warn('[tranzila] hold not released (it lapses by itself)', released);
  }
  return { ...charged, via: 'charge' };
}

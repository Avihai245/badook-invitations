import type { ApiResult } from './api';

/**
 * The partner API's record of calls (partner_api_calls, 90 days): each call's route, the status and
 * code of its answer, the account it names when it names one, and how long it took — the admin
 * console's API health. Never a request's body, an email or a sign-in link.
 */

/** The partner API's routes as the record names them (the route, not the address: no ids). */
export type PartnerEndpoint = '/users' | '/login-links' | '/discounts' | '/venues/{venueId}';

export interface PartnerCall {
  method: string;
  endpoint: PartnerEndpoint;
  status: number;
  /** the answer's code when it wasn't ok (invalid, account_exists, rate_limited…) */
  code: string | null;
  /** the account the answer names (null: none, or not one) */
  userId: string | null;
  durationMs: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[a-z_]{1,60}$/;

/** What the record keeps of one answered call. */
export function callOf(
  method: string,
  endpoint: PartnerEndpoint,
  result: ApiResult,
  durationMs: number,
): PartnerCall {
  const body = result.body;
  const user = body.user as { userId?: unknown } | null | undefined;
  const id = typeof user?.userId === 'string' ? user.userId : body.userId;
  const code = body.ok === false && typeof body.code === 'string' && CODE.test(body.code) ? body.code : null;
  return {
    method: method.toUpperCase(),
    endpoint,
    status: result.status,
    code,
    userId: typeof id === 'string' && UUID.test(id) ? id : null,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}

/**
 * How many calls without the key (401) one server records an hour: anyone can send those, and each is
 * a row — enough to see a key that stopped matching, never a flood.
 */
export class UnauthorizedBudget {
  private stamps: number[] = [];
  constructor(
    private readonly limit = 60,
    private readonly windowMs = 3_600_000,
  ) {}
  /** true: record this one */
  take(now: number): boolean {
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }
}

import 'server-only';
import type { User } from '@supabase/supabase-js';
import { legalStatus } from '@/features/legal/context';
import { CHECKOUT_DOCS, LEGAL_VERSION, SIGNUP_DOCS } from '@/features/legal/versions';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { serviceDb } from '@/lib/supabase/server';

/**
 * Evidence that an account accepted a version of the terms (legal_acceptances): at sign-up and when a
 * paid plan or a credit pack is bought. Only with version 2 of the legal documents in force
 * (legalStatus().active); otherwise nothing is asked and nothing is recorded.
 */

export type AcceptanceSource = 'signup' | 'checkout';

export interface Acceptance {
  doc: 'terms' | 'privacy' | 'refunds' | 'gallery-rules';
  version: string;
  source: AcceptanceSource;
  /** what was bought, for a checkout */
  context: string | null;
  at: string;
}

/**
 * Stores the acceptance, the current version of each document. Tried twice; it never throws: the
 * caller (sign-up, a purchase) goes on either way — the person did accept, and losing the record must
 * not lock them out. false when it could not be stored (logged).
 */
export async function recordAcceptance(
  userId: string,
  source: AcceptanceSource,
  context: string | null = null,
): Promise<boolean> {
  const docs = source === 'signup' ? SIGNUP_DOCS : CHECKOUT_DOCS;
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { error } = await serviceDb().rpc('legal_accept', {
        p_user_id: userId,
        p_docs: [...docs],
        p_version: LEGAL_VERSION,
        p_source: source,
        p_context: context,
      });
      if (!error) return true;
      last = error;
    } catch (err) {
      last = err;
    }
  }
  console.error('[legal] could not record the acceptance', { userId, source, context }, last);
  return false;
}

/** What the account accepted, newest first (the console's account page). */
export async function acceptancesOf(userId: string): Promise<Acceptance[]> {
  const { data, error } = await serviceDb().rpc('legal_acceptances_of', { p_user_id: userId });
  if (error) throw new Error(`legal_acceptances_of: ${error.message}`);
  return (data ?? []) as Acceptance[];
}

/**
 * The checkout API with the acceptance around it. Inactive: `run` as it was, and the request may not
 * carry `accepted`. Active: without `accepted: true` the purchase is refused (400 terms_not_accepted)
 * before anything is opened; with it, `run` gets the body without that field, and once the purchase
 * is opened (the payment page or the card form is on its way) the acceptance is recorded.
 */
export async function withCheckoutAcceptance(
  user: Pick<User, 'id'>,
  raw: unknown,
  run: (body: unknown) => Promise<ApiResult>,
): Promise<ApiResult> {
  if (!legalStatus().active) return run(raw);
  const body: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const { accepted, ...rest } = body;
  if (accepted !== true)
    return {
      status: 400,
      // `error` as the API of the legal pages answers; `code` as the rest of the billing API does
      body: { ok: false, code: 'terms_not_accepted', error: 'terms_not_accepted' },
    };
  const result = await run(rest);
  if (result.status === 200) {
    const product = typeof rest.product === 'string' ? rest.product : null;
    await recordAcceptance(user.id, 'checkout', product);
  }
  return result;
}

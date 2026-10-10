import { nudgeAfter } from '@/features/admin/server/nudge';
import { tranzilaNotice } from '@/features/billing/server/billing';
import { tranzilaConfigured } from '@/features/billing/server/tranzila';
import { requestFields } from '@/features/billing/server/tranzila-fields';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * POST /api/billing/tranzila/notify — Tranzila's server-to-server notice from its card form (the
 * iframe's notify_url_address): the card's token for our purchase, which our server then charges.
 * Handled in features/billing/server/billing.ts (tranzilaNotice).
 */
export async function POST(request: Request) {
  if (!(await tranzilaConfigured())) return new Response('Not found', { status: 404, headers: NO_STORE });
  const fields = await requestFields(request);
  if (!fields) return new Response('Too large', { status: 413, headers: NO_STORE });
  try {
    const { outcome } = await tranzilaNotice(fields);
    if (outcome === 'paid') nudgeAfter('payment');
    return new Response(outcome, { status: outcome === 'unknown_checkout' ? 404 : 200, headers: NO_STORE });
  } catch (err) {
    console.error('[tranzila notify]', err);
    return new Response('Error', { status: 500, headers: NO_STORE });
  }
}

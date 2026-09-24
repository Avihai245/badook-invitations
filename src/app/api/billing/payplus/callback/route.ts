import { payplusCallback } from '@/features/billing/server/billing';
import { payplusConfigured } from '@/features/billing/server/payplus';

/**
 * POST /api/billing/payplus/callback — PayPlus's server-to-server notice of a payment (refURL_callback)
 * and of every monthly renewal. Verified in features/billing/server/billing.ts.
 */
export async function POST(request: Request) {
  if (!payplusConfigured()) return new Response('Not found', { status: 404 });
  const raw = await request.text();
  if (raw.length > 256 * 1024) return new Response('Too large', { status: 413 });
  try {
    const result = await payplusCallback(raw, request.headers.get('hash'));
    return new Response(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    // PayPlus tries again later
    console.error('[payplus callback]', err);
    return new Response('Error', { status: 500 });
  }
}

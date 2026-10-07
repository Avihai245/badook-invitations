import { nudgeAfter } from '@/features/admin/server/nudge';
import { tranzilaNotice, type TranzilaOutcome } from '@/features/billing/server/billing';
import { tranzilaConfigured } from '@/features/billing/server/tranzila';
import { requestFields } from '@/features/billing/server/tranzila-fields';

/**
 * /api/billing/tranzila/return?result=success|failure&checkout=… — where Tranzila's card form goes on
 * to, inside the iframe on the billing screen. What it sent is handled like the notify (the first of the
 * two charges the card), then the whole billing screen (the window above the iframe, our own page) goes
 * to the result: /app/billing?status=…&checkout=…, which waits for the payment while it is pending.
 * No session here: the iframe's request comes from Tranzila's page, without our cookies.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('result') === 'success' ? 'success' : 'failure';
  const fields = tranzilaConfigured() ? await requestFields(request) : null;
  let outcome: TranzilaOutcome | null = null;
  let checkout = /^[0-9a-f-]{36}$/i.test(url.searchParams.get('checkout') ?? '')
    ? url.searchParams.get('checkout')
    : null;
  if (fields)
    try {
      const done = await tranzilaNotice(fields);
      outcome = done.outcome;
      checkout = done.checkoutId ?? checkout;
      if (outcome === 'paid') nudgeAfter('payment');
    } catch (err) {
      // the notify settles it; the billing screen waits for it
      console.error('[tranzila return]', err);
    }
  // paid, or still being charged: the screen says so (and looks again while pending); else failed
  const status =
    outcome === 'paid' || (outcome !== 'failed' && requested === 'success') ? 'success' : 'failure';
  const target = `/app/billing?status=${status}${checkout ? `&checkout=${checkout}` : ''}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>…</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:40px 16px;color:#57534e"><p>…</p><script>(function(){var t=${JSON.stringify(target)};try{window.top.location.replace(t)}catch(e){location.replace(t)}})()</script><noscript><a href="${target}" target="_top">Continue</a></noscript></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}

export const GET = handle;
export const POST = handle;

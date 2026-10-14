import { startCheckout } from '@/features/billing/server/billing';
import { withCheckoutAcceptance } from '@/features/billing/server/legal-acceptance';
import { userRoute } from '@/features/billing/server/route';
import { getUiLocale } from '@/lib/i18n/server';

/**
 * POST /api/billing/checkout — { product } → { url } of the payment page. With version 2 of the legal
 * documents in force the request also carries `accepted: true` (the terms shown before paying) —
 * without it the purchase is refused, and with it the acceptance is recorded.
 */
export async function POST(request: Request) {
  const locale = await getUiLocale();
  return userRoute(
    request,
    (user, body) => withCheckoutAcceptance(user, body, (b) => startCheckout(user, b, locale)),
    { ownerOnly: true },
  );
}

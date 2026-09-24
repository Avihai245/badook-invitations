import { startCheckout } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';
import { getUiLocale } from '@/lib/i18n/server';

/** POST /api/billing/checkout — { product } → { url } of the payment page. */
export async function POST(request: Request) {
  const locale = await getUiLocale();
  return userRoute(request, (user, body) => startCheckout(user, body, locale));
}

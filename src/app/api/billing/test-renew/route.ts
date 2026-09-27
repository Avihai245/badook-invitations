import { nudgeIfOk } from '@/features/admin/server/nudge';
import { testRenew } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';

/** POST /api/billing/test-renew — a monthly renewal of a test subscription (test mode only). */
export async function POST(request: Request) {
  const res = await userRoute(request, (user, body) => testRenew(user, body));
  // the admin console's money and feed
  return nudgeIfOk(res, 'payment');
}

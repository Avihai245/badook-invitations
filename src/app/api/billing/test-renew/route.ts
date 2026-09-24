import { testRenew } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';

/** POST /api/billing/test-renew — a monthly renewal of a test subscription (test mode only). */
export async function POST(request: Request) {
  return userRoute(request, (user, body) => testRenew(user, body));
}

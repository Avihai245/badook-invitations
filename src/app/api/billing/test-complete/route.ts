import { testComplete } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';

/** POST /api/billing/test-complete — the test payment page (INVITES_BILLING_TEST_MODE only). */
export async function POST(request: Request) {
  return userRoute(request, (user, body) => testComplete(user.id, body));
}

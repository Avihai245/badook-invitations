import { after } from 'next/server';
import { adminNudge } from '@/features/admin/server/live';
import { testComplete } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';

/** POST /api/billing/test-complete — the test payment page (INVITES_BILLING_TEST_MODE only). */
export async function POST(request: Request) {
  return userRoute(request, async (user, body) => {
    const result = await testComplete(user.id, body);
    // the admin console's open pages hear of the payment
    if (result.status === 200) after(() => adminNudge('payment'));
    return result;
  });
}

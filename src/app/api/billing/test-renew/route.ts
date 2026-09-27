import { after } from 'next/server';
import { adminNudge } from '@/features/admin/server/live';
import { testRenew } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';

/** POST /api/billing/test-renew — a monthly renewal of a test subscription (test mode only). */
export async function POST(request: Request) {
  return userRoute(request, async (user, body) => {
    const result = await testRenew(user, body);
    // the admin console's open pages hear of the renewal
    if (result.status === 200) after(() => adminNudge('payment'));
    return result;
  });
}

import { after } from 'next/server';
import { adminNudge } from '@/features/admin/server/live';
import { cancelPlan } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';

/** POST /api/billing/cancel — stops the monthly charge; the plan stays until the period ends. */
export async function POST(request: Request) {
  return userRoute(request, async (user) => {
    const result = await cancelPlan(user);
    // the admin console's open pages hear of the cancellation
    if (result.status === 200) after(() => adminNudge('payment'));
    return result;
  });
}

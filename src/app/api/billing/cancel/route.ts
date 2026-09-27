import { nudgeIfOk } from '@/features/admin/server/nudge';
import { cancelPlan } from '@/features/billing/server/billing';
import { userRoute } from '@/features/billing/server/route';

/** POST /api/billing/cancel — stops the monthly charge; the plan stays until the period ends. */
export async function POST(request: Request) {
  const res = await userRoute(request, (user) => cancelPlan(user));
  // the admin console's money
  return nudgeIfOk(res, 'payment');
}

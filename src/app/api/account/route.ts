import { updateProfile } from '@/features/billing/server/account-api';
import { userRoute } from '@/features/billing/server/route';

/** PATCH /api/account — the account's name and phone. */
export async function PATCH(request: Request) {
  return userRoute(request, (user, body) => updateProfile(user.id, body));
}

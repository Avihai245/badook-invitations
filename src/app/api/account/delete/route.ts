import { deleteAccount } from '@/features/billing/server/account-api';
import { userRoute } from '@/features/billing/server/route';
import { sessionDb } from '@/lib/supabase/session';

/** POST /api/account/delete — { confirm: true }: deletes the account and everything it owns. */
export async function POST(request: Request) {
  const response = await userRoute(request, (user, body) => deleteAccount(user, body));
  // the session cookies go too
  if (response.ok) await (await sessionDb()).auth.signOut({ scope: 'local' }).catch(() => undefined);
  return response;
}

import { cookies } from 'next/headers';
import { startActingAs } from '@/features/admin/server/act-as';
import { adminDb } from '@/features/admin/server/db';
import { adminRoute } from '@/features/admin/server/gate';
import { serverEnv } from '@/lib/env';
import { ACT_AS_COOKIE, ACT_AS_SECONDS } from '@/lib/supabase/act-as-token';
import { serviceDb } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/users/:id/act-as { reason } — opens the customer's own app for remote support. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const secure = new URL(request.url).protocol === 'https:';
  return adminRoute(request, 'support.reply', async (staff, body) => {
    const { result, token } = await startActingAs(staff, id, body, {
      async getUser(userId) {
        const { data, error } = await serviceDb().auth.admin.getUserById(userId);
        return error ? null : data.user;
      },
      isStaff: adminDb.isStaff,
      audit: adminDb.auditAdd,
      secret: serverEnv().SUPABASE_SECRET_KEY,
    });
    if (token)
      (await cookies()).set(ACT_AS_COOKIE, token, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: ACT_AS_SECONDS,
      });
    return result;
  });
}

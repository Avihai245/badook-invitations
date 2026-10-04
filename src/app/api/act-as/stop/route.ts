import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminDb } from '@/features/admin/server/db';
import { ACT_AS_COOKIE } from '@/lib/supabase/act-as-token';
import { getActingAs } from '@/lib/supabase/session';

/**
 * POST /api/act-as/stop — back to oneself: the claim is dropped (whatever state it's in), the end
 * recorded, and the staff member returns to the customer's page in the console.
 */
export async function POST(request: Request) {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
    return NextResponse.json({ ok: false, code: 'unsupported_media_type' }, { status: 415 });
  const acting = await getActingAs();
  (await cookies()).delete(ACT_AS_COOKIE);
  if (acting)
    await adminDb
      .auditAdd(acting.staff.id, 'users.act_as_end', 'user', acting.target.id, {})
      .catch((err) => console.error('[admin] act as: end', err));
  return NextResponse.json(
    { ok: true, redirect: acting ? `/app/admin/users/${acting.target.id}` : '/app/invitations' },
    { headers: { 'cache-control': 'no-store' } },
  );
}

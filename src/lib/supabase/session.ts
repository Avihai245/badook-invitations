import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { serverEnv } from '../env';
import { ACT_AS_COOKIE, readActAs } from './act-as-token';
import { isSuspended } from './auth-paths';
import { serviceDb } from './server';

export { safeNext } from './auth-paths';

/**
 * Supabase client bound to the visitor's session cookies (@supabase/ssr) — used for Auth only: who is
 * signed in, sign in/up/out, password reset. Data access goes through the service-role functions with
 * the verified user id (lib/supabase/server.ts, supabase/migrations/*_host_app.sql).
 */
export async function sessionDb(): Promise<SupabaseClient> {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = serverEnv();
  if (!url || !key)
    throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and the publishable key');
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components can't write cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Who actually signed in on this browser, verified with Supabase Auth (not just decoded from the
 * cookie), or null — also for a user whose sign-in the team suspended (their session ends at once, not
 * when it expires). The admin console asks this one: a staff member acting as a customer is still
 * themself there.
 */
export const getRealUser = cache(async (): Promise<User | null> => {
  const db = await sessionDb();
  const { data, error } = await db.auth.getUser();
  return error || isSuspended(data.user) ? null : data.user;
});

export interface ActingAs {
  /** the staff member, signed in as themself */
  staff: User;
  /** the customer whose account they're in */
  target: User;
}

/**
 * A staff member acting as a customer for remote support (started from the console's user page):
 * only with a valid signed claim for this very staff member, while they still have the permission,
 * for a customer who exists and isn't suspended — anything else and they're just themself again.
 */
export const getActingAs = cache(async (): Promise<ActingAs | null> => {
  const raw = (await cookies()).get(ACT_AS_COOKIE)?.value;
  if (!raw) return null;
  const claim = readActAs(serverEnv().SUPABASE_SECRET_KEY, raw);
  if (!claim) return null;
  const staff = await getRealUser();
  if (!staff || staff.id !== claim.staffId || claim.targetId === staff.id) return null;
  // imported here: the console's code imports this module
  const { mayActAs } = await import('@/features/admin/server/act-as');
  if (!(await mayActAs(staff))) return null;
  const { data, error } = await serviceDb().auth.admin.getUserById(claim.targetId);
  if (error || !data.user || isSuspended(data.user)) return null;
  return { staff, target: data.user };
});

/**
 * The user whose account this request works in: the signed-in user — or, for a staff member acting as
 * a customer (getActingAs()), that customer. Every page and API of the host app reads and writes as
 * this user (data goes through the service-role functions with this id).
 */
export const getSessionUser = cache(
  async (): Promise<User | null> => (await getActingAs())?.target ?? (await getRealUser()),
);

/** Pages: the signed-in user, or a redirect to /login that comes back to `next`. */
export async function requireUser(next: string): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

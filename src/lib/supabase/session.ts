import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { serverEnv } from '../env';

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

/** The signed-in user, verified with Supabase Auth (not just decoded from the cookie), or null. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const db = await sessionDb();
  const { data, error } = await db.auth.getUser();
  return error ? null : data.user;
});

/** Pages: the signed-in user, or a redirect to /login that comes back to `next`. */
export async function requireUser(next: string): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

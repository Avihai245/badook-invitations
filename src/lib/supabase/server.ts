import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '../env';

const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

let publicClient: SupabaseClient | undefined;
let serviceClient: SupabaseClient | undefined;

function url(): string {
  const { NEXT_PUBLIC_SUPABASE_URL } = serverEnv();
  if (!NEXT_PUBLIC_SUPABASE_URL) throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL');
  return NEXT_PUBLIC_SUPABASE_URL;
}

/** Publishable key — what an anonymous guest may do: public RPCs such as get_published_invitation. */
export function publicDb(): SupabaseClient {
  if (!publicClient) {
    const key = serverEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!key) throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    publicClient = createClient(url(), key, OPTIONS);
  }
  return publicClient;
}

/**
 * Secret key — bypasses RLS. Server-only writes: submit_rsvp, rsvp_rate_hit, publish/restore.
 * Never import this module from client code ('server-only' enforces it at build time).
 */
export function serviceDb(): SupabaseClient {
  if (!serviceClient) {
    const key = serverEnv().SUPABASE_SECRET_KEY;
    if (!key) throw new Error('Supabase is not configured: set SUPABASE_SECRET_KEY');
    serviceClient = createClient(url(), key, OPTIONS);
  }
  return serviceClient;
}

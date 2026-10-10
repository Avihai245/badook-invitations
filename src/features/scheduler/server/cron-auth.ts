import 'server-only';
import { serverEnv } from '@/lib/env';
import { sameSecret } from '@/lib/secrets';
import { serviceDb } from '@/lib/supabase/server';

/**
 * Who may turn the app's clock (POST /api/cron/*): whoever presents the scheduler's secret — the app's
 * own INVITES_CRON_SECRET, or the one kept in the database's Vault under that name (the secret pg_cron
 * sends: supabase/migrations/*_cron_schedule.sql), read with the service role and kept for a few
 * minutes. Neither set: the endpoints don't exist (null).
 */

const VAULT_TTL_MS = 5 * 60_000;
let vault: { value: string | null; at: number } | null = null;

async function vaultSecret(): Promise<string | null> {
  if (vault && Date.now() - vault.at < VAULT_TTL_MS) return vault.value;
  const { data, error } = await serviceDb().rpc('cron_secret');
  if (error) {
    console.error('[cron] the Vault secret could not be read', error.message);
    return vault?.value ?? null;
  }
  vault = { value: typeof data === 'string' && data.length >= 16 ? data : null, at: Date.now() };
  return vault.value;
}

/** true: the secret matches; false: it doesn't; null: no secret is set up anywhere. */
export async function cronAuthorized(authorization: string | null): Promise<boolean | null> {
  const secrets = [serverEnv().INVITES_CRON_SECRET, await vaultSecret()].filter((s): s is string => !!s);
  if (!secrets.length) return null;
  const given = authorization ?? '';
  return secrets.some((s) => sameSecret(given, `Bearer ${s}`));
}

/** For tests: forget the Vault secret read. */
export function resetCronSecret() {
  vault = null;
}

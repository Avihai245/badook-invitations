import { createClient } from '@supabase/supabase-js';
import { DEMO_OWNER_ID, seedInvitations, seedTemplates, seedVersion } from '../templates/seed-data';

/** Invitations per call (each document is a few kB). */
const BATCH = 10;

/**
 * Keeps the database in step with the code: the template rows and the demo invitations
 * (templates/seed-data.ts). Compares the stored fingerprint with the code's and writes only when they
 * differ — the first start after a deploy that changed the templates. Runs from instrumentation.ts,
 * the daily cron and, as a fallback, when an invitation is created with a template the database
 * doesn't know yet. Reads process.env directly (this module also loads at server start, before the
 * app's server-only helpers can).
 */
/** Read at run time: `next build` inlines a literal process.env.NEXT_PUBLIC_* with the build machine's. */
const runtimeEnv = (name: string): string | undefined => process.env[name] || undefined;

export async function syncSeed(): Promise<'current' | 'written' | 'off'> {
  const url = runtimeEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = runtimeEnv('SUPABASE_SECRET_KEY');
  if (!url || !key) return 'off';
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const templates = seedTemplates();
  const invitations = seedInvitations();
  const version = seedVersion(templates, invitations);
  const { data: stored, error } = await db.rpc('app_meta_get', { p_key: 'seed_version' });
  if (error) throw new Error(`app_meta_get: ${error.message}`);
  if (stored === version) return 'current';

  const write = async (args: { p_templates: unknown; p_invitations: unknown; p_version: string | null }) => {
    const { error: e } = await db.rpc('seed_upsert', { ...args, p_owner: DEMO_OWNER_ID });
    if (e) throw new Error(`seed_upsert: ${e.message}`);
  };
  await write({ p_templates: templates, p_invitations: null, p_version: null });
  for (let i = 0; i < invitations.length; i += BATCH)
    await write({ p_templates: null, p_invitations: invitations.slice(i, i + BATCH), p_version: null });
  // last: the fingerprint says everything above is in
  await write({ p_templates: null, p_invitations: null, p_version: version });
  return 'written';
}

let running: Promise<'current' | 'written' | 'off'> | null = null;

/** One sync at a time per server; errors are logged, never thrown (the app works without it). */
export function syncSeedOnce(reason: string): Promise<'current' | 'written' | 'off' | 'failed'> {
  running ??= syncSeed().finally(() => {
    running = null;
  });
  return running.then(
    (result) => {
      if (result === 'written') console.info(`[seed sync] ${reason}: templates and demos updated`);
      return result;
    },
    (err: unknown) => {
      console.error(`[seed sync] ${reason}: failed`, err);
      return 'failed' as const;
    },
  );
}

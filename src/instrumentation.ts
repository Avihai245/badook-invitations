/**
 * Runs once when a server starts (Next.js instrumentation). Brings the database's templates and demo
 * invitations up to date with this deployment's code (features/invitations/server/seed-sync.ts) —
 * a no-op unless they changed. INVITES_SEED_SYNC=false turns it off.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (['0', 'false', 'off', 'no'].includes((process.env.INVITES_SEED_SYNC ?? '').trim().toLowerCase()))
    return;
  const { syncSeedOnce } = await import('./features/invitations/server/seed-sync');
  // never hold a start for long: past 25 seconds it goes on in the background
  await Promise.race([syncSeedOnce('startup'), new Promise((resolve) => setTimeout(resolve, 25_000))]);
}

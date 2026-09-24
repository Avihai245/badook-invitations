/**
 * Runs once when a server starts (Next.js instrumentation). Brings the database's templates and demo
 * invitations up to date with this deployment's code (features/invitations/server/seed-sync.ts) —
 * a no-op unless they changed. INVITES_SEED_SYNC=false turns it off.
 *
 * The import stays inside `if (NEXT_RUNTIME === 'nodejs')`: the bundler drops that block from the
 * edge build (an early return wouldn't), which can't load the seed's Node modules.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const off = ['0', 'false', 'off', 'no'].includes(
      (process.env.INVITES_SEED_SYNC ?? '').trim().toLowerCase(),
    );
    if (off) return;
    const { syncSeedOnce } = await import('./features/invitations/server/seed-sync');
    // never hold a start for long: past 25 seconds it goes on in the background
    await Promise.race([syncSeedOnce('startup'), new Promise((resolve) => setTimeout(resolve, 25_000))]);
  }
}

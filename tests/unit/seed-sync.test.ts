import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedInvitations, seedVersion } from '@/features/invitations/templates/seed-data';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));

beforeEach(() => {
  rpc.mockReset();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.test');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'secret');
});
afterEach(() => vi.unstubAllEnvs());

describe('keeping the database in step with the templates', () => {
  it('nothing to do when the fingerprint matches', async () => {
    const { syncSeed } = await import('@/features/invitations/server/seed-sync');
    rpc.mockResolvedValueOnce({ data: seedVersion(), error: null });
    expect(await syncSeed()).toBe('current');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('app_meta_get', { p_key: 'seed_version' });
  });

  it('otherwise: the templates, the demos in batches, then the fingerprint — last', async () => {
    const { syncSeed } = await import('@/features/invitations/server/seed-sync');
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await syncSeed()).toBe('written');
    const calls = rpc.mock.calls.filter(([fn]) => fn === 'seed_upsert').map(([, args]) => args);
    const batches = Math.ceil(seedInvitations().length / 10);
    expect(calls).toHaveLength(1 + batches + 1);
    expect(calls[0].p_templates.length).toBeGreaterThanOrEqual(28);
    expect(calls[0].p_invitations).toBeNull();
    expect(calls.slice(1, -1).every((a) => a.p_templates === null && a.p_invitations.length <= 10)).toBe(
      true,
    );
    expect(calls.at(-1)).toMatchObject({ p_templates: null, p_invitations: null, p_version: seedVersion() });
    expect(calls.slice(0, -1).every((a) => a.p_version === null)).toBe(true);
  });

  it('off without the database settings; a failure is logged, never thrown', async () => {
    const { syncSeed, syncSeedOnce } = await import('@/features/invitations/server/seed-sync');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    expect(await syncSeed()).toBe('off');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'secret');
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await syncSeedOnce('test')).toBe('failed');
    expect(log).toHaveBeenCalled();
  });
});

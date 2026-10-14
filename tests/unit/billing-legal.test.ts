import { beforeEach, describe, expect, it, vi } from 'vitest';

// Version 2 of the legal documents, the billing side: the acceptance of the terms is asked at sign-up
// and at checkout, refused when it is missing, and recorded (legal_accept) when it is given. Nothing
// changes while version 2 is not in force.

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const legal = { active: true };
vi.mock('@/features/legal/context', () => ({
  legalStatus: () => ({
    requested: legal.active,
    missing: [],
    active: legal.active,
    effective: '2026-10-20',
  }),
}));

const USER = '11111111-1111-4111-8111-111111111111';

// ─── the database behind serviceDb().rpc ────────────────────────────────────────────────────────

const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: 2 as unknown,
  error: null as { message: string } | null,
}));
vi.mock('@/lib/supabase/server', () => ({
  serviceDb: () => ({ rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args) }),
}));

// ─── the sign-up action's surroundings ───────────────────────────────────────────────────────────

const auth = {
  signUp: vi.fn(async (_c: unknown) => ({
    data: { user: { id: USER, identities: [{ id: 'x' }] } as unknown, session: null as unknown },
    error: null as unknown,
  })),
};
const nudgeAfter = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ delete: vi.fn() }) }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock('@/features/admin/server/db', () => ({ adminDb: {} }));
vi.mock('@/features/admin/server/nudge', () => ({ nudgeAfter: (k: string) => nudgeAfter(k) }));
vi.mock('@/lib/request-url', () => ({ requestBaseUrl: async () => 'https://invitations.example.com' }));
vi.mock('@/lib/supabase/act-as-token', () => ({ ACT_AS_COOKIE: 'act' }));
vi.mock('@/lib/supabase/providers', () => ({ googleSignInEnabled: async () => true }));
vi.mock('@/lib/supabase/session', () => ({
  getActingAs: async () => null,
  safeNext: (v: unknown) => (typeof v === 'string' && v.startsWith('/') ? v : '/app/invitations'),
  sessionDb: async () => ({ auth }),
}));

const acceptCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'legal_accept').map(([, args]) => args);

beforeEach(() => {
  legal.active = true;
  rpc.mockReset();
  rpc.mockResolvedValue({ data: 2, error: null });
  auth.signUp.mockClear();
  nudgeAfter.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function signupForm(over: Record<string, string> = {}) {
  const f = new FormData();
  const fields: Record<string, string> = {
    email: 'dana@example.com',
    password: 'correct horse',
    name: 'Dana',
    next: '/app/invitations',
    accept: 'yes',
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) if (v !== '') f.set(k, v);
  return f;
}

describe('sign-up', () => {
  it('without the box ticked, no account is made (version 2)', async () => {
    const { signUp } = await import('@/app/(site)/(auth)/actions');
    expect(await signUp(null, signupForm({ accept: '' }))).toEqual({
      error: 'terms_required',
      email: 'dana@example.com',
    });
    // a value that is not the box’s own is not an acceptance either
    expect(await signUp(null, signupForm({ accept: 'on' }))).toMatchObject({ error: 'terms_required' });
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(acceptCalls()).toEqual([]);
  });

  it('ticked: the account is made and the acceptance of the terms and the privacy policy is recorded', async () => {
    const { signUp } = await import('@/app/(site)/(auth)/actions');
    expect(await signUp(null, signupForm())).toEqual({ sent: true, email: 'dana@example.com' });
    expect(acceptCalls()).toEqual([
      { p_user_id: USER, p_docs: ['terms', 'privacy'], p_version: '2', p_source: 'signup', p_context: null },
    ]);
  });

  it('signed in right away (no email confirmation): recorded before going on', async () => {
    const { signUp } = await import('@/app/(site)/(auth)/actions');
    auth.signUp.mockResolvedValueOnce({
      data: { user: { id: USER, identities: [{ id: 'x' }] }, session: { access_token: 't' } },
      error: null,
    });
    await expect(signUp(null, signupForm({ next: '/app/billing?plan=pro' }))).rejects.toThrow(
      'NEXT_REDIRECT /app/billing?plan=pro',
    );
    expect(acceptCalls()).toHaveLength(1);
  });

  it('a failed record is tried once more, then logged — the visitor is not blocked', async () => {
    const { signUp } = await import('@/app/(site)/(auth)/actions');
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    expect(await signUp(null, signupForm())).toEqual({ sent: true, email: 'dana@example.com' });
    expect(acceptCalls()).toHaveLength(2);
    expect(console.error).toHaveBeenCalled();
    // a throw is the same
    rpc.mockClear();
    rpc.mockRejectedValue(new Error('network'));
    expect(await signUp(null, signupForm())).toEqual({ sent: true, email: 'dana@example.com' });
    expect(acceptCalls()).toHaveLength(2);
    // and the second try can succeed
    rpc.mockReset();
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'blip' } })
      .mockResolvedValue({ data: 2, error: null });
    await signUp(null, signupForm());
    expect(acceptCalls()).toHaveLength(2);
  });

  it('an address that already has an account (Supabase answers with no identities): nothing is recorded', async () => {
    const { signUp } = await import('@/app/(site)/(auth)/actions');
    auth.signUp.mockResolvedValueOnce({
      data: { user: { id: USER, identities: [] }, session: null },
      error: null,
    });
    expect(await signUp(null, signupForm())).toMatchObject({ sent: true });
    expect(acceptCalls()).toEqual([]);
  });

  it('a refused sign-up records nothing', async () => {
    const { signUp } = await import('@/app/(site)/(auth)/actions');
    auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'email_exists' },
    });
    expect(await signUp(null, signupForm())).toMatchObject({ error: 'user_already_exists' });
    expect(acceptCalls()).toEqual([]);
  });

  it('not in force: as before — the box is not asked for and nothing is recorded', async () => {
    legal.active = false;
    const { signUp } = await import('@/app/(site)/(auth)/actions');
    expect(await signUp(null, signupForm({ accept: '' }))).toEqual({ sent: true, email: 'dana@example.com' });
    expect(auth.signUp).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('checkout', () => {
  const run = vi.fn(async (_body: unknown) => ({ status: 200, body: { ok: true, url: 'https://pay.test' } }));
  beforeEach(() => run.mockClear());
  const gate = async (raw: unknown) => {
    const { withCheckoutAcceptance } = await import('@/features/billing/server/legal-acceptance');
    return withCheckoutAcceptance({ id: USER }, raw, run);
  };

  it('refuses a purchase that comes without the acceptance, before anything is opened', async () => {
    for (const raw of [
      { product: 'pro' },
      { product: 'pro', accepted: false },
      { product: 'pro', accepted: 'true' },
      null,
      [],
    ]) {
      expect(await gate(raw)).toEqual({
        status: 400,
        body: { ok: false, code: 'terms_not_accepted', error: 'terms_not_accepted' },
      });
    }
    expect(run).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('with the acceptance: the purchase goes on without that field, and the three documents are recorded', async () => {
    expect(await gate({ product: 'pro', accepted: true })).toMatchObject({ status: 200 });
    expect(run).toHaveBeenCalledWith({ product: 'pro' });
    expect(acceptCalls()).toEqual([
      {
        p_user_id: USER,
        p_docs: ['terms', 'privacy', 'refunds'],
        p_version: '2',
        p_source: 'checkout',
        p_context: 'pro',
      },
    ]);
    // a pack names the pack
    rpc.mockClear();
    await gate({ product: 'credits_300', accepted: true });
    expect(acceptCalls()[0]).toMatchObject({
      p_context: 'credits_300',
      p_docs: ['terms', 'privacy', 'refunds'],
    });
  });

  it('a purchase that was not opened (already on the plan, not configured, invalid) records nothing', async () => {
    for (const status of [400, 409, 503]) {
      run.mockResolvedValueOnce({ status, body: { ok: false } } as never);
      expect((await gate({ product: 'pro', accepted: true })).status).toBe(status);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a record that cannot be stored does not stop the payment', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    expect(await gate({ product: 'pro', accepted: true })).toMatchObject({ status: 200 });
    expect(acceptCalls()).toHaveLength(2);
  });

  it('not in force: the request goes through untouched and nothing is recorded', async () => {
    legal.active = false;
    expect(await gate({ product: 'pro' })).toMatchObject({ status: 200 });
    expect(run).toHaveBeenCalledWith({ product: 'pro' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('the record of what an account accepted', () => {
  it('acceptancesOf asks legal_acceptances_of', async () => {
    const { acceptancesOf } = await import('@/features/billing/server/legal-acceptance');
    const rows = [
      { doc: 'terms', version: '2', source: 'signup', context: null, at: '2026-10-20T10:00:00Z' },
    ];
    rpc.mockResolvedValueOnce({ data: rows, error: null });
    expect(await acceptancesOf(USER)).toEqual(rows);
    expect(rpc).toHaveBeenCalledWith('legal_acceptances_of', { p_user_id: USER });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(acceptancesOf(USER)).rejects.toThrow('legal_acceptances_of: boom');
  });
});

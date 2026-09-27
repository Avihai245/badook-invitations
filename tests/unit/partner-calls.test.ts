import { beforeEach, describe, expect, it, vi } from 'vitest';

// The partner API's record of calls (features/partner/http.ts): every call with the API on is recorded
// after its answer — the route, the status and code, the account it names, how long it took — and
// calls without the right key only a limited number an hour; with the API off nothing is.

vi.mock('server-only', () => ({}));
const KEY = 'unit-partner-key-0123456789abcdef0123';
const env = { INVITES_PARTNER_API_KEY: KEY };
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/request-url', () => ({ requestBaseUrl: async () => 'https://invitations.example.com' }));
const logPartnerCall = vi.fn(async (_call: unknown) => {});
vi.mock('@/features/partner/server', () => ({
  partnerDeps: () => ({ site: 'https://invitations.example.com' }),
  logPartnerCall: (call: unknown) => logPartnerCall(call),
}));
// the work after the answer runs at once here
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (task: () => unknown) => void task(),
}));

const { partnerRoute } = await import('@/features/partner/http');

const request = (authorization?: string, method = 'POST') =>
  new Request('https://invitations.example.com/api/partner/v1/users', {
    method,
    headers: authorization ? { authorization } : {},
  });

beforeEach(() => {
  logPartnerCall.mockClear();
  env.INVITES_PARTNER_API_KEY = KEY;
});

describe('the record of the partner API’s calls', () => {
  it('records each answered call: the route, the status, the account, the time', async () => {
    const res = await partnerRoute(request(`Bearer ${KEY}`), '/users', async () => ({
      status: 201,
      body: { ok: true, created: true, user: { userId: '00000000-0000-4000-8000-000000000042' } },
    }));
    expect(res.status).toBe(201);
    expect(logPartnerCall).toHaveBeenCalledWith({
      method: 'POST',
      endpoint: '/users',
      status: 201,
      code: null,
      userId: '00000000-0000-4000-8000-000000000042',
      durationMs: expect.any(Number),
    });
    await partnerRoute(request(`Bearer ${KEY}`, 'PATCH'), '/users', async () => ({
      status: 409,
      body: { ok: false, code: 'email_taken' },
    }));
    expect(logPartnerCall).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: 'PATCH', status: 409, code: 'email_taken', userId: null }),
    );
  });

  it('a handler that throws: 500 to the partner, recorded as server_error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await partnerRoute(request(`Bearer ${KEY}`), '/login-links', async () => {
      throw new Error('database down');
    });
    log.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, code: 'server_error' });
    expect(logPartnerCall).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/login-links', status: 500, code: 'server_error' }),
    );
  });

  it('a wrong key is recorded (a limited number an hour); with the API off nothing is', async () => {
    const res = await partnerRoute(request('Bearer wrong'), '/users', async () => {
      throw new Error('never');
    });
    expect(res.status).toBe(401);
    expect(logPartnerCall).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/users', status: 401, code: 'unauthorized' }),
    );
    // past the hour's budget: answered, not recorded
    for (let i = 0; i < 80; i++)
      await partnerRoute(request(), '/users', async () => ({ status: 200, body: {} }));
    expect(logPartnerCall.mock.calls.length).toBeLessThanOrEqual(60);
    logPartnerCall.mockClear();
    env.INVITES_PARTNER_API_KEY = '';
    expect(
      (await partnerRoute(request(`Bearer ${KEY}`), '/users', async () => ({ status: 200, body: {} })))
        .status,
    ).toBe(404);
    expect(logPartnerCall).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/billing/checkout with version 2 of the legal documents: the route refuses a request without
// `accepted: true` (400 terms_not_accepted), and passes the product on, and records, when it is there.

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const legal = { active: true };
vi.mock('@/features/legal/context', () => ({ legalStatus: () => ({ active: legal.active }) }));
vi.mock('@/lib/i18n/server', () => ({ getUiLocale: async () => 'he' }));
const startCheckout = vi.fn(async (_u: unknown, _b: unknown, _l: unknown) => ({
  status: 200,
  body: { ok: true, url: 'https://pay.test' },
}));
vi.mock('@/features/billing/server/billing', () => ({
  startCheckout: (u: unknown, b: unknown, l: unknown) => startCheckout(u, b, l),
}));
// the signed-in JSON route, minus the session
vi.mock('@/features/billing/server/route', () => ({
  userRoute: async (
    request: Request,
    handler: (u: { id: string }, b: unknown) => Promise<{ status: number; body: unknown }>,
  ) => {
    const r = await handler({ id: 'u1' }, await request.json());
    return Response.json(r.body, { status: r.status });
  },
}));
const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: 3, error: null }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));

const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/billing/checkout/route');
  const res = await POST(
    new Request('https://x.test/api/billing/checkout', { method: 'POST', body: JSON.stringify(body) }),
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  legal.active = true;
  startCheckout.mockClear();
  rpc.mockClear();
});

describe('POST /api/billing/checkout', () => {
  it('without `accepted`: 400 terms_not_accepted, nothing opened', async () => {
    expect(await post({ product: 'pro' })).toEqual({
      status: 400,
      body: { ok: false, code: 'terms_not_accepted', error: 'terms_not_accepted' },
    });
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it('with it: the checkout gets the product only, and the acceptance is recorded', async () => {
    expect((await post({ product: 'credits_100', accepted: true })).status).toBe(200);
    expect(startCheckout).toHaveBeenCalledWith({ id: 'u1' }, { product: 'credits_100' }, 'he');
    expect(rpc).toHaveBeenCalledWith(
      'legal_accept',
      expect.objectContaining({ p_source: 'checkout', p_context: 'credits_100' }),
    );
  });

  it('not in force: unchanged', async () => {
    legal.active = false;
    expect((await post({ product: 'pro' })).status).toBe(200);
    expect(startCheckout).toHaveBeenCalledWith({ id: 'u1' }, { product: 'pro' }, 'he');
    expect(rpc).not.toHaveBeenCalled();
  });
});

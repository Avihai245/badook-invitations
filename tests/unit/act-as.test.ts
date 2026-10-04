import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const STAFF = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const SECRET = 'unit-secret';

describe('acting as a customer: the signed claim', () => {
  it('reads back only what it signed, for an hour, and nothing forged or altered', async () => {
    const { readActAs, signActAs, ACT_AS_SECONDS } = await import('@/lib/supabase/act-as-token');
    const now = Date.UTC(2026, 9, 4, 12);
    const token = signActAs(SECRET, STAFF, CUSTOMER, now);
    expect(readActAs(SECRET, token, now)).toEqual({
      staffId: STAFF,
      targetId: CUSTOMER,
      exp: now / 1000 + ACT_AS_SECONDS,
    });
    // expired
    expect(readActAs(SECRET, token, now + ACT_AS_SECONDS * 1000)).toBeNull();
    // another secret (another deployment)
    expect(readActAs('other-secret', token, now)).toBeNull();
    // another customer, or a longer life, with the same signature
    const [, , exp, sig] = token.split('.');
    const other = '33333333-3333-4333-8333-333333333333';
    expect(readActAs(SECRET, `${STAFF}.${other}.${exp}.${sig}`, now)).toBeNull();
    expect(readActAs(SECRET, `${STAFF}.${CUSTOMER}.${Number(exp) + 9999}.${sig}`, now)).toBeNull();
    // malformed
    for (const bad of [undefined, '', 'x', `${token}.extra`, `not-a-uuid.${CUSTOMER}.${exp}.${sig}`])
      expect(readActAs(SECRET, bad, now)).toBeNull();
    // no secret configured: never valid, and never signed
    expect(readActAs('', token, now)).toBeNull();
    expect(() => signActAs('', STAFF, CUSTOMER, now)).toThrow();
  });
});

describe('acting as a customer: starting', () => {
  const customer = { id: CUSTOMER, email: 'dana@example.com' } as User;
  const deps = (over: Partial<Record<string, unknown>> = {}) => ({
    getUser: vi.fn(async (id: string) => (id === CUSTOMER ? customer : null)),
    isStaff: vi.fn(async () => false),
    audit: vi.fn(async () => 1),
    secret: SECRET,
    now: Date.UTC(2026, 9, 4, 12),
    ...over,
  });

  it('records the reason first, then hands out the claim for that customer', async () => {
    const { startActingAs } = await import('@/features/admin/server/act-as');
    const { readActAs } = await import('@/lib/supabase/act-as-token');
    const d = deps();
    const { result, token } = await startActingAs({ userId: STAFF }, CUSTOMER, { reason: 'עזרה בסידור' }, d);
    expect(result).toEqual({ status: 200, body: { ok: true, redirect: '/app/invitations' } });
    expect(d.audit).toHaveBeenCalledWith(STAFF, 'users.act_as', 'user', CUSTOMER, { reason: 'עזרה בסידור' });
    expect(readActAs(SECRET, token!, d.now)?.targetId).toBe(CUSTOMER);
  });

  it('never oneself, another staff member, a suspended or unknown account, or without a reason', async () => {
    const { startActingAs } = await import('@/features/admin/server/act-as');
    const reason = { reason: 'עזרה' };
    const code = async (id: string, body: unknown, d = deps()) => {
      const { result, token } = await startActingAs({ userId: STAFF }, id, body, d);
      expect(token).toBeNull();
      expect(d.audit).not.toHaveBeenCalled();
      return (result.body as { code: string }).code;
    };
    expect(await code(STAFF, reason)).toBe('self');
    expect(await code(CUSTOMER, reason, deps({ isStaff: vi.fn(async () => true) }))).toBe('staff');
    expect(
      await code(
        CUSTOMER,
        reason,
        deps({ getUser: vi.fn(async () => ({ ...customer, banned_until: '2999-01-01T00:00:00Z' })) }),
      ),
    ).toBe('suspended');
    expect(await code('33333333-3333-4333-8333-333333333333', reason)).toBe('not_found');
    expect(await code('not-a-uuid', reason)).toBe('not_found');
    expect(await code(CUSTOMER, { reason: '' })).toBe('invalid');
    expect(await code(CUSTOMER, { reason: 'ok', extra: 1 })).toBe('invalid');
  });
});

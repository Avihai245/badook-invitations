import { describe, expect, it, vi } from 'vitest';
import {
  createLoginLink,
  ExternalIdTaken,
  lookupUser,
  partnerAuthorized,
  provisionUser,
  type PartnerDeps,
  type PartnerUser,
} from '@/features/partner/api';

/** An in-memory partner world: users by email, which of them are the partner's, and their accounts. */
function world() {
  const users = new Map<string, { id: string; email: string }>([
    ['self@example.com', { id: '00000000-0000-4000-8000-000000000001', email: 'self@example.com' }],
  ]);
  const accounts = new Map<string, PartnerUser & { externalId: string | null; mine: boolean }>();
  let n = 1;
  const deps: PartnerDeps = {
    site: 'https://invitations.example.com',
    findUserByEmail: async (email) => users.get(email)?.id ?? null,
    createUser: vi.fn(async ({ email }) => {
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      users.set(email, { id, email });
      return id;
    }),
    link: vi.fn(async (userId, { externalId, fullName, phone }, claim) => {
      const email = [...users.values()].find((u) => u.id === userId)!.email;
      const current = accounts.get(userId);
      if (!(current?.mine || claim)) return null;
      if (
        externalId &&
        [...accounts.values()].some((a) => a.externalId === externalId && a.userId !== userId)
      )
        throw new ExternalIdTaken();
      const next = {
        userId,
        email,
        fullName,
        phone: phone ?? current?.phone ?? null,
        plan: 'free',
        activeInvitations: 0,
        createdAt: '2026-09-24T00:00:00Z',
        externalId: externalId ?? current?.externalId ?? null,
        mine: true,
      };
      accounts.set(userId, next);
      return next;
    }),
    find: async ({ userId, externalId }) =>
      [...accounts.values()].find(
        (a) => a.mine && (a.userId === userId || (!!externalId && a.externalId === externalId)),
      ) ?? null,
    loginToken: vi.fn(async (email) => `hash-of-${email}`),
    rateHit: vi.fn(async () => true),
  };
  return { deps, users, accounts };
}

describe('the partner API', () => {
  it('checks the key in constant time, and is off without one', () => {
    expect(partnerAuthorized('Bearer s3cret-key', 's3cret-key')).toBe(true);
    expect(partnerAuthorized('Bearer wrong', 's3cret-key')).toBe(false);
    expect(partnerAuthorized('s3cret-key', 's3cret-key')).toBe(false);
    expect(partnerAuthorized(null, 's3cret-key')).toBe(false);
    expect(partnerAuthorized('Bearer ', '')).toBe(false);
  });

  it('opens a user with name, email and phone, and returns a one-time sign-in link', async () => {
    const { deps } = world();
    const res = await provisionUser(
      {
        email: ' Dana@Example.com ',
        fullName: ' דנה לוי ',
        phone: '050-123-4567',
        externalId: 'be-1',
        next: '/app/billing',
      },
      deps,
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ok: true,
      created: true,
      user: { email: 'dana@example.com', fullName: 'דנה לוי', phone: '+972501234567', plan: 'free' },
      loginUrlExpiresIn: 3600,
    });
    expect(deps.createUser).toHaveBeenCalledWith({
      email: 'dana@example.com',
      fullName: 'דנה לוי',
      phone: '+972501234567',
    });
    const url = new URL(String(res.body.loginUrl));
    expect(url.origin + url.pathname).toBe('https://invitations.example.com/auth/callback');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      token_hash: 'hash-of-dana@example.com',
      type: 'magiclink',
      next: '/app/billing',
    });
  });

  it('the same user again: updated, not duplicated; someone else’s account: refused', async () => {
    const { deps } = world();
    const first = await provisionUser(
      { email: 'dana@example.com', fullName: 'Dana', externalId: 'be-1' },
      deps,
    );
    const again = await provisionUser({ email: 'dana@example.com', fullName: 'Dana Levi' }, deps);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({
      created: false,
      user: { userId: (first.body.user as PartnerUser).userId, fullName: 'Dana Levi' },
    });
    expect(deps.createUser).toHaveBeenCalledTimes(1);
    // signed up by themselves: the partner can't take it over (or get a link into it)
    expect(await provisionUser({ email: 'self@example.com', fullName: 'X' }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'account_exists' },
    });
    expect(deps.loginToken).not.toHaveBeenCalledWith('self@example.com');
    // the partner's id is one user's
    expect(
      await provisionUser({ email: 'other@example.com', fullName: 'Y', externalId: 'be-1' }, deps),
    ).toEqual({
      status: 409,
      body: { ok: false, code: 'external_id_taken' },
    });
  });

  it('refuses what it can’t use, and a partner over its limit', async () => {
    const { deps } = world();
    expect(await provisionUser({ email: 'not-an-email', fullName: '' }, deps)).toEqual({
      status: 400,
      body: { ok: false, code: 'invalid', fields: ['email', 'fullName'] },
    });
    expect(await provisionUser({ email: 'a@example.com', fullName: 'A', phone: '12' }, deps)).toEqual({
      status: 400,
      body: { ok: false, code: 'invalid', fields: ['phone'] },
    });
    expect((await provisionUser({ email: 'a@example.com', fullName: 'A', role: 'admin' }, deps)).status).toBe(
      400,
    );
    // a landing page elsewhere is never used
    const res = await provisionUser({ email: 'b@example.com', fullName: 'B', next: '//evil.example' }, deps);
    expect(new URL(String(res.body.loginUrl)).searchParams.get('next')).toBe('/app/invitations');
    vi.mocked(deps.rateHit).mockResolvedValueOnce(false);
    expect(await provisionUser({ email: 'c@example.com', fullName: 'C' }, deps)).toEqual({
      status: 429,
      body: { ok: false, code: 'rate_limited' },
    });
  });

  it('sign-in links and lookups only for the partner’s own users', async () => {
    const { deps } = world();
    const made = await provisionUser(
      { email: 'dana@example.com', fullName: 'Dana', externalId: 'be-9' },
      deps,
    );
    const userId = (made.body.user as PartnerUser).userId;
    const link = await createLoginLink({ externalId: 'be-9', next: '/app/invitations/new' }, deps);
    expect(link.status).toBe(200);
    expect(link.body).toMatchObject({ userId });
    expect(new URL(String(link.body.loginUrl)).searchParams.get('next')).toBe('/app/invitations/new');
    expect((await createLoginLink({ userId }, deps)).status).toBe(200);
    expect(await createLoginLink({ userId: '00000000-0000-4000-8000-000000000001' }, deps)).toEqual({
      status: 404,
      body: { ok: false, code: 'not_found' },
    });
    expect((await createLoginLink({}, deps)).status).toBe(400);
    expect((await createLoginLink({ userId, externalId: 'be-9' }, deps)).status).toBe(400);

    const q = (s: string) => lookupUser(new URLSearchParams(s), deps);
    expect((await q('externalId=be-9')).body).toMatchObject({
      ok: true,
      user: { userId, email: 'dana@example.com' },
    });
    expect((await q('email=DANA@example.com')).body).toMatchObject({ user: { userId } });
    expect((await q(`userId=${userId}`)).status).toBe(200);
    expect((await q('email=self@example.com')).status).toBe(404);
    expect((await q('email=nobody@example.com')).status).toBe(404);
    expect((await q('')).status).toBe(400);
    expect((await q('userId=x')).status).toBe(400);
  });
});

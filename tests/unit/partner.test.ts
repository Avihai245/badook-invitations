import { describe, expect, it, vi } from 'vitest';
import {
  changeEmail,
  createLoginLink,
  ExternalIdTaken,
  lookupUser,
  partnerAuthorized,
  partnerKeyUsable,
  provisionUser,
  type PartnerDeps,
  type PartnerUser,
} from '@/features/partner/api';

type AuthUser = { id: string; email: string; tagged: boolean; managed: boolean };

/**
 * An in-memory partner world: Auth users by email (tagged: created by the partner; managed: they set a
 * password or connected Google), and the accounts linked to the partner — the same rules as
 * account_link_partner / partner_account.
 */
function world() {
  const users = new Map<string, AuthUser>([
    [
      'self@example.com',
      { id: '00000000-0000-4000-8000-000000000001', email: 'self@example.com', tagged: false, managed: true },
    ],
  ]);
  const accounts = new Map<
    string,
    Omit<PartnerUser, 'email' | 'userManaged'> & { externalId: string | null }
  >();
  const byId = (id: string) => [...users.values()].find((u) => u.id === id);
  const partnerView = (userId: string): PartnerUser | null => {
    const a = accounts.get(userId);
    const u = byId(userId);
    if (!a || !u) return null;
    const { externalId: _externalId, ...rest } = a;
    return { ...rest, email: u.email, userManaged: u.managed };
  };
  let n = 1;
  /** the next createUser finds the email already taken (its owner signed up at that moment) */
  let raceOwner: string | null = null;
  const deps: PartnerDeps = {
    site: 'https://invitations.example.com',
    findUserByEmail: async (email) => users.get(email)?.id ?? null,
    createUser: vi.fn(async ({ email }) => {
      if (raceOwner === email) {
        raceOwner = null;
        const id = `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`;
        users.set(email, { id, email, tagged: false, managed: true });
        return { id, created: false };
      }
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      users.set(email, { id, email, tagged: true, managed: false });
      return { id, created: true };
    }),
    deleteUser: vi.fn(async (userId) => {
      const u = byId(userId);
      if (u) users.delete(u.email);
      accounts.delete(userId);
    }),
    link: vi.fn(async (userId, { externalId, fullName, phone }) => {
      const u = byId(userId)!;
      const current = accounts.get(userId);
      if (!current && !(u.tagged && !u.managed)) return null;
      if (
        externalId &&
        [...accounts.values()].some((a) => a.externalId === externalId && a.userId !== userId)
      )
        throw new ExternalIdTaken();
      accounts.set(userId, {
        userId,
        fullName,
        phone: phone ?? current?.phone ?? null,
        plan: 'free',
        activeInvitations: 0,
        createdAt: '2026-09-24T00:00:00Z',
        externalId: externalId ?? current?.externalId ?? null,
      });
      return partnerView(userId);
    }),
    find: async ({ userId, externalId }) => {
      const a = [...accounts.values()].find(
        (x) => x.userId === userId || (!!externalId && x.externalId === externalId),
      );
      return a ? partnerView(a.userId) : null;
    },
    updateEmail: vi.fn(async (userId, email) => {
      if (users.has(email)) return false;
      const u = byId(userId)!;
      users.delete(u.email);
      users.set(email, { ...u, email });
      return true;
    }),
    loginToken: vi.fn(async (email) => `hash-of-${email}`),
    rateHit: vi.fn(async () => true),
  };
  return {
    deps,
    users,
    accounts,
    race: (email: string) => (raceOwner = email),
    manage: (email: string) => (users.get(email)!.managed = true),
  };
}

const userOf = (res: { body: Record<string, unknown> }) => res.body.user as PartnerUser;

describe('the partner API', () => {
  it('checks the key in constant time, is off without one, and wants a long one', () => {
    expect(partnerAuthorized('Bearer s3cret-key', 's3cret-key')).toBe(true);
    expect(partnerAuthorized('Bearer wrong', 's3cret-key')).toBe(false);
    expect(partnerAuthorized('s3cret-key', 's3cret-key')).toBe(false);
    expect(partnerAuthorized(null, 's3cret-key')).toBe(false);
    expect(partnerAuthorized('Bearer ', '')).toBe(false);
    expect(partnerKeyUsable('short-key')).toBe(false);
    expect(partnerKeyUsable('x'.repeat(31))).toBe(false);
    expect(partnerKeyUsable('0123456789abcdef'.repeat(4))).toBe(true);
  });

  it('opens a user with name, email and phone, and returns a one-time sign-in link to a Continue page', async () => {
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
      user: {
        email: 'dana@example.com',
        fullName: 'דנה לוי',
        phone: '+972501234567',
        plan: 'free',
        userManaged: false,
      },
      loginUrlExpiresIn: 3600,
    });
    expect(deps.createUser).toHaveBeenCalledWith({
      email: 'dana@example.com',
      fullName: 'דנה לוי',
      phone: '+972501234567',
    });
    // opening the link uses nothing: the token is used on the page's button (mail scanners, previews)
    const url = new URL(String(res.body.loginUrl));
    expect(url.origin + url.pathname).toBe('https://invitations.example.com/auth/continue');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      token_hash: 'hash-of-dana@example.com',
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
      user: { userId: userOf(first).userId, fullName: 'Dana Levi' },
    });
    expect(deps.createUser).toHaveBeenCalledTimes(1);
    // signed up by themselves: the partner can't take it over (or get a link into it)
    expect(await provisionUser({ email: 'self@example.com', fullName: 'X' }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'account_exists' },
    });
    expect(deps.loginToken).not.toHaveBeenCalledWith('self@example.com');
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });

  it('an owner signing up at the same moment keeps their account (no takeover through the race)', async () => {
    const { deps, race } = world();
    // not there when looked up; there when the partner tries to create it
    race('race@example.com');
    expect(await provisionUser({ email: 'race@example.com', fullName: 'R' }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'account_exists' },
    });
    expect(deps.loginToken).not.toHaveBeenCalled();
    // not the partner's to delete either
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });

  it('a user it can’t link is deleted again, so a retry works (no orphan)', async () => {
    const { deps, users } = world();
    await provisionUser({ email: 'dana@example.com', fullName: 'Dana', externalId: 'be-1' }, deps);
    // the partner's id is another user's
    expect(
      await provisionUser({ email: 'other@example.com', fullName: 'Y', externalId: 'be-1' }, deps),
    ).toEqual({ status: 409, body: { ok: false, code: 'external_id_taken' } });
    expect(users.has('other@example.com')).toBe(false);
    const retry = await provisionUser(
      { email: 'other@example.com', fullName: 'Y', externalId: 'be-2' },
      deps,
    );
    expect(retry.status).toBe(201);
    // a user the partner created earlier but never linked (a crash in between) is claimed
    users.set('orphan@example.com', {
      id: '00000000-0000-4000-8000-000000000099',
      email: 'orphan@example.com',
      tagged: true,
      managed: false,
    });
    const orphan = await provisionUser({ email: 'orphan@example.com', fullName: 'O' }, deps);
    expect(orphan).toMatchObject({
      status: 200,
      body: { created: false, user: { email: 'orphan@example.com' } },
    });
  });

  it('no more sign-in links once the user signs in by themselves (password, Google)', async () => {
    const { deps, manage } = world();
    const made = await provisionUser(
      { email: 'dana@example.com', fullName: 'Dana', externalId: 'be-5' },
      deps,
    );
    manage('dana@example.com');
    vi.mocked(deps.loginToken).mockClear();
    const link = await createLoginLink({ externalId: 'be-5', next: '/app/billing' }, deps);
    expect(link).toEqual({
      status: 409,
      body: {
        ok: false,
        code: 'user_managed',
        signInUrl: 'https://invitations.example.com/login?next=%2Fapp%2Fbilling',
      },
    });
    expect(await provisionUser({ email: 'dana@example.com', fullName: 'Dana L.' }, deps)).toMatchObject({
      status: 409,
      body: { code: 'user_managed' },
    });
    expect(deps.loginToken).not.toHaveBeenCalled();
    // still theirs to look up
    expect((await lookupUser(new URLSearchParams('externalId=be-5'), deps)).body).toMatchObject({
      user: { userId: userOf(made).userId, userManaged: true, fullName: 'Dana' },
    });
  });

  it('a new email for the partner’s own user (not one who manages their own sign-in)', async () => {
    const { deps, manage } = world();
    const made = await provisionUser(
      { email: 'dana@example.com', fullName: 'Dana', externalId: 'be-7' },
      deps,
    );
    const userId = userOf(made).userId;
    expect(await changeEmail({ externalId: 'be-7', email: ' Dana.Levi@Example.com' }, deps)).toMatchObject({
      status: 200,
      body: { ok: true, user: { userId, email: 'dana.levi@example.com' } },
    });
    expect((await createLoginLink({ userId }, deps)).body.loginUrl).toContain('hash-of-dana.levi');
    // the same email again: nothing to do
    expect((await changeEmail({ userId, email: 'dana.levi@example.com' }, deps)).status).toBe(200);
    expect(await changeEmail({ userId, email: 'self@example.com' }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'email_taken' },
    });
    expect(
      (await changeEmail({ userId: '00000000-0000-4000-8000-000000000001', email: 'x@example.com' }, deps))
        .status,
    ).toBe(404);
    expect((await changeEmail({ userId, externalId: 'be-7', email: 'x@example.com' }, deps)).status).toBe(
      400,
    );
    expect((await changeEmail({ userId, email: 'not-an-email' }, deps)).status).toBe(400);
    manage('dana.levi@example.com');
    expect(await changeEmail({ userId, email: 'dana2@example.com' }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'user_managed' },
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
    vi.mocked(deps.rateHit).mockResolvedValueOnce(false);
    expect((await changeEmail({ externalId: 'x', email: 'c@example.com' }, deps)).status).toBe(429);
  });

  it('sign-in links and lookups only for the partner’s own users', async () => {
    const { deps } = world();
    const made = await provisionUser(
      { email: 'dana@example.com', fullName: 'Dana', externalId: 'be-9' },
      deps,
    );
    const userId = userOf(made).userId;
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

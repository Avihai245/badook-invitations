import { describe, expect, it, vi } from 'vitest';
import type { ActivityItem } from '@/features/admin/activity';
import {
  addCredits,
  CREDIT_CAPS,
  giftPlan,
  grantFeature,
  removeStaff,
  renameChannel,
  setDiscount,
  setStaff,
  suspendUser,
  type ActionDeps,
  type ActionStaff,
} from '@/features/admin/server/actions';
import { adminFeed, mergeActivity, type FeedSources } from '@/features/admin/server/activity/feed';
import type { Staff } from '@/features/admin/server/gate';
import { permissionsOf, type StaffRole } from '@/features/admin/permissions';

vi.mock('server-only', () => ({}));

// The admin console's actions (features/admin/server/actions.ts) and its live feed's merge
// (server/activity/feed.ts), over fake dependencies: the database's own rules are in
// tests/db/admin-core.test.ts.

const USER = '11111111-2222-4333-8444-555555555555';
const INVITATION = '66666666-7777-4888-8999-000000000000';

const staffOf = (role: StaffRole, userId = 'aaaaaaaa-0000-4000-8000-000000000001'): ActionStaff => ({
  userId,
  email: `${role}@example.com`,
  role,
});

/** Records every call, in order. */
function fakeDeps(overrides: Partial<ActionDeps> = {}) {
  const calls: string[] = [];
  const nudges: string[] = [];
  const deps: ActionDeps = {
    credits: vi.fn(async (_a, _u, delta) => (calls.push(`credits ${delta}`), { balance: 40 + delta })),
    gift: vi.fn(async (_a, _u, plan, lastDay) => (calls.push(`gift ${plan} ${lastDay}`), { plan })),
    discount: vi.fn(
      async (_a, _u, percent, lastDay, note) => (
        calls.push(`discount ${percent} ${lastDay} ${note}`),
        percent ? { percent } : null
      ),
    ),
    suspendCheck: vi.fn(
      async (_a, _u, suspend) => (
        calls.push(`check ${suspend}`),
        { email: 'x@example.com', suspended: !suspend }
      ),
    ),
    ban: vi.fn(async (_u, suspend) => void calls.push(`ban ${suspend}`)),
    audit: vi.fn(async (_a, action) => (calls.push(`audit ${action}`), 1)),
    feature: vi.fn(
      async (_a, _i, feature, grant) => (calls.push(`feature ${feature} ${grant}`), { grant: [feature] }),
    ),
    staffSet: vi.fn(
      async (_a, email, role) => (
        calls.push(`staff set ${email} ${role}`),
        {
          email,
          role,
          source: 'console',
          note: null,
          createdAt: '',
          updatedAt: '',
          addedBy: null,
          account: null,
        } as const
      ),
    ),
    staffRemove: vi.fn(
      async (_a, email) => (calls.push(`staff remove ${email}`), email !== 'gone@example.com'),
    ),
    renameChannel: vi.fn(async () => void calls.push('rename')),
    nudge: (kind) => void nudges.push(kind),
    ...overrides,
  };
  return { deps, calls, nudges };
}

describe('credits', () => {
  it('adds or removes within the role’s cap, with a reason; the pages hear of it', async () => {
    const { deps, calls, nudges } = fakeDeps();
    const res = await addCredits(staffOf('support'), USER, { delta: 50, reason: '  compensation  ' }, deps);
    expect(res).toEqual({ status: 200, body: { ok: true, balance: 90 } });
    expect(deps.credits).toHaveBeenCalledWith(expect.any(String), USER, 50, 'compensation');
    expect(calls).toEqual(['credits 50']);
    expect(nudges).toEqual(['credits']);
    expect(
      (await addCredits(staffOf('support'), USER, { delta: -100, reason: 'a mistake' }, deps)).status,
    ).toBe(200);
  });

  it('refuses what the role may not, before the database', async () => {
    const { deps, calls, nudges } = fakeDeps();
    expect(await addCredits(staffOf('support'), USER, { delta: 101, reason: 'too many' }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'over_cap', cap: 100 },
    });
    expect(
      (await addCredits(staffOf('finance'), USER, { delta: -1001, reason: 'too many' }, deps)).status,
    ).toBe(409);
    expect(
      (await addCredits(staffOf('admin'), USER, { delta: 100000, reason: 'the most' }, deps)).status,
    ).toBe(200);
    expect(calls).toEqual(['credits 100000']);
    expect(nudges).toEqual(['credits']);
    expect(CREDIT_CAPS).toMatchObject({ support: 100, finance: 1000, admin: 100000, owner: 100000 });
  });

  it('checks what it gets', async () => {
    const { deps, calls } = fakeDeps();
    for (const body of [
      { delta: 0, reason: 'nothing' },
      { delta: 2.5, reason: 'half' },
      { delta: 5, reason: 'no' },
      { delta: 5, reason: 'x'.repeat(201) },
      { delta: '5', reason: 'a string' },
      { delta: 5, reason: 'extra', more: 1 },
      null,
    ])
      expect((await addCredits(staffOf('owner'), USER, body, deps)).status, JSON.stringify(body)).toBe(400);
    expect(
      (await addCredits(staffOf('owner'), 'not-a-user', { delta: 5, reason: 'fine' }, deps)).status,
    ).toBe(404);
    expect(calls).toEqual([]);
  });

  it('a rule of the database goes up to the route (409 with its reason)', async () => {
    const rule = Object.assign(new Error('admin_user_credits: below_zero'), { reason: 'below_zero' });
    const { deps, nudges } = fakeDeps({ credits: vi.fn().mockRejectedValue(rule) });
    await expect(addCredits(staffOf('owner'), USER, { delta: -5, reason: 'too many' }, deps)).rejects.toBe(
      rule,
    );
    expect(nudges).toEqual([]);
  });
});

describe('a plan as a gift', () => {
  it('gives a plan through a day, or takes a gift back', async () => {
    const { deps, calls, nudges } = fakeDeps();
    expect(
      (
        await giftPlan(
          staffOf('admin'),
          USER,
          { plan: 'business', lastDay: '2026-12-31', reason: 'charity event' },
          deps,
        )
      ).status,
    ).toBe(200);
    expect((await giftPlan(staffOf('admin'), USER, { plan: null, reason: 'taken back' }, deps)).status).toBe(
      200,
    );
    expect(calls).toEqual(['gift business 2026-12-31', 'gift null null']);
    expect(nudges).toEqual(['user', 'user']);
    for (const body of [
      { plan: 'pro', reason: 'no day' },
      { plan: 'enterprise', lastDay: '2026-12-31', reason: 'no such plan' },
      { plan: 'pro', lastDay: '31/12/2026', reason: 'a bad day' },
      { plan: 'pro', lastDay: '2026-12-31' },
    ])
      expect((await giftPlan(staffOf('admin'), USER, body, deps)).status, JSON.stringify(body)).toBe(400);
  });
});

describe('a discount', () => {
  it('sets a percent (1–90) through a day or with no end, with a note; or removes it', async () => {
    const { deps, calls } = fakeDeps();
    const body = { percent: 20, lastDay: null, note: '  spring  ', reason: 'marketing campaign' };
    expect((await setDiscount(staffOf('owner'), USER, body, deps)).body).toEqual({
      ok: true,
      discount: { percent: 20 },
    });
    await setDiscount(staffOf('owner'), USER, { ...body, note: '', lastDay: '2027-01-31' }, deps);
    await setDiscount(staffOf('owner'), USER, { percent: null, reason: 'campaign over' }, deps);
    expect(calls).toEqual([
      'discount 20 null spring',
      'discount 20 2027-01-31 null',
      'discount null null null',
    ]);
    for (const bad of [
      { ...body, percent: 0 },
      { ...body, percent: 91 },
      { ...body, note: 'x'.repeat(201) },
      { percent: 10, reason: 'no day or note' },
    ])
      expect((await setDiscount(staffOf('owner'), USER, bad, deps)).status, JSON.stringify(bad)).toBe(400);
  });
});

describe('suspending sign-in', () => {
  it('checks, bans, records — in that order — and tells the pages', async () => {
    const { deps, calls, nudges } = fakeDeps();
    expect(await suspendUser(staffOf('admin'), USER, { suspend: true, reason: 'fraud' }, deps)).toEqual({
      status: 200,
      body: { ok: true, suspended: true },
    });
    expect(calls).toEqual(['check true', 'ban true', 'audit users.suspend']);
    expect(deps.audit).toHaveBeenCalledWith(expect.any(String), 'users.suspend', 'user', USER, {
      reason: 'fraud',
    });
    expect(nudges).toEqual(['user']);
    await suspendUser(staffOf('admin'), USER, { suspend: false, reason: 'appealed' }, deps);
    expect(calls.slice(3)).toEqual(['check false', 'ban false', 'audit users.restore']);
  });

  it('never oneself; a refusal of the database stops it before Auth', async () => {
    const me = staffOf('owner', USER);
    const { deps, calls } = fakeDeps();
    expect(await suspendUser(me, USER, { suspend: true, reason: 'myself' }, deps)).toEqual({
      status: 409,
      body: { ok: false, code: 'self' },
    });
    const rank = Object.assign(new Error('staff_rank'), { reason: 'staff_rank' });
    const refused = fakeDeps({ suspendCheck: vi.fn().mockRejectedValue(rank) });
    await expect(
      suspendUser(staffOf('admin'), USER, { suspend: true, reason: 'an admin' }, refused.deps),
    ).rejects.toBe(rank);
    expect(refused.calls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('what can’t be recorded doesn’t happen: the ban is taken back', async () => {
    const down = new Error('database down');
    const { deps, calls, nudges } = fakeDeps({
      audit: vi.fn().mockRejectedValue(down),
    });
    await expect(suspendUser(staffOf('admin'), USER, { suspend: true, reason: 'fraud' }, deps)).rejects.toBe(
      down,
    );
    expect(calls).toEqual(['check true', 'ban true', 'ban false']);
    expect(nudges).toEqual([]);
  });
});

describe('features', () => {
  it('grants or takes back a known feature, with a reason', async () => {
    const { deps, calls, nudges } = fakeDeps();
    expect(
      (
        await grantFeature(
          staffOf('admin'),
          INVITATION,
          { feature: 'face_albums', grant: true, reason: 'VIP' },
          deps,
        )
      ).body,
    ).toEqual({ ok: true, overrides: { grant: ['face_albums'] } });
    expect(calls).toEqual(['feature face_albums true']);
    expect(nudges).toEqual(['invitation']);
    expect(
      (
        await grantFeature(
          staffOf('admin'),
          INVITATION,
          { feature: 'teleport', grant: true, reason: 'nope' },
          deps,
        )
      ).status,
    ).toBe(400);
    expect(
      (await grantFeature(staffOf('admin'), 'x', { feature: 'voice', grant: true, reason: 'nope' }, deps))
        .status,
    ).toBe(404);
  });
});

describe('the staff', () => {
  it('adds or changes only the roles the member may manage', async () => {
    const { deps, calls, nudges } = fakeDeps();
    expect(
      (
        await setStaff(
          staffOf('admin'),
          { email: ' New@Example.com ', role: 'support', note: 'tickets' },
          deps,
        )
      ).status,
    ).toBe(200);
    expect(calls).toEqual(['staff set new@example.com support']);
    expect(nudges).toEqual(['staff']);
    // an admin never gives the owner's role; no one changes their own
    expect(await setStaff(staffOf('admin'), { email: 'o@example.com', role: 'owner' }, deps)).toEqual({
      status: 403,
      body: { ok: false, code: 'forbidden' },
    });
    expect(
      (await setStaff(staffOf('owner'), { email: 'owner@example.com', role: 'viewer' }, deps)).body,
    ).toEqual({
      ok: false,
      code: 'self',
    });
    expect((await setStaff(staffOf('owner'), { email: 'not an email', role: 'viewer' }, deps)).status).toBe(
      400,
    );
    expect((await setStaff(staffOf('owner'), { email: 'a@example.com', role: 'god' }, deps)).status).toBe(
      400,
    );
    expect(calls).toHaveLength(1);
  });

  it('removes a member; not found when there is none', async () => {
    const { deps, nudges } = fakeDeps();
    expect((await removeStaff(staffOf('owner'), { email: 'x@example.com' }, deps)).status).toBe(200);
    expect((await removeStaff(staffOf('owner'), { email: 'gone@example.com' }, deps)).status).toBe(404);
    expect((await removeStaff(staffOf('owner'), { email: 'owner@example.com' }, deps)).body).toEqual({
      ok: false,
      code: 'self',
    });
    expect(nudges).toEqual(['staff']);
  });
});

describe('the live channel', () => {
  it('only owners rename it', async () => {
    const { deps, calls, nudges } = fakeDeps();
    expect((await renameChannel(staffOf('admin'), deps)).status).toBe(403);
    expect((await renameChannel(staffOf('owner'), deps)).status).toBe(200);
    expect(calls).toEqual(['rename']);
    expect(nudges).toEqual(['system']);
  });
});

const item = (
  id: string,
  kind: ActivityItem['kind'],
  at: string,
  userId: string | null = null,
): ActivityItem => ({
  id,
  kind,
  at,
  actor: null,
  subject: null,
  amount: null,
  userId,
  invitationId: null,
  ticketId: null,
});

describe('the live feed', () => {
  it('merges the areas newest first; an account Badook Events opened shows once', () => {
    const core = [
      item('signup:u1', 'signup', '2026-09-27T10:00:00Z', 'u1'),
      item('signup:u2', 'signup', '2026-09-27T09:00:00Z', 'u2'),
      item('rsvp:1', 'rsvp', '2026-09-27T11:00:00Z'),
    ];
    const partner = [item('partner:u2', 'partner_provision', '2026-09-27T09:00:01Z', 'u2')];
    const support = [
      item('ticket:1', 'ticket_opened', '2026-09-27T12:00:00Z'),
      item('rsvp:1', 'rsvp', '2026-09-27T11:00:00Z'),
    ];
    expect(mergeActivity([core, support, partner], 10).map((i) => i.id)).toEqual([
      'ticket:1',
      'rsvp:1',
      'signup:u1',
      'partner:u2',
    ]);
    expect(mergeActivity([core, support, partner], 2).map((i) => i.id)).toEqual(['ticket:1', 'rsvp:1']);
  });

  it('asks each area only for the roles that may see it; an area that fails is left out', async () => {
    const staff = (role: StaffRole): Staff => ({
      userId: 'aaaaaaaa-0000-4000-8000-000000000001',
      email: `${role}@example.com`,
      role,
      permissions: permissionsOf(role),
    });
    const from: FeedSources = {
      core: vi.fn(async () => [item('rsvp:1', 'rsvp', '2026-09-27T11:00:00Z')]),
      support: vi.fn(async () => [item('ticket:1', 'ticket_opened', '2026-09-27T12:00:00Z')]),
      partner: vi.fn(async () => {
        throw new Error('partner area down');
      }),
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await adminFeed(staff('support'), 30, from)).map((i) => i.id)).toEqual(['ticket:1', 'rsvp:1']);
    expect((await adminFeed(staff('finance'), 30, from)).map((i) => i.id)).toEqual(['rsvp:1']);
    expect(from.support).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

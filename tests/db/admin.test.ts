import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS, STAFF_ROLES, can } from '@/features/admin/permissions';
import { as, createTestDatabase } from './harness';

// The admin console's staff, roles and record of actions (supabase/migrations/*_admin_console.sql).

const OWNER = '77777777-7777-4777-8777-777777777701';
const ENV_OWNER = '77777777-7777-4777-8777-777777777702';
const SUPPORT = '77777777-7777-4777-8777-777777777703';
const ADMIN = '77777777-7777-4777-8777-777777777704';
const PARTNER_MADE = '77777777-7777-4777-8777-777777777705';
const UNCONFIRMED = '77777777-7777-4777-8777-777777777706';
const HOST = '77777777-7777-4777-8777-777777777707';
const BANNED = '77777777-7777-4777-8777-777777777708';

let db: { url: string; drop: () => Promise<void> };
let c: Client;

/** As the server (the service role), rolled back. */
async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}
/** As the server, kept. */
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const reason = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: { message?: string }) => e.message ?? 'error',
  );

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  const partner = { provider: 'email', providers: ['email'], provisioned_by: 'partner:badook-events' };
  await c.query(
    `insert into auth.users (id, email, raw_app_meta_data, email_confirmed_at, banned_until) values
       ($1, 'owner@example.com', '{}', now(), null),
       ($2, 'env-owner@example.com', '{}', now(), null),
       ($3, 'support@example.com', '{}', now(), null),
       ($4, 'admin@example.com', '{}', now(), null),
       ($5, 'made@example.com', $9, now(), null),
       ($6, 'unconfirmed@example.com', '{}', null, null),
       ($7, 'host@example.com', '{}', now(), null),
       ($8, 'banned@example.com', '{}', now(), now() + interval '1 day')`,
    [OWNER, ENV_OWNER, SUPPORT, ADMIN, PARTNER_MADE, UNCONFIRMED, HOST, BANNED, partner],
  );
  // the first owner, as an owner adds them in production (the console can't add the first one)
  await c.query(`insert into public.admin_staff (email, role) values ('owner@example.com', 'owner')`);
  await commit('admin_staff_set', [OWNER, 'support@example.com', 'support', 'answers tickets']);
  await commit('admin_staff_set', [OWNER, 'admin@example.com', 'admin', null]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('who is staff', () => {
  it('the platform’s owners (INVITES_ADMIN_EMAILS) are owners; a name off the list leaves the staff', async () => {
    expect(await call('admin_whoami', [ENV_OWNER, ['  Env-Owner@Example.com ']])).toEqual({
      role: 'owner',
      email: 'env-owner@example.com',
    });
    await commit('admin_whoami', [OWNER, ['env-owner@example.com']]);
    expect(await call('admin_whoami', [ENV_OWNER, []])).toBeNull();
    // (and back, for the tests below)
    await commit('admin_whoami', [OWNER, ['env-owner@example.com']]);
    expect(await call('admin_whoami', [ENV_OWNER, ['env-owner@example.com']])).toMatchObject({
      role: 'owner',
    });
  });

  it('a staff email on an account Badook Events opened, unconfirmed or banned is not staff', async () => {
    for (const email of ['made@example.com', 'unconfirmed@example.com', 'banned@example.com'])
      await commit('admin_staff_set', [OWNER, email, 'viewer', null]);
    for (const id of [PARTNER_MADE, UNCONFIRMED, BANNED])
      expect(await call('admin_whoami', [id, ['env-owner@example.com']])).toBeNull();
    // the partner API refuses these emails
    expect(await call('admin_email_reserved', [' MADE@example.com'])).toBe(true);
    expect(await call('admin_email_reserved', ['host@example.com'])).toBe(false);
    for (const email of ['made@example.com', 'unconfirmed@example.com', 'banned@example.com'])
      await commit('admin_staff_remove', [OWNER, email]);
    expect(await call('admin_email_reserved', ['made@example.com'])).toBe(false);
  });

  it('a user who isn’t staff can do nothing', async () => {
    expect(await call('admin_whoami', [HOST, ['env-owner@example.com']])).toBeNull();
    for (const [fn, args] of [
      ['admin_staff_list', [HOST]],
      ['admin_staff_set', [HOST, 'host@example.com', 'owner', null]],
      ['admin_audit_list', [HOST, 10, null, null, null]],
      ['admin_channel', [HOST, 'a'.repeat(24)]],
      ['admin_audit_add', [HOST, 'users.note', 'user', HOST, {}]],
    ] as const)
      expect(await reason(call(fn, [...args])), fn).toContain('forbidden');
  });
});

describe('the roles', () => {
  it('match features/admin/permissions.ts, permission by permission', async () => {
    for (const role of STAFF_ROLES)
      for (const perm of PERMISSIONS) {
        const r = await c.query('select public.admin_can($1, $2) as ok', [role, perm]);
        expect(r.rows[0].ok, `${role} ${perm}`).toBe(can(role, perm));
      }
    expect((await c.query(`select public.admin_can('nobody', 'dashboard.view') as ok`)).rows[0].ok).toBe(
      false,
    );
  });

  it('support sees the staff’s work but may not manage the staff', async () => {
    expect(await reason(call('admin_staff_list', [SUPPORT]))).toContain('forbidden');
    expect(await reason(call('admin_staff_set', [SUPPORT, 'x@example.com', 'viewer', null]))).toContain(
      'forbidden',
    );
  });

  it('an admin manages every role but owners', async () => {
    expect(await call('admin_staff_set', [ADMIN, 'new@example.com', 'finance', null])).toMatchObject({
      email: 'new@example.com',
      role: 'finance',
      source: 'console',
      addedBy: 'admin@example.com',
      account: null,
    });
    expect(await reason(call('admin_staff_set', [ADMIN, 'new@example.com', 'owner', null]))).toContain(
      'forbidden',
    );
    expect(await reason(call('admin_staff_remove', [ADMIN, 'owner@example.com']))).toContain('forbidden');
  });

  it('no one changes their own role or the platform’s owners; owners manage owners', async () => {
    expect(await reason(call('admin_staff_set', [ADMIN, 'admin@example.com', 'viewer', null]))).toContain(
      'self',
    );
    expect(await reason(call('admin_staff_remove', [OWNER, 'owner@example.com']))).toContain('self');
    expect(await reason(call('admin_staff_set', [OWNER, 'env-owner@example.com', 'viewer', null]))).toContain(
      'managed_by_env',
    );
    expect(await reason(call('admin_staff_remove', [OWNER, 'env-owner@example.com']))).toContain(
      'managed_by_env',
    );
    // an owner adds and removes another owner (one who hasn't signed up yet)
    expect(await commit('admin_staff_set', [OWNER, 'second@example.com', 'owner', null])).toMatchObject({
      role: 'owner',
      account: null,
    });
    expect(await commit('admin_staff_remove', [OWNER, 'second@example.com'])).toBe(true);
  });

  it('a removed member added again gets the new role and adder', async () => {
    await commit('admin_staff_set', [OWNER, 'again@example.com', 'viewer', 'temp']);
    await commit('admin_staff_remove', [OWNER, 'again@example.com']);
    const back = await call<{ role: string; addedBy: string; note: string | null }>('admin_staff_set', [
      ADMIN,
      'again@example.com',
      'support',
      null,
    ]);
    expect(back).toMatchObject({ role: 'support', addedBy: 'admin@example.com', note: null });
  });
});

describe('the record of actions', () => {
  it('records each change, newest first, with who did it and what it was before', async () => {
    await commit('admin_staff_set', [OWNER, 'log@example.com', 'viewer', null]);
    await commit('admin_staff_set', [OWNER, 'log@example.com', 'finance', 'moved']);
    const rows = await call<{ action: string; actorEmail: string; targetId: string; details: object }[]>(
      'admin_audit_list',
      [OWNER, 10, null, 'staff', 'log@example.com'],
    );
    expect(rows.map((r) => [r.action, r.actorEmail, r.targetId, r.details])).toEqual([
      [
        'staff.set',
        'owner@example.com',
        'log@example.com',
        { role: 'finance', before: 'viewer', note: 'moved' },
      ],
      ['staff.set', 'owner@example.com', 'log@example.com', { role: 'viewer', before: null, note: null }],
    ]);
    const id = await call<number>('admin_audit_add', [SUPPORT, 'users.suspend', 'user', HOST, { days: 1 }]);
    expect(Number(id)).toBeGreaterThan(0);
    expect(await reason(call('admin_audit_add', [SUPPORT, 'Bad Action', 'user', HOST, {}]))).not.toBe('ok');
  });

  it('keeps two years', async () => {
    await c.query(
      `insert into public.admin_audit (actor_email, action, created_at) values ('old@example.com', 'staff.set', now() - interval '731 days')`,
    );
    expect(await call('admin_maintenance', [])).toEqual({ audit: 1 });
  });
});

describe('the live channel', () => {
  it('is made once, from the first candidate; an owner renames it', async () => {
    expect(await call('admin_channel_peek', [])).toBeNull();
    const first = await commit<string>('admin_channel', [SUPPORT, 'firstCandidate_1234']);
    expect(first).toBe('firstCandidate_1234');
    expect(await call('admin_channel', [ADMIN, 'secondCandidate_1234'])).toBe('firstCandidate_1234');
    expect(await call('admin_channel_peek', [])).toBe('firstCandidate_1234');
    expect(await reason(call('admin_channel', [ADMIN, 'bad name!']))).toContain('invalid_channel');
    expect(await reason(call('admin_channel_rotate', [ADMIN, 'thirdCandidate_12345']))).toContain(
      'forbidden',
    );
    expect(await call('admin_channel_rotate', [OWNER, 'thirdCandidate_12345'])).toBe('thirdCandidate_12345');
  });
});

describe('privileges', () => {
  it('only the server calls the console’s functions; the helpers not even the server', async () => {
    for (const role of ['anon', 'authenticated'] as const)
      expect(
        await reason(as(c, role, HOST, () => c.query(`select public.admin_whoami($1, '{}')`, [HOST]))),
      ).toContain('permission denied');
    for (const helper of [
      `public.admin_role_of('${HOST}')`,
      `public.admin_require('${HOST}', 'dashboard.view')`,
      `public.admin_can('owner', 'dashboard.view')`,
    ])
      expect(await reason(as(c, 'service_role', null, () => c.query(`select ${helper}`)))).toContain(
        'permission denied',
      );
    for (const table of ['admin_staff', 'admin_audit'])
      expect(
        await reason(as(c, 'authenticated', HOST, () => c.query(`select * from public.${table}`))),
      ).toContain('permission denied');
  });
});

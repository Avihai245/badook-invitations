import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Feature flags per event (supabase/migrations/*_invitation_features.sql): the owner's plan and the
// event's overrides; the host switches a feature off for their event, the platform grants one.

const OWNER = '44444444-4444-4444-8444-444444444441';
const OTHER = '44444444-4444-4444-8444-444444444442';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let id: string;

async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r,
  );
}
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'other@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  id = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'flags-test', doc])
  ).id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('invitation features', () => {
  it('an event’s inputs: no overrides yet, the owner’s plan (free until an account says otherwise)', async () => {
    expect(await call('invitation_features', [id])).toMatchObject({
      overrides: {},
      ownerId: OWNER,
      ownerEmail: 'owner@example.com',
      plan: 'free',
      planStatus: 'active',
    });
    await commit('account_get', [OWNER]);
    await c.query(`update accounts set plan = 'pro' where user_id = $1`, [OWNER]);
    expect(await call('invitation_features', [id])).toMatchObject({ plan: 'pro' });
    expect(await call('invitation_features', ['00000000-0000-4000-8000-000000000000'])).toBeNull();
  });

  it('the host switches a feature off and back on, once each; never on someone else’s event', async () => {
    expect(await commit('invitation_feature_off', [id, OWNER, 'projector', true])).toEqual({
      off: ['projector'],
    });
    expect(await commit('invitation_feature_off', [id, OWNER, 'projector', true])).toEqual({
      off: ['projector'],
    });
    expect(await commit('invitation_feature_off', [id, OWNER, 'seating', true])).toEqual({
      off: ['projector', 'seating'],
    });
    expect(await commit('invitation_feature_off', [id, OWNER, 'projector', false])).toEqual({
      off: ['seating'],
    });
    expect(await commit('invitation_feature_off', [id, OTHER, 'seating', false])).toBeNull();
    await expect(commit('invitation_feature_off', [id, OWNER, 'Bad Feature', true])).rejects.toThrow(
      /bad feature/,
    );
  });

  it('the platform grants a feature beyond the plan and takes it back', async () => {
    expect(await commit('invitation_feature_grant', [id, 'checkin', true])).toEqual({
      off: ['seating'],
      grant: ['checkin'],
    });
    expect(await commit('invitation_feature_grant', [id, 'checkin', false])).toEqual({
      off: ['seating'],
      grant: [],
    });
  });

  it('only the service role may call them', async () => {
    for (const role of ['anon', 'authenticated']) {
      await c.query('begin');
      await c.query(`set local role ${role}`);
      await expect(c.query(`select public.invitation_features($1)`, [id])).rejects.toThrow(
        /permission denied/,
      );
      await c.query('rollback');
      await c.query('begin');
      await c.query(`set local role ${role}`);
      await expect(
        c.query(`select public.invitation_feature_grant($1, 'checkin', true)`, [id]),
      ).rejects.toThrow(/permission denied/);
      await c.query('rollback');
    }
  });
});

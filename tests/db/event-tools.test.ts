import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The event's tools and the host's path (supabase/migrations/*_event_tools_host_events.sql): what the
// host needs for the event, kept beside the feature switches; the first-party steps and their funnel.

const OWNER = '55555555-5555-4555-8555-555555555551';
const OTHER = '55555555-5555-4555-8555-555555555552';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let id: string;

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
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'tools-test', doc])
  ).id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('the event’s tools', () => {
  it('the host sets them beside the feature switches, never on someone else’s event', async () => {
    await commit('invitation_feature_off', [id, OWNER, 'projector', true]);
    expect(await commit('invitation_tools_set', [id, OWNER, JSON.stringify(['invite', 'plan'])])).toEqual({
      off: ['projector'],
      tools: ['invite', 'plan'],
    });
    expect(await commit('invitation_tools_set', [id, OWNER, JSON.stringify(['seating'])])).toMatchObject({
      tools: ['seating'],
    });
    expect(await commit('invitation_tools_set', [id, OTHER, JSON.stringify(['invite'])])).toBeNull();
    // the features' read carries them to the app (flags/server featureInput)
    expect(await commit('invitation_features', [id])).toMatchObject({ overrides: { tools: ['seating'] } });
  });

  it('refuses anything but a short list of short keys', async () => {
    for (const bad of [{ a: 1 }, ['Not A Key'], [1], Array(9).fill('invite')])
      await expect(commit('invitation_tools_set', [id, OWNER, JSON.stringify(bad)])).rejects.toThrow(
        /bad tools/,
      );
  });

  it('is the server’s alone', async () => {
    await expect(
      as(c, 'authenticated', OWNER, () =>
        c.query(`select public.invitation_tools_set($1, $2, '["invite"]')`, [id, OWNER]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('the host’s path (host_events)', () => {
  it('counts each step by hosts and times, between two instants', async () => {
    for (const [user, inv, name, props] of [
      [OWNER, id, 'home_view', {}],
      [OWNER, id, 'home_view', null],
      [OTHER, null, 'list_view', { events: 2 }],
      [OWNER, id, 'step_click', { step: 'guests' }],
    ] as const)
      await commit('host_event_add', [user, inv, name, props === null ? null : JSON.stringify(props)]);
    const funnel = await commit<{ name: string; hosts: number; times: number }[]>('host_funnel', [
      new Date(Date.now() - 60_000).toISOString(),
      new Date(Date.now() + 60_000).toISOString(),
    ]);
    expect(funnel).toEqual(
      expect.arrayContaining([
        { name: 'home_view', hosts: 1, times: 2 },
        { name: 'list_view', hosts: 1, times: 1 },
        { name: 'step_click', hosts: 1, times: 1 },
      ]),
    );
  });

  it('refuses odd names; signed-in users can’t read or write it directly', async () => {
    await expect(
      c.query(`insert into host_events (user_id, name) values ($1, 'Bad Name')`, [OWNER]),
    ).rejects.toThrow(/check/);
    await expect(as(c, 'authenticated', OWNER, () => c.query(`select * from host_events`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('old steps go after 400 days', async () => {
    await c.query(
      `insert into host_events (user_id, name, created_at) values ($1, 'list_view', now() - interval '401 days')`,
      [OWNER],
    );
    expect(await commit('host_events_purge', [])).toBe(1);
  });
});

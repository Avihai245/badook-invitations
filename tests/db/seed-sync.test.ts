import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEMO_OWNER_ID,
  seedInvitations,
  seedTemplates,
  seedVersion,
} from '../../src/features/invitations/templates/seed-data';
import { as, createTestDatabase } from './harness';

// The startup sync's side in the database (supabase/migrations/*_seed_sync.sql): the fingerprint of a
// fresh seed, writing templates and demo invitations, and never touching someone else's invitation.

const USER = '99999999-9999-4999-8999-999999999999';

let db: { url: string; drop: () => Promise<void> };
let c: Client;

const call = <T = unknown>(fn: string, args: unknown[]) =>
  as(c, 'service_role', null, async () => {
    const params = args.map((_, i) => `$${i + 1}`).join(', ');
    return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r as T;
  });

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(`insert into auth.users (id, email) values ($1, 'someone@example.com')`, [USER]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('seed sync', () => {
  it('a fresh seed records the code’s fingerprint, so a server starting on it has nothing to write', async () => {
    expect(await call('app_meta_get', ['seed_version'])).toBe(seedVersion());
    expect(await call('app_meta_get', ['nothing-here'])).toBeNull();
  });

  it('writes templates and the demo owner’s invitations, then the fingerprint', async () => {
    const [template] = seedTemplates();
    const [invitation] = seedInvitations();
    const changed = { ...template!, manifest: { ...template!.manifest, version: 99 } };
    const result = await as(c, 'service_role', null, async () => {
      const r = (
        await c.query(`select public.seed_upsert($1, $2, $3, $4) as r`, [
          JSON.stringify([changed]),
          JSON.stringify([invitation]),
          DEMO_OWNER_ID,
          'v-test',
        ])
      ).rows[0].r;
      const manifest = (
        await c.query(`select manifest->>'version' as v from invitation_templates where id = $1`, [
          changed.id,
        ])
      ).rows[0].v;
      const version = (await c.query(`select value from app_meta where key = 'seed_version'`)).rows[0].value;
      return { r, manifest, version };
    });
    expect(result).toEqual({ r: { templates: 1, invitations: 1 }, manifest: '99', version: 'v-test' });
  });

  it('a slug that belongs to a user stays theirs', async () => {
    const [invitation] = seedInvitations();
    const result = await as(c, 'service_role', null, async () => {
      await c.query(
        `insert into invitations (id, owner_id, template_id, slug, status, event_type, draft)
         select gen_random_uuid(), $1, template_id, 'demo-taken', 'draft', event_type, draft
         from invitations where slug = $2`,
        [USER, invitation!.slug],
      );
      const r = (
        await c.query(`select public.seed_upsert(null, $1, $2, null) as r`, [
          JSON.stringify([{ ...invitation, id: '11111111-1111-4111-8111-111111111111', slug: 'demo-taken' }]),
          DEMO_OWNER_ID,
        ])
      ).rows[0].r;
      const row = (await c.query(`select owner_id, status from invitations where slug = 'demo-taken'`))
        .rows[0];
      return { r, row };
    });
    expect(result.r).toEqual({ templates: 0, invitations: 0 });
    expect(result.row).toEqual({ owner_id: USER, status: 'draft' });
  });

  it('an unlisted design is seeded inactive (out of the public listing) and follows its manifest', async () => {
    const active = async () =>
      (
        await c.query(
          `select id, is_active from invitation_templates where id in ('lumiere', 'sahar-bordeaux') order by id`,
        )
      ).rows;
    expect(await active()).toEqual([
      { id: 'lumiere', is_active: false },
      { id: 'sahar-bordeaux', is_active: true },
    ]);
    const lumiere = seedTemplates().find((t) => t.id === 'lumiere')!;
    const upsert = (manifest: unknown) =>
      c.query(`select public.seed_upsert($1, null, $2, null)`, [
        JSON.stringify([{ ...lumiere, manifest }]),
        DEMO_OWNER_ID,
      ]);
    // released (listed in its manifest) → active; and back (one transaction, rolled back after)
    const states = await as(c, 'service_role', null, async () => {
      await upsert({ ...lumiere.manifest, listed: true });
      const released = (await active())[0];
      await upsert(lumiere.manifest);
      return [released, (await active())[0]];
    });
    expect(states).toEqual([
      { id: 'lumiere', is_active: true },
      { id: 'lumiere', is_active: false },
    ]);
    // its demos are there (reachable by link, like any demo)
    const demos = (
      await c.query(
        `select slug from invitations where template_id = 'lumiere' and owner_id = $1 order by slug`,
        [DEMO_OWNER_ID],
      )
    ).rows.map((r) => r.slug);
    expect(demos).toEqual([
      'demo-lumiere',
      'demo-lumiere-bar-mitzvah',
      'demo-lumiere-bat-mitzvah',
      'demo-lumiere-engagement',
    ]);
  });

  it('without the demo owner, no invitations; and only the server may call it', async () => {
    const [invitation] = seedInvitations();
    expect(
      await call('seed_upsert', [
        null,
        JSON.stringify([invitation]),
        '22222222-2222-4222-8222-222222222222',
        null,
      ]),
    ).toEqual({ templates: 0, invitations: 0 });
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, role === 'authenticated' ? USER : null, () =>
          c.query(`select public.seed_upsert(null, null, $1, 'x')`, [DEMO_OWNER_ID]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(c, role, null, () => c.query(`select public.app_meta_get('seed_version')`)),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

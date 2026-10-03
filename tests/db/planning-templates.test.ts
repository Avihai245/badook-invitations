import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The host's own planning templates (supabase/migrations/*_planning_templates.sql): each belongs to its
// owner alone, at most twenty, and only the service role may touch them.

const OWNER = '88888888-8888-4888-8888-888888888881';
const OTHER = '88888888-8888-4888-8888-888888888882';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
const items = {
  tasks: [{ title: 'לסגור אולם', notes: null, offsetDays: -200, category: 'venue', priority: 1 }],
  categories: [{ key: 'venue', name: null, pct: 100, basis: 'fixed', required: true }],
  requiredVendors: ['venue'],
};

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (
    await c.query(
      `select public.${fn}(${params}) as r`,
      args.map((a) => (a !== null && typeof a === 'object' ? JSON.stringify(a) : a)),
    )
  ).rows[0].r;
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values ($1, 'tpl-a@example.com', 'x', '{}'), ($2, 'tpl-b@example.com', 'x', '{}')`,
    [OWNER, OTHER],
  );
});
afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('a host’s templates', () => {
  it('are saved, listed newest first, read back and deleted — by their owner only', async () => {
    const a = await commit<{ id: string; name: string; tasks: number }>('planning_template_save', [
      OWNER,
      'חתונה בגן',
      'wedding',
      items,
    ]);
    expect(a).toMatchObject({ name: 'חתונה בגן', tasks: 1 });
    const b = await commit<{ id: string }>('planning_template_save', [OWNER, 'ברית קטנה', 'brit', items]);
    const list = await commit<{ id: string; name: string }[]>('planning_templates_list', [OWNER]);
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(await commit('planning_templates_list', [OTHER])).toEqual([]);
    expect(await commit('planning_template_get', [OWNER, a.id])).toEqual(items);
    expect(await commit('planning_template_get', [OTHER, a.id])).toBeNull();
    expect(await commit('planning_template_delete', [OTHER, a.id])).toBe(false);
    expect(await commit('planning_template_delete', [OWNER, a.id])).toBe(true);
    expect(await commit('planning_template_get', [OWNER, a.id])).toBeNull();
    expect(
      await commit('planning_template_save', ['88888888-0000-4000-8000-000000000000', 'x', null, items]),
    ).toBeNull();
  });

  it('twenty at most', async () => {
    for (let i = 0; i < 19; i++) await commit('planning_template_save', [OTHER, `t${i}`, null, items]);
    expect(await commit('planning_template_save', [OTHER, 'the twentieth', null, items])).toMatchObject({
      name: 'the twentieth',
    });
    expect(await commit('planning_template_save', [OTHER, 'one more', null, items])).toEqual({
      ok: false,
      code: 'too_many',
    });
  });

  it('only the service role may call anything, and the table is closed', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, OWNER, () => c.query(`select public.planning_templates_list('${OWNER}')`)),
      ).rejects.toThrow(/permission denied/);
      await expect(as(c, role, OWNER, () => c.query(`select * from public.plan_templates`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it('go with their owner’s account', async () => {
    await c.query(`delete from auth.users where id = $1`, [OTHER]);
    expect(
      (await c.query(`select count(*) n from plan_templates where owner_id = $1`, [OTHER])).rows[0].n,
    ).toBe('0');
  });
});

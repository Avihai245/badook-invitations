import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The weekly planning email's selection (supabase/migrations/*_planning_reminders.sql): who is due, the
// six-day dedupe the database holds, and that only the service role may ask.

const OWNER = '77777777-7777-4777-8777-777777777771';
const NO_EMAIL_OPT = '77777777-7777-4777-8777-777777777772';
const BANNED = '77777777-7777-4777-8777-777777777773';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
const ids: Record<string, string> = {};

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const due = (now: string) =>
  commit<{ id: string; email: string; defaultLocale: string }[]>('planning_reminders_due', [now]);
const NOW = '2027-05-01T06:00:00Z';

async function plan(
  key: string,
  owner: string,
  over: { email?: boolean; onboarding?: boolean; status?: string; date?: string; type?: string } = {},
) {
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  const created = await commit<{ id: string }>('create_invitation', [
    owner,
    'sahar-bordeaux',
    over.type ?? 'wedding',
    `rem-${key.toLowerCase()}`,
    doc,
  ]);
  ids[key] = created.id;
  await c.query(
    `update invitations set status = $2, draft = jsonb_set(draft, '{event,date}', to_jsonb($3::text)) where id = $1`,
    [created.id, over.status ?? 'draft', over.date ?? '2027-06-17'],
  );
  await c.query(`insert into plan_settings (invitation_id, reminders, onboarding_done) values ($1, $2, $3)`, [
    created.id,
    JSON.stringify({ email: over.email ?? true }),
    over.onboarding ?? true,
  ]);
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
       ($1, 'rem-owner@example.com', 'x', '{}'), ($2, 'rem-two@example.com', 'x', '{}'), ($3, 'rem-banned@example.com', 'x', '{}')`,
    [OWNER, NO_EMAIL_OPT, BANNED],
  );
  await c.query(`update auth.users set banned_until = now() + interval '1 year' where id = $1`, [BANNED]);
  await plan('on', OWNER);
  await plan('off', NO_EMAIL_OPT, { email: false });
  await plan('notDone', OWNER, { onboarding: false });
  await plan('archived', OWNER, { status: 'archived' });
  await plan('past', OWNER, { date: '2027-03-01' });
  await plan('std', OWNER, { type: 'save_the_date' });
  await plan('banned', BANNED);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('who is reminded', () => {
  it('a set-up plan whose host chose the email, live, not past, with an active account', async () => {
    const list = await due(NOW);
    expect(list.map((x) => x.id)).toEqual([ids.on]);
    expect(list[0]).toMatchObject({ email: 'rem-owner@example.com', ownerId: OWNER });
    expect(list[0]!.defaultLocale).toBeTruthy();
  });

  it('an event the day after still counts, two days after does not', async () => {
    await c.query(
      `update invitations set draft = jsonb_set(draft, '{event,date}', '"2027-04-30"') where id = $1`,
      [ids.on],
    );
    expect((await due(NOW)).map((x) => x.id)).toEqual([ids.on]);
    await c.query(
      `update invitations set draft = jsonb_set(draft, '{event,date}', '"2027-04-29"') where id = $1`,
      [ids.on],
    );
    expect(await due(NOW)).toEqual([]);
    await c.query(
      `update invitations set draft = jsonb_set(draft, '{event,date}', '"2027-06-17"') where id = $1`,
      [ids.on],
    );
  });
});

describe('once in six days', () => {
  it('recording a reminder takes the plan off the list until six days have passed', async () => {
    expect(await commit('planning_reminder_sent', [ids.on, NOW])).toBe(true);
    expect(await due('2027-05-02T06:00:00Z')).toEqual([]);
    expect(await due('2027-05-06T06:00:00Z')).toEqual([]);
    expect((await due('2027-05-07T06:01:00Z')).map((x) => x.id)).toEqual([ids.on]);
    expect(await commit('planning_reminder_sent', ['77777777-0000-4000-8000-000000000000', NOW])).toBe(false);
  });
});

describe('privileges', () => {
  it('only the service role may ask or record', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, OWNER, () => c.query(`select public.planning_reminders_due(now())`)),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(c, role, OWNER, () => c.query(`select public.planning_reminder_sent('${ids.on}', now())`)),
      ).rejects.toThrow(/permission denied/);
    }
    const asService = await as(
      c,
      'service_role',
      null,
      async () => (await c.query(`select public.planning_reminders_due(now()) as r`)).rows[0].r,
    );
    expect(Array.isArray(asService)).toBe(true);
  });
});

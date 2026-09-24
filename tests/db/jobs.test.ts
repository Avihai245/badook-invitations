import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from './harness';

// Who runs a recurring job (supabase/migrations/*_app_jobs.sql): the one that takes it while it is due
// and nobody else holds it; a run that died is taken again once its lease is over.

let db: { url: string; drop: () => Promise<void> };
let c: Client;

const claim = async (name: string, due: string, lease = 60) =>
  (await c.query('select public.app_job_claim($1, $2::timestamptz, $3) as r', [name, due, lease])).rows[0]
    .r as boolean;
const done = (name: string) => c.query('select public.app_job_done($1)', [name]);
const row = async (name: string) =>
  (await c.query(`select value, updated_at from app_meta where key = $1`, [`job:${name}`])).rows[0];
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('app_job_claim / app_job_done', () => {
  it('the first claim takes a job that never ran; a second one, while it runs, does not', async () => {
    expect(await claim('daily', ago(0))).toBe(true);
    expect(await claim('daily', ago(0))).toBe(false);
  });

  it('once done, it is not due again before its next turn — then taken again', async () => {
    await done('daily');
    // its lease is over, but it finished after this turn began: not due
    await c.query(`update app_meta set updated_at = now() - interval '1 hour' where key = 'job:daily'`);
    expect(await claim('daily', ago(60))).toBe(false);
    // the next turn (a moment after it finished)
    const finished = new Date((await row('daily')).value).getTime();
    expect(await claim('daily', new Date(finished + 1000).toISOString())).toBe(true);
  });

  it('a run that died is taken again once its lease is over', async () => {
    expect(await claim('whatsapp', ago(0), 120)).toBe(true);
    // never marked done; within the lease nobody else takes it
    expect(await claim('whatsapp', ago(0), 120)).toBe(false);
    await c.query(`update app_meta set updated_at = now() - interval '3 minutes' where key = 'job:whatsapp'`);
    expect(await claim('whatsapp', ago(0), 120)).toBe(true);
  });

  it('a scheduler’s run counts as done even when the job was never claimed', async () => {
    await done('nightly-report');
    expect(new Date((await row('nightly-report')).value).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(await claim('nightly-report', ago(3600))).toBe(false);
  });

  it('only the service role may call them', async () => {
    for (const role of ['anon', 'authenticated']) {
      await c.query('begin');
      await c.query(`set local role ${role}`);
      await expect(c.query(`select public.app_job_claim('x', now(), 60)`)).rejects.toThrow(
        /permission denied/,
      );
      await c.query('rollback');
    }
  });
});

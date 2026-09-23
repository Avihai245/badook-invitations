import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { seedSql } from '../../scripts/seed';

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

/** Fresh database: Supabase shim → every migration in order → seed. Returns its URL + a drop(). */
export async function createTestDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  const name = `badook_test_${process.pid}_${Date.now()}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query(readFileSync('tests/db/supabase-shim.sql', 'utf8'));
  for (const file of readdirSync('supabase/migrations').sort()) {
    await db.query(readFileSync(join('supabase/migrations', file), 'utf8'));
  }
  await db.query(seedSql());
  await db.end();
  return {
    url: url.toString(),
    drop: async () => {
      const a = new Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export type Role = 'anon' | 'authenticated' | 'service_role';

/**
 * Runs `fn` inside a transaction as `role`, with the JWT claims PostgREST would set, then rolls back
 * so tests stay independent. Errors propagate (use expect(...).rejects).
 */
export async function as<T>(
  client: Client,
  role: Role,
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('begin');
  try {
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(sub ? { sub, role } : { role }),
    ]);
    await client.query(`set local role ${role}`);
    return await fn();
  } finally {
    await client.query('rollback');
  }
}

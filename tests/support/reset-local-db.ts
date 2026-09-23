// Recreates a local database with the Supabase shim, every migration and the seed:
//   npx tsx tests/support/reset-local-db.ts badook_local
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { seedSql } from '../../scripts/seed';

const name = process.argv[2] ?? 'badook_local';
const admin = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

async function main() {
  const a = new Client({ connectionString: admin });
  await a.connect();
  await a.query(`drop database if exists ${name} with (force)`);
  await a.query(`create database ${name}`);
  await a.end();
  const url = new URL(admin);
  url.pathname = `/${name}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query(readFileSync('tests/db/supabase-shim.sql', 'utf8'));
  for (const f of readdirSync('supabase/migrations').sort())
    await db.query(readFileSync(join('supabase/migrations', f), 'utf8'));
  await db.query(seedSql());
  await db.end();
  console.log(url.toString());
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

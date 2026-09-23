import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// Database tests (migration, RLS, RPCs) against a real Postgres with the Supabase shim — see tests/db.
// TEST_DATABASE_URL = an admin connection (default postgres://postgres:postgres@127.0.0.1:5432/postgres);
// each run creates and drops its own database.
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['tests/db/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 60_000 },
});

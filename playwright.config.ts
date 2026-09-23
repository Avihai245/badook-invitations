import { defineConfig, devices } from '@playwright/test';

// Playwright runs locally or in CI — never in the Amplify build (MASTER_PROMPT §1.1 rule 7).
// Base URL: PW_BASE_URL (e.g. a deployed Amplify branch) or a local stack started here:
//   a fresh Postgres database `badook_e2e` (Supabase shim + migrations + seed) behind
//   tests/support/rest-shim.mjs, and `next start` pointed at it (requires `npm run build` first and a
//   local Postgres reachable at TEST_DATABASE_URL — see tests/db).
const port = Number(process.env.PW_PORT || 3100);
const shimPort = Number(process.env.PW_SHIM_PORT || 54329);
const baseURL = process.env.PW_BASE_URL || `http://127.0.0.1:${port}`;
const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const e2eDatabase = Object.assign(new URL(admin), { pathname: '/badook_e2e' }).toString();

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        // Same viewport as the design reference screenshots (390×844 @2x), rendered in Chromium.
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : [
        {
          command: 'npx tsx tests/support/reset-local-db.ts badook_e2e && node tests/support/rest-shim.mjs',
          port: shimPort,
          reuseExistingServer: false,
          env: { DATABASE_URL: e2eDatabase, REST_SHIM_PORT: String(shimPort) },
          timeout: 120_000,
        },
        {
          command: `npx next start -p ${port}`,
          url: `${baseURL}/`,
          reuseExistingServer: !process.env.CI,
          env: {
            INVITES_DEV_ROUTES: 'true',
            INVITES_PUBLIC_BASE_URL: baseURL,
            INVITES_IP_HASH_SALT: 'e2e-salt-0123456789abcdef0123456789',
            NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${shimPort}`,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable',
            SUPABASE_SECRET_KEY: 'local-secret',
          },
          timeout: 120_000,
        },
      ],
});

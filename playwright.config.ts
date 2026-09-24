import { defineConfig, devices } from '@playwright/test';

// Playwright runs locally or in CI — never in the Amplify build (MASTER_PROMPT §1.1 rule 7).
// Base URL: PW_BASE_URL (e.g. a deployed Amplify branch) or a local stack started here:
//   a fresh Postgres database `badook_e2e` (Supabase shim + migrations + seed) behind
//   tests/support/rest-shim.mjs, and `next start` pointed at it (requires `npm run build` first and a
//   local Postgres reachable at TEST_DATABASE_URL — see tests/db).
const port = Number(process.env.PW_PORT || 3100);
const shimPort = Number(process.env.PW_SHIM_PORT || 54329);
const whatsappPort = Number(process.env.PW_WHATSAPP_PORT || 54340);
const baseURL = process.env.PW_BASE_URL || `http://127.0.0.1:${port}`;
const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
// PW_DB_NAME: another database name, to run two local stacks side by side (with other PW_*PORTs)
const dbName = process.env.PW_DB_NAME || 'badook_e2e';
const e2eDatabase = Object.assign(new URL(admin), { pathname: `/${dbName}` }).toString();

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
          command: `npx tsx tests/support/reset-local-db.ts ${dbName} && node tests/support/rest-shim.mjs`,
          port: shimPort,
          reuseExistingServer: false,
          env: { DATABASE_URL: e2eDatabase, REST_SHIM_PORT: String(shimPort) },
          timeout: 120_000,
        },
        {
          // the WhatsApp Cloud API and Anthropic API stand-ins (tests/e2e/guests.spec.ts, support.spec.ts)
          command: 'node tests/support/mock-whatsapp.mjs',
          url: `http://127.0.0.1:${whatsappPort}/health`,
          reuseExistingServer: false,
          env: {
            MOCK_WHATSAPP_PORT: String(whatsappPort),
            MOCK_WHATSAPP_TOKEN: 'e2e-whatsapp-token',
            MOCK_AI_KEY: 'e2e-anthropic-key',
          },
          timeout: 30_000,
        },
        {
          command: `npx next start -p ${port}`,
          url: `${baseURL}/`,
          reuseExistingServer: !process.env.CI,
          env: {
            INVITES_DEV_ROUTES: 'true',
            INVITES_PUBLIC_BASE_URL: baseURL,
            INVITES_IP_HASH_SALT: 'e2e-salt-0123456789abcdef0123456789',
            // the daily RSVP summary endpoint (tests/e2e/p4-dashboard.spec.ts)
            INVITES_CRON_SECRET: 'e2e-cron-secret-0123456789abcdef',
            NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${shimPort}`,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable',
            SUPABASE_SECRET_KEY: 'local-secret',
            // WhatsApp: the stand-in above; these two accounts send without buying credits
            INVITES_WHATSAPP_TOKEN: 'e2e-whatsapp-token',
            INVITES_WHATSAPP_PHONE_NUMBER_ID: '100000000000001',
            INVITES_WHATSAPP_API_BASE: `http://127.0.0.1:${whatsappPort}`,
            INVITES_WHATSAPP_APP_SECRET: 'e2e-whatsapp-app-secret',
            INVITES_WHATSAPP_VERIFY_TOKEN: 'e2e-whatsapp-verify',
            INVITES_ADMIN_EMAILS: 'wa-admin-mobile@example.com,wa-admin-desktop@example.com',
            // billing through our own test payment page instead of PayPlus (tests/e2e/billing.spec.ts)
            INVITES_BILLING_TEST_MODE: 'true',
            // the support assistant: the Anthropic API stand-in above (tests/e2e/support.spec.ts)
            ANTHROPIC_API_KEY: 'e2e-anthropic-key',
            INVITES_AI_MODEL: 'e2e-model',
            // the partner API (tests/e2e/partner.spec.ts)
            INVITES_PARTNER_API_KEY: 'e2e-partner-key-0123456789abcdef0123',
            INVITES_AI_API_BASE: `http://127.0.0.1:${whatsappPort}`,
          },
          timeout: 120_000,
        },
      ],
});

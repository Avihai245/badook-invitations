import { defineConfig, devices } from '@playwright/test';

// Playwright runs locally or in CI — never in the Amplify build (MASTER_PROMPT §1.1 rule 7).
// Base URL: PW_BASE_URL (e.g. a deployed Amplify branch) or a local production server.
const port = Number(process.env.PW_PORT || 3100);
const baseURL = process.env.PW_BASE_URL || `http://127.0.0.1:${port}`;

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
    : {
        // Requires `npm run build` first; INVITES_DEV_ROUTES exposes the kitchen sink.
        command: `npx next start -p ${port}`,
        url: `${baseURL}/`,
        reuseExistingServer: !process.env.CI,
        env: { INVITES_DEV_ROUTES: 'true' },
        timeout: 120_000,
      },
});

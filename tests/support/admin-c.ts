import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { hydrated, SHIM, sql } from './phase5b';

/**
 * What the admin console's cash flow, messages and Badook Events specs share (tests/e2e/admin-finance,
 * admin-messages, admin-partners): a staff member of a given role signed in, the console's language,
 * its live channel, and an accessibility audit of what is on screen.
 */

export type ConsoleRole = 'owner' | 'admin' | 'support' | 'finance' | 'viewer';

export const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** A new staff member with `role`, signed up and in on `page`. */
export async function signInStaff(page: Page, role: ConsoleRole, prefix = 'adm-c'): Promise<string> {
  const email = `${unique(`${prefix}-${role}`)}@example.com`;
  await sql(`insert into public.admin_staff (email, role) values ($1, $2)`, [email, role]);
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await hydrated(page);
  return email;
}

/** The console's (the host app's) language. */
export async function uiLanguage(page: Page, lang: 'he' | 'en') {
  await page
    .context()
    .addCookies([{ name: 'ui_lang', value: lang, url: new URL('/', page.url()).toString() }]);
}

export async function openConsole(page: Page, path: string) {
  const res = await page.goto(path);
  await hydrated(page);
  return res;
}

/** The page's live connection is up: the server's hints reach it. */
export async function waitLive(page: Page) {
  await expect(page.getByTestId('admin-live').first()).toHaveAttribute('data-state', 'live', {
    timeout: 20_000,
  });
}

/**
 * The server's "something changed" on the console's channel — what features/admin/server/live.ts
 * adminNudge sends (through the Supabase stand-in's broadcast endpoint, with the service key).
 */
export async function nudgeConsole(kind: string) {
  const [row] = await sql<{ value: string }>(`select value from public.app_meta where key = 'admin:channel'`);
  expect(row?.value, 'the console’s channel').toBeTruthy();
  const res = await fetch(`${SHIM}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: 'local-secret',
      authorization: 'Bearer local-secret',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ topic: row!.value, event: 'refresh', payload: { kind, at: Date.now() }, private: false }],
    }),
  });
  expect(res.status).toBe(202);
}

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * WCAG 2.1 AA (axe-core) on the console page's own content (#admin-main — the frame around it, its menu
 * and language switch, is the console's foundation): no violations.
 */
export async function audit(page: Page, key: string) {
  // animations settled (the tiles' and the toasts')
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page })
    .include('#admin-main')
    .options({ resultTypes: ['violations'] })
    .withTags(TAGS)
    .analyze();
  const findings = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')),
  }));
  expect(findings, `accessibility violations on ${key}`).toEqual([]);
}

/** The number in a piece of text ("₪1,234.50" → 1234.5). */
export const numberIn = (text: string | null) => Number((text ?? '').replace(/[^\d.-]/g, ''));

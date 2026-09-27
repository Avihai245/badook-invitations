import { expect, test, type Page } from '@playwright/test';
import { hydrated, sql } from '../support/phase5b';

// The admin console's gate (features/admin, supabase/migrations/*_admin_console.sql): staff only —
// anyone else gets "not found" and no way in — the areas of the member's role, and the live channel.

async function signUpAs(page: Page, email: string) {
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await hydrated(page);
}
/** The console's menu: the sidebar on desktop, the drawer (opened) on phones. */
async function adminMenu(page: Page, mobile: boolean) {
  if (!mobile) return page.locator('aside');
  await page.getByTestId('admin-menu').click();
  return page.getByRole('dialog');
}
const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.describe('the admin console', () => {
  test('is staff only: anyone else gets “not found” and sees no way in', async ({ page }) => {
    await signUpAs(page, unique('not-staff'));
    await page.getByTestId('user-menu').first().click();
    await expect(page.getByRole('menuitem', { name: 'ניהול המערכת' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    const res = await page.goto('/app/admin');
    expect(res?.status()).toBe(404);
    const api = await page.request.get('/app/admin/users');
    expect(api.status()).toBe(404);
  });

  test('an owner (INVITES_ADMIN_EMAILS) opens it from the app: every area, live', async ({
    page,
  }, testInfo) => {
    const email = `admin-owner-${testInfo.project.name}@example.com`;
    await sql(`delete from auth.users where email = $1`, [email]);
    await signUpAs(page, email);
    await page.getByTestId('user-menu').first().click();
    await page.getByRole('menuitem', { name: 'ניהול המערכת' }).click();
    await page.waitForURL(/\/app\/admin$/);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'סקירה' })).toBeVisible();
    // the owner's areas, all ten (behind the menu button on phones)
    const mobile = testInfo.project.name === 'mobile';
    const menu = await adminMenu(page, mobile);
    for (const area of [
      'overview',
      'users',
      'invitations',
      'messages',
      'finance',
      'support',
      'partners',
      'staff',
      'audit',
      'system',
    ])
      await expect(menu.getByTestId(`admin-nav-${area}`)).toBeVisible();
    if (mobile) await page.keyboard.press('Escape');
    await expect(page.getByTestId('admin-live').first()).toHaveAttribute('data-state', 'live', {
      timeout: 15_000,
    });
    // the customers' assistant isn't on the team's screen
    await expect(page.getByRole('button', { name: /העוזר|assistant/i })).toHaveCount(0);
    // on the staff list as an owner, from INVITES_ADMIN_EMAILS
    const [row] = await sql<{ role: string; source: string }>(
      `select role, source from public.admin_staff where email = $1 and removed_at is null`,
      [email],
    );
    expect(row).toEqual({ role: 'owner', source: 'env' });
  });

  test('a viewer sees their role’s areas; another area sends them back with a note', async ({
    page,
  }, testInfo) => {
    const email = unique(`admin-viewer-${testInfo.project.name}`);
    await sql(`insert into public.admin_staff (email, role) values ($1, 'viewer')`, [email]);
    await signUpAs(page, email);
    await page.goto('/app/admin/staff');
    await page.waitForURL(/\/app\/admin\?denied=staff\.view$/);
    await hydrated(page);
    await expect(page.getByTestId('admin-denied')).toContainText('אין לך הרשאה לאזור הזה');
    const menu = await adminMenu(page, testInfo.project.name === 'mobile');
    for (const area of ['overview', 'users', 'invitations', 'messages', 'finance', 'partners'])
      await expect(menu.getByTestId(`admin-nav-${area}`)).toBeVisible();
    for (const area of ['support', 'staff', 'audit', 'system'])
      await expect(page.getByTestId(`admin-nav-${area}`)).toHaveCount(0);
  });

  test('its API too: anyone else gets “not found”; staff without the permission, “forbidden”', async ({
    page,
  }, testInfo) => {
    const email = unique(`admin-api-${testInfo.project.name}`);
    await signUpAs(page, email);
    const [me] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [email]);
    const calls: [string, unknown][] = [
      [`/api/admin/users/${me!.id}/credits`, { delta: 5, reason: 'ניסיון' }],
      [`/api/admin/users/${me!.id}/suspend`, { suspend: true, reason: 'ניסיון' }],
      ['/api/admin/staff', { email: unique('admin-api-new'), role: 'owner', note: null, reason: 'ניסיון' }],
      ['/api/admin/system/channel', {}],
    ];
    for (const [path, data] of calls)
      expect((await page.request.post(path, { data })).status(), path).toBe(404);
    // the same account on the staff as a viewer: the console is theirs, these actions aren't
    await sql(`insert into public.admin_staff (email, role) values ($1, 'viewer')`, [email]);
    for (const [path, data] of calls)
      expect((await page.request.post(path, { data })).status(), path).toBe(403);
    // and nothing was done
    const [row] = await sql<{ n: number }>(
      `select count(*)::int as n from public.admin_audit where actor_email = $1`,
      [email],
    );
    expect(row!.n).toBe(0);
  });

  test('an account Badook Events opened is never staff, whatever its email', async ({ page }, testInfo) => {
    const email = unique(`admin-partner-${testInfo.project.name}`);
    await sql(`insert into public.admin_staff (email, role) values ($1, 'owner')`, [email]);
    await signUpAs(page, email);
    await sql(
      `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"provisioned_by":"partner:badook-events"}' where email = $1`,
      [email],
    );
    const res = await page.goto('/app/admin');
    expect(res?.status()).toBe(404);
  });
});

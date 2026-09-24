import { expect, test, type Page } from '@playwright/test';

// "Continue with Google" through the local Supabase stand-in (tests/support/rest-shim.mjs), whose
// account chooser plays Google's part: a new account with the name from Google, back to the page the
// visitor asked for; canceling comes back with a message; an email+password account with the same
// address gets Google too (and keeps its invitations).

const LOCAL = !process.env.PW_BASE_URL;

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function chooseGoogleAccount(page: Page, email: string, name?: string) {
  await page.getByRole('button', { name: 'המשך עם Google' }).click();
  await page.waitForURL(/\/auth\/v1\/authorize/);
  await page.getByLabel('Email').fill(email);
  if (name) await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function signOut(page: Page) {
  await page.getByTestId('user-menu').click();
  await page.getByRole('menuitem', { name: 'יציאה' }).click();
  await page.waitForURL(/\/login/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

test.describe('sign in with Google', () => {
  test.skip(!LOCAL, 'Google is played by the local stand-in');

  test('a new account from Google, back where the visitor was going; canceling says so', async ({ page }) => {
    const email = `google-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await open(page, '/login?next=%2Fapp%2Faccount');
    await chooseGoogleAccount(page, email, 'דנה כהן');
    await page.waitForURL(/\/app\/account$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByLabel('שם מלא')).toHaveValue('דנה כהן');
    await expect(page.getByLabel('מייל')).toHaveValue(email);
    await expect(page.getByText('כניסה:')).toBeVisible();
    await expect(page.locator('main').getByText('Google', { exact: true })).toBeVisible();

    await signOut(page);
    // canceled at Google: back on the sign-in page, with a message
    await page.getByRole('button', { name: 'המשך עם Google' }).click();
    await page.waitForURL(/\/auth\/v1\/authorize/);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForURL(/\/login\?error=oauth_failed/);
    await expect(page.getByRole('alert').filter({ hasText: 'הכניסה עם Google לא הושלמה' })).toBeVisible();

    // and again: the same account
    await chooseGoogleAccount(page, email);
    await page.waitForURL(/\/app\/invitations$/);
  });

  test('from the sign-up page; an existing email account gets Google too, with its invitations', async ({
    page,
  }) => {
    const email = `both-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await open(page, '/signup');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'a-good-password');
    await page.click('form:has(input[name=password]) button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    const created = await page.evaluate(async () => {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: 'sahar-bordeaux',
          eventType: 'wedding',
          locales: ['he'],
          defaultLocale: 'he',
          hosts: { primary: { he: 'רוני' }, secondary: { he: 'גל' } },
          date: '2027-06-17',
          startTime: '19:30',
          timezone: 'Asia/Jerusalem',
        }),
      });
      return res.status;
    });
    expect(created).toBe(201);
    await signOut(page);

    await open(page, '/signup');
    await chooseGoogleAccount(page, email);
    await page.waitForURL(/\/app\/invitations$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByText('רוני').first()).toBeVisible();
    // the password still works too
    await signOut(page);
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'a-good-password');
    await page.getByRole('button', { name: 'כניסה', exact: true }).click();
    await page.waitForURL(/\/app\/invitations$/);
  });
});

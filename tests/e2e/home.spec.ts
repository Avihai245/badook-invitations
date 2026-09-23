import { expect, test } from '@playwright/test';

// The home page: what Badook is and the way in; signed-in hosts go straight to their invitations.

test('a visitor sees the pitch and the way in; a signed-in host goes to the invitations', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(
    page.getByRole('heading', { level: 1, name: 'הזמנות דיגיטליות שמרגשות את האורחים' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'יצירת הזמנה' })).toHaveAttribute('href', '/signup');
  await expect(page.getByRole('link', { name: 'כניסה' })).toHaveAttribute('href', '/login');
  const sample = page.getByRole('link', { name: 'לצפייה בהזמנה לדוגמה' });
  await expect(sample).toHaveAttribute('href', '/i/noa-and-itay?lang=he');
  expect((await page.request.get('/i/noa-and-itay?lang=he')).status()).toBe(200);

  await page.getByRole('link', { name: 'יצירת הזמנה' }).click();
  await page.waitForURL(/\/signup$/);
  await page.fill(
    'input[name=email]',
    `home-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  );
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.goto('/');
  await page.waitForURL(/\/app\/invitations$/);
});

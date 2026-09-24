import { expect, test, type Page } from '@playwright/test';

// Signing in and up around the edges: Supabase's answers that land on the home page (its Site URL
// fallback) reach the callback, each failure with its own message; signing up keeps where the visitor
// was going — and from the home page's pricing goes straight on to paying for the chosen plan (the
// test payment page of INVITES_BILLING_TEST_MODE); the terms line and the policies in small print.

const LOCAL = !process.env.PW_BASE_URL;

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function signUp(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  return email;
}

test.describe('sign-in links and pages', () => {
  test('Supabase’s answer on the home page reaches the callback, with the right message', async ({
    page,
  }) => {
    // an expired confirmation link, sent to the Site URL
    await page.goto(
      '/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    await page.waitForURL(/\/login\?error=link_expired/);
    await expect(
      page.getByRole('alert').filter({ hasText: 'הקישור פג תוקף או שכבר השתמשו בו' }),
    ).toBeVisible();

    // a confirmation link opened in another browser (no PKCE verifier here): the email is confirmed
    await page.goto('/?code=0b6b1f8e-1a57-4a47-9d4b-2c3a3f1e5d10');
    await page.waitForURL(/\/login\?notice=email_confirmed/);
    await expect(page.getByTestId('auth-notice')).toContainText('כתובת המייל אושרה');

    // Google canceled is still Google's message
    await page.goto('/auth/callback?error=access_denied&error_description=The+user+canceled');
    await page.waitForURL(/\/login\?error=oauth_failed/);
    await expect(page.getByRole('alert').filter({ hasText: 'הכניסה עם Google לא הושלמה' })).toBeVisible();
  });

  test('the terms line on sign-up, and the policies in small print', async ({ page }) => {
    await open(page, '/signup');
    const terms = page.getByTestId('signup-terms');
    await expect(terms).toContainText('בהרשמה אתם מסכימים ל');
    await expect(terms.getByRole('link', { name: 'תנאי השימוש' })).toHaveAttribute('href', '/terms');
    await expect(terms.getByRole('link', { name: 'מדיניות הפרטיות' })).toHaveAttribute('href', '/privacy');
    for (const path of ['/signup', '/login']) {
      await open(page, path);
      const legal = page.getByRole('navigation', { name: 'מידע ומדיניות' });
      for (const [name, href] of [
        ['מדיניות פרטיות', '/privacy'],
        ['תנאי שימוש', '/terms'],
        ['מדיניות עוגיות', '/cookies'],
        ['הצהרת נגישות', '/accessibility'],
      ] as const)
        await expect(legal.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  test('signing up keeps next; from the pricing, straight on to paying for the plan', async ({ page }) => {
    test.skip(!LOCAL, 'the test payment page is the local stack’s');
    await open(page, '/signup?next=%2Fapp%2Faccount');
    await expect(page.getByRole('link', { name: 'לכניסה' })).toHaveAttribute(
      'href',
      '/login?next=%2Fapp%2Faccount',
    );
    await signUp(page, 'next');
    await page.waitForURL(/\/app\/account$/);
    await page.context().clearCookies();

    await open(page, '/signup?plan=pro');
    await signUp(page, 'plan');
    await page.waitForURL(/\/app\/billing\/test-checkout\?id=/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByText('חבילת Pro (חודשי)')).toBeVisible();
    await page.getByRole('button', { name: 'תשלום (בדיקה)' }).click();
    await page.waitForURL(/\/app\/billing\?status=success/);
    await expect(page.getByTestId('current-plan')).toContainText('Pro');

    // signed in already: the pricing's link goes on to paying too (here, switching to Business)
    await page.goto('/signup?plan=business');
    await page.waitForURL(/\/app\/billing\/test-checkout\?id=/);
  });
});

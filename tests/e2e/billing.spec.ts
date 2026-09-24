import { expect, test, type Locator, type Page } from '@playwright/test';
import pg from 'pg';

// Plans and credits: the free plan's limit, upgrading through the payment page (the test provider of
// INVITES_BILLING_TEST_MODE stands in for PayPlus), message packs, a failed payment, a monthly
// renewal, canceling — and the account screen, down to deleting the account.

const LOCAL = !process.env.PW_BASE_URL;
const e2eDb = () => {
  const admin = new URL(
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  );
  return Object.assign(new URL(admin), { pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}` }).toString();
};

async function signUp(page: Page) {
  const email = `billing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return email;
}

const create = (page: Page) =>
  page.evaluate(async () => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return { status: res.status, body: (await res.json()) as { code?: string; limit?: number; id?: string } };
  });

const api = (page: Page, url: string, body: unknown) =>
  page.evaluate(
    async ({ url, body }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    },
    { url, body },
  );

const kpi = (page: Page, label: string) =>
  page.locator('#main dl').filter({ has: page.getByText(label, { exact: true }) });

async function pay(page: Page, button: Locator, outcome: 'תשלום (בדיקה)' | 'כישלון (בדיקה)') {
  await button.click();
  await page.waitForURL(/\/app\/billing\/test-checkout\?id=/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: outcome }).click();
  await page.waitForURL(/\/app\/billing\?status=/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

test('the free plan’s limit, upgrading, credits, a failed payment, a renewal and canceling', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const email = await signUp(page);
  // free: one active invitation
  expect((await create(page)).status).toBe(201);
  expect(await create(page)).toEqual({ status: 402, body: { ok: false, code: 'plan_limit', limit: 1 } });
  await page.goto('/app/invitations');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page
    .locator('#main')
    .getByRole('button', { name: /אפשרויות|פעולות/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'שכפול' }).click();
  const upgrade = page.getByRole('dialog', { name: 'הגעתם למספר ההזמנות בחבילה' });
  await expect(upgrade).toBeVisible();
  await upgrade.getByTestId('upgrade-link').click();
  await page.waitForURL(/\/app\/billing$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });

  const current = page.getByTestId('current-plan');
  await expect(current).toContainText('חינם');
  await expect(kpi(page, 'הזמנות פעילות')).toContainText('1 מתוך 1');
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('0');
  // nothing yet, in words that fit each list
  await expect(page.getByText('עוד אין תשלומים.')).toBeVisible();
  await expect(page.getByText('עוד אין תנועות קרדיטים.')).toBeVisible();
  // the "?" explains every part of the screen
  await page.locator('#main').getByTestId('area-help').click();
  const help = page.getByRole('dialog');
  for (const label of ['מעבר לחינם', 'השימוש בחבילה', 'היסטוריה'])
    await expect(help.getByText(label, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // Pro: the payment page, then back with the plan and its monthly credits
  await pay(page, page.getByRole('button', { name: 'שדרוג ל־Pro' }), 'תשלום (בדיקה)');
  await expect(page.getByTestId('billing-returned')).toContainText('התשלום התקבל');
  await expect(current).toContainText('Pro');
  await expect(current).toContainText('מתחדשת ב־');
  await expect(kpi(page, 'הזמנות פעילות')).toContainText('1 מתוך 5');
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('50');
  await expect(page.getByTestId('payments')).toContainText('חבילת Pro (חודשי)');
  expect((await create(page)).status).toBe(201);
  // the same plan again: nothing to buy
  expect((await api(page, '/api/billing/checkout', { product: 'pro' })).body).toMatchObject({
    code: 'already',
  });

  // a message pack
  await pay(page, page.locator('[data-pack="100"]').getByRole('button', { name: 'קנייה' }), 'תשלום (בדיקה)');
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('150');
  // a failed payment changes nothing
  await page.locator('[data-pack="300"]').getByRole('button', { name: 'קנייה' }).click();
  await page.waitForURL(/test-checkout/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'כישלון (בדיקה)' }).click();
  await page.waitForURL(/status=failure/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(page.getByTestId('billing-returned')).toContainText('התשלום לא עבר');
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('150');

  // next month: the plan renews with its credits
  expect((await api(page, '/api/billing/test-renew', { paid: true })).body).toMatchObject({
    ok: true,
    applied: true,
  });
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(kpi(page, 'קרדיטים לוואטסאפ')).toContainText('200');
  // the monthly charge is in the payments too
  await expect(page.getByTestId('payments')).toContainText('חידוש חודשי');

  // canceling: no more charges, the plan stays until the paid period ends
  await current.getByRole('button', { name: 'ביטול המנוי' }).click();
  const confirm = page.getByRole('dialog', { name: 'לבטל את המנוי?' });
  await confirm.getByRole('button', { name: 'ביטול המנוי' }).click();
  await expect(current).toContainText('בוטלה: פעילה עד');
  await expect(current).toContainText('Pro');
  expect((await api(page, '/api/billing/cancel', {})).status).toBe(409);

  if (!LOCAL) return;
  // a plan whose renewal never came, past the grace period: free again — and Pro can be bought again
  const client = new pg.Client({ connectionString: e2eDb() });
  await client.connect();
  try {
    await client.query(
      `update accounts set plan_status = 'active', plan_renews_at = now() - interval '20 days'
       where user_id = (select id from auth.users where email = $1)`,
      [email],
    );
  } finally {
    await client.end();
  }
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(current).toContainText('חינם');
  await pay(page, page.getByRole('button', { name: 'שדרוג ל־Pro' }), 'תשלום (בדיקה)');
  await expect(page.getByTestId('billing-returned')).toContainText('התשלום התקבל');
  await expect(current).toContainText('Pro');
});

test('the account: details, and deleting it deletes everything', async ({ page }) => {
  test.setTimeout(90_000);
  const email = await signUp(page);
  const created = await create(page);
  expect(created.status).toBe(201);
  // the account menu leads there
  await page.getByTestId('user-menu').click();
  await page.getByRole('menuitem', { name: 'החשבון שלי' }).click();
  await page.waitForURL(/\/app\/account$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  const form = page.getByTestId('profile-form');
  await form.getByRole('textbox', { name: 'שם מלא' }).fill('דנה לוי');
  await form.getByRole('textbox', { name: /^טלפון/ }).fill('12');
  await form.getByRole('button', { name: 'שמירה' }).click();
  await expect(form.getByText('מספר הטלפון לא תקין')).toBeVisible();
  await form.getByRole('textbox', { name: /^טלפון/ }).fill('050-1234567');
  await form.getByRole('button', { name: 'שמירה' }).click();
  await expect(page.locator('li').filter({ hasText: 'הפרטים נשמרו' })).toBeVisible();
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(form.getByRole('textbox', { name: /^טלפון/ })).toHaveValue('050-123-4567');

  await page.getByRole('button', { name: 'מחיקת החשבון' }).click();
  const dialog = page.getByRole('dialog', { name: 'למחוק את החשבון לצמיתות?' });
  const confirm = dialog.getByRole('button', { name: 'מחיקה לצמיתות' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('checkbox').click();
  await confirm.click();
  // on the sign-in page, which says so
  await page.waitForURL(/\/login\?deleted=1$/);
  await expect(page.getByTestId('auth-notice')).toContainText('החשבון נמחק');
  // signed out, and the account is gone
  await page.goto('/app/invitations');
  await page.waitForURL(/\/login/);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await expect(page.getByText('האימייל או הסיסמה לא נכונים')).toBeVisible();
  if (!LOCAL) return;
  const client = new pg.Client({ connectionString: e2eDb() });
  await client.connect();
  try {
    const rows = await client.query('select count(*)::int n from invitations where id = $1', [
      created.body.id,
    ]);
    expect(rows.rows[0].n).toBe(0);
  } finally {
    await client.end();
  }
});

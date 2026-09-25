import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// The partner API (Badook Events → here): opening a user with name, email and phone, the one-time
// sign-in link it returns (a page with a "Continue" button: opening it — as a mail scanner would —
// uses nothing; the click signs in, once), updating the same user, a new email, looking users up, and
// what it refuses: no key, a wrong key, an account someone opened by themselves, and links for a user
// who has taken over their own sign-in.

const LOCAL = !process.env.PW_BASE_URL;
/** Same value as INVITES_PARTNER_API_KEY in playwright.config.ts. */
const KEY = 'e2e-partner-key-0123456789abcdef0123';
const auth = { authorization: `Bearer ${KEY}` };

const provision = (request: APIRequestContext, data: Record<string, unknown>, headers = auth) =>
  request.post('/api/partner/v1/users', { data, headers });

/** Opens a sign-in link and clicks "Continue". */
async function continueWith(page: Page, loginUrl: string) {
  await page.goto(loginUrl);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'המשך ל־Badook' }).click();
}

test.describe('the partner API', () => {
  test.skip(!LOCAL, 'the key is the local stack’s');

  test('opens a user who comes in through the link — once — and can be updated and looked up', async ({
    page,
    request,
  }, testInfo) => {
    const tag = `${testInfo.project.name}-${Date.now()}`;
    const email = `partner-${tag}@example.com`;
    const externalId = `be-${tag}`;

    // no key, a wrong key
    expect((await provision(request, { email, fullName: 'x' }, {} as typeof auth)).status()).toBe(401);
    expect(
      (await provision(request, { email, fullName: 'x' }, { authorization: 'Bearer nope' })).status(),
    ).toBe(401);

    const res = await provision(request, {
      email,
      fullName: 'שירן אברהם',
      phone: '052-765-4321',
      externalId,
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { created: boolean; loginUrl: string; user: { userId: string } };
    expect(body).toMatchObject({
      ok: true,
      created: true,
      user: {
        email,
        fullName: 'שירן אברהם',
        phone: '+972527654321',
        plan: 'free',
        activeInvitations: 0,
        userManaged: false,
      },
    });
    expect(body.loginUrl).toContain('/auth/continue?token_hash=');

    // a mail scanner or a link preview opens the link: nothing is used
    expect((await request.get(body.loginUrl)).status()).toBe(200);
    // the click signs them in, into their invitations; the account shows what the partner sent
    await continueWith(page, body.loginUrl);
    await page.waitForURL(/\/app\/invitations$/);
    await page.goto('/app/account');
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByLabel('שם מלא')).toHaveValue('שירן אברהם');
    await expect(page.getByLabel('טלפון')).toHaveValue('052-765-4321');
    await expect(page.locator('main').getByText('Badook Events', { exact: true })).toBeVisible();

    // the same link a second time: no
    await page.context().clearCookies();
    await continueWith(page, body.loginUrl);
    await page.waitForURL(/\/login\?error=link_expired/);
    await expect(
      page.getByRole('alert').filter({ hasText: 'הקישור פג תוקף או שכבר השתמשו בו' }),
    ).toBeVisible();

    // the same person again: updated, same user; a fresh link by the partner's id
    const again = await provision(request, { email, fullName: 'שירן א.' });
    expect(again.status()).toBe(200);
    expect(await again.json()).toMatchObject({
      created: false,
      user: { userId: body.user.userId, fullName: 'שירן א.' },
    });
    const link = await request.post('/api/partner/v1/login-links', {
      data: { externalId, next: '/app/billing' },
      headers: auth,
    });
    expect(link.status()).toBe(200);
    await continueWith(page, ((await link.json()) as { loginUrl: string }).loginUrl);
    await page.waitForURL(/\/app\/billing$/);

    // the email changed in Badook Events: the same user, found by the new one
    const newEmail = `partner-new-${tag}@example.com`;
    const changed = await request.patch('/api/partner/v1/users', {
      data: { externalId, email: newEmail },
      headers: auth,
    });
    expect(await changed.json()).toMatchObject({
      ok: true,
      user: { userId: body.user.userId, email: newEmail },
    });
    const found = await request.get(`/api/partner/v1/users?email=${encodeURIComponent(newEmail)}`, {
      headers: auth,
    });
    expect(await found.json()).toMatchObject({
      ok: true,
      user: { userId: body.user.userId, email: newEmail },
    });

    // once they choose a password of their own, the partner hands out no more links
    await page.goto('/auth/update-password');
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await page.fill('input[name=password]', 'my-own-password');
    await page.click('form:has(input[name=password]) button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);
    const refused = await request.post('/api/partner/v1/login-links', {
      data: { externalId },
      headers: auth,
    });
    expect(refused.status()).toBe(409);
    expect(await refused.json()).toMatchObject({ ok: false, code: 'user_managed' });
    expect((await provision(request, { email: newEmail, fullName: 'X' })).status()).toBe(409);
  });

  test('a discount on one of its users’ plans: shown on their billing screen, bought and renewed at it', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    const tag = `${testInfo.project.name}-${Date.now()}`;
    const externalId = `be-d-${tag}`;
    const res = await provision(request, {
      email: `discount-${tag}@example.com`,
      fullName: 'מאיה',
      externalId,
      next: '/app/billing',
    });
    const { loginUrl } = (await res.json()) as { loginUrl: string };
    // 20% for purchases until the end of next year
    const until = `${new Date().getFullYear() + 1}-12-31`;
    const set = await request.post('/api/partner/v1/discounts', {
      data: { externalId, percent: 20, until, note: 'Badook Events customer' },
      headers: auth,
    });
    expect(set.status()).toBe(200);
    expect(await set.json()).toMatchObject({
      ok: true,
      user: { discount: { percent: 20, note: 'Badook Events customer' } },
    });

    await continueWith(page, loginUrl);
    await page.waitForURL(/\/app\/billing$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    const banner = page.getByTestId('discount');
    await expect(banner).toContainText('הנחה של 20% על החבילות');
    await expect(banner).toContainText('בזכות Badook Events');
    await expect(banner).toContainText(`לרכישה עד 31 בדצמבר ${until.slice(0, 4)}`);
    const pro = page.locator('[data-plan="pro"]');
    await expect(pro).toContainText('39.20');
    await expect(pro.getByTestId('list-price')).toContainText('49');
    // message packs are sold at cost: no discount
    await expect(page.locator('[data-pack="100"]')).toContainText('16');

    // Pro at the discounted price; the monthly renewal keeps it
    await pro.getByRole('button', { name: 'שדרוג ל־Pro' }).click();
    await page.waitForURL(/\/app\/billing\/test-checkout\?id=/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'תשלום (בדיקה)' }).click();
    await page.waitForURL(/\/app\/billing\?status=/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByTestId('current-plan')).toContainText('Pro');
    await expect(page.getByTestId('plan-price')).toContainText('39.20');
    const renewed = await page.evaluate(async () => {
      const r = await fetch('/api/billing/test-renew', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      });
      return r.status;
    });
    expect(renewed).toBe(200);
    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    const payments = page.getByTestId('payments');
    await expect(payments.locator('li')).toHaveCount(2);
    await expect(payments.locator('li').filter({ hasText: '39.20' })).toHaveCount(2);

    // removed: gone from the screen, and the plan bought with it keeps its price
    const removed = await request.delete(
      `/api/partner/v1/discounts?externalId=${encodeURIComponent(externalId)}`,
      {
        headers: auth,
      },
    );
    expect(await removed.json()).toMatchObject({ ok: true, user: { discount: null } });
    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByTestId('discount')).toHaveCount(0);
    await expect(page.getByTestId('plan-price')).toContainText('39.20');
    // someone else's account: no
    expect(
      (
        await request.post('/api/partner/v1/discounts', {
          data: { userId: '00000000-0000-4000-8000-000000000000', percent: 10 },
          headers: auth,
        })
      ).status(),
    ).toBe(404);
  });

  test('an account opened by its owner stays theirs', async ({ page, request }, testInfo) => {
    const email = `own-${testInfo.project.name}-${Date.now()}@example.com`;
    await page.goto('/signup');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'a-good-password');
    await page.click('form:has(input[name=password]) button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);

    const res = await provision(request, { email, fullName: 'Someone Else' });
    expect(res.status()).toBe(409);
    expect(await res.json()).toEqual({ ok: false, code: 'account_exists' });
    expect(
      (
        await request.get(`/api/partner/v1/users?email=${encodeURIComponent(email)}`, { headers: auth })
      ).status(),
    ).toBe(404);
    // and a partner id that is already another user's leaves nothing behind: the retry works
    const tag = `${testInfo.project.name}-${Date.now()}`;
    const first = await provision(request, {
      email: `a-${tag}@example.com`,
      fullName: 'A',
      externalId: `be-x-${tag}`,
    });
    expect(first.status()).toBe(201);
    const clash = await provision(request, {
      email: `b-${tag}@example.com`,
      fullName: 'B',
      externalId: `be-x-${tag}`,
    });
    expect(await clash.json()).toEqual({ ok: false, code: 'external_id_taken' });
    const retry = await provision(request, {
      email: `b-${tag}@example.com`,
      fullName: 'B',
      externalId: `be-y-${tag}`,
    });
    expect(retry.status()).toBe(201);
  });
});

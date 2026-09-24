import { expect, test, type APIRequestContext } from '@playwright/test';

// The partner API (Badook Events → here): opening a user with name, email and phone, the one-time
// sign-in link it returns (used once), updating the same user, looking users up, and what it refuses:
// no key, a wrong key, and an account someone opened by themselves.

const LOCAL = !process.env.PW_BASE_URL;
/** Same value as INVITES_PARTNER_API_KEY in playwright.config.ts. */
const KEY = 'e2e-partner-key-0123456789abcdef0123';
const auth = { authorization: `Bearer ${KEY}` };

const provision = (request: APIRequestContext, data: Record<string, unknown>, headers = auth) =>
  request.post('/api/partner/v1/users', { data, headers });

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
      user: { email, fullName: 'שירן אברהם', phone: '+972527654321', plan: 'free', activeInvitations: 0 },
    });

    // the link signs them in, into their invitations; the account shows what the partner sent
    await page.goto(body.loginUrl);
    await page.waitForURL(/\/app\/invitations$/);
    await page.goto('/app/account');
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByLabel('שם מלא')).toHaveValue('שירן אברהם');
    await expect(page.getByLabel('טלפון')).toHaveValue('052-765-4321');
    await expect(page.locator('main').getByText('Badook Events', { exact: true })).toBeVisible();

    // the same link a second time: no
    await page.context().clearCookies();
    await page.goto(body.loginUrl);
    await page.waitForURL(/\/login\?error=link_invalid/);

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
    await page.goto(((await link.json()) as { loginUrl: string }).loginUrl);
    await page.waitForURL(/\/app\/billing$/);

    const found = await request.get(`/api/partner/v1/users?externalId=${encodeURIComponent(externalId)}`, {
      headers: auth,
    });
    expect(await found.json()).toMatchObject({ ok: true, user: { userId: body.user.userId, email } });
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
  });
});

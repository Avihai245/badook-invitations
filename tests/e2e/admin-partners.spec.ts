import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { LOCAL, sql } from '../support/phase5b';
import { audit, openConsole, signInStaff, uiLanguage, unique, waitLive } from '../support/admin-c';

// The admin console's Badook Events area (/app/admin/partners, features/admin/partners): an account
// Badook Events opens through its API — saying which of its users opened it (createdBy) and for which
// venue — shows up by itself on the open page, with who opened it, its venue and the API's record; a
// viewer sees it without contact details; the page passes an accessibility audit in Hebrew and English
// (both projects: phone, desktop). The user's own page shows the same source once the users area has it.

test.skip(!LOCAL, 'the partner key is the local stack’s');

/** Same value as INVITES_PARTNER_API_KEY in playwright.config.ts. */
const KEY = 'e2e-partner-key-0123456789abcdef0123';
const auth = { authorization: `Bearer ${KEY}` };

/** Badook Events opens a venue with its owner, and a customer for it — by one of its managers. */
async function openThroughBadookEvents(request: APIRequestContext, tag: string) {
  const venue = `hall-${tag}`;
  const put = await request.put(`/api/partner/v1/venues/${venue}`, {
    data: {
      name: `אולם ${tag}`,
      address: 'הרצל 1, ראשון לציון',
      owner: { id: `be-owner-${tag}`, name: 'משה לוי', role: 'owner' },
    },
    headers: auth,
  });
  expect(put.status()).toBe(201);
  const res = await request.post('/api/partner/v1/users', {
    data: {
      email: `p-${tag}@example.com`,
      fullName: `לקוחה ${tag}`,
      phone: '052-765-4321',
      externalId: `be-${tag}`,
      venueId: venue,
      createdBy: {
        id: `be-u-${tag}`,
        name: `רונית ${tag}`,
        email: `ronit-${tag}@venue.example.com`,
        role: 'manager',
      },
    },
    headers: auth,
  });
  expect(res.status()).toBe(201);
  return { venue, userId: ((await res.json()) as { user: { userId: string } }).user.userId };
}

const account = (page: Page, userId: string) => page.locator(`[data-account="${userId}"]:visible`);

test.describe('Badook Events in the console', () => {
  test('an account opened through the API shows up by itself: who opened it, the venue, the API’s record', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const tag = unique('bep');
    await signInStaff(page, 'support');
    await openConsole(page, `/app/admin/partners?q=${encodeURIComponent(tag)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Badook Events' })).toBeVisible();
    await waitLive(page);
    await expect(page.getByTestId('accounts-summary')).toContainText('0');
    await page.evaluate(() => ((window as unknown as { __stay: boolean }).__stay = true));

    // Badook Events' server opens the account (another client altogether)
    const { venue, userId } = await openThroughBadookEvents(request, tag);

    // the open page, without reloading: the account, who opened it and the venue
    const row = account(page, userId);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(`לקוחה ${tag}`);
    await expect(row).toContainText(`רונית ${tag}`);
    await expect(row).toContainText(`אולם ${tag}`);
    await expect(row).toContainText(`p-${tag}@example.com`);
    expect(await page.evaluate(() => (window as unknown as { __stay?: boolean }).__stay)).toBe(true);
    const opener = page.locator(`[data-opener="be-u-${tag}"]`);
    await expect(opener).toContainText(`רונית ${tag}`);
    await expect(opener).toContainText('(manager)');
    await expect(opener).toContainText(`ronit-${tag}@venue.example.com`);
    const hall = page.locator(`[data-venue="${venue}"]`);
    await expect(hall).toContainText('משה לוי');
    await expect(hall).toContainText('אין');
    // the API's record of the calls
    await expect(page.getByTestId('api-health')).toContainText('PUT /venues/{venueId}');
    await expect
      .poll(async () =>
        (
          await sql<{ status: number }>(
            `select status from public.partner_api_calls where user_id = $1 and endpoint = '/users' and method = 'POST'`,
            [userId],
          )
        ).map((c) => c.status),
      )
      .toEqual([201]);

    // the user's own page (the users area) shows where the account came from
    const userPage = await page.goto(`/app/admin/users/${userId}`);
    if (userPage?.status() === 200) {
      const source = page.getByTestId('partner-source');
      await expect(source).toContainText(`נפתח דרך Badook Events על ידי רונית ${tag} (manager)`);
      await expect(source).toContainText(`אולם אולם ${tag}`);
      await expect(source).toContainText(`be-${tag}`);
      // and follows a change made there: another venue, by the partner
      const moved = await request.put(`/api/partner/v1/venues/${venue}-2`, {
        data: { name: `אולם שני ${tag}` },
        headers: auth,
      });
      expect(moved.status()).toBe(201);
      await request.patch('/api/partner/v1/users', {
        data: { externalId: `be-${tag}`, venueId: `${venue}-2`, createdBy: { id: `be-u-${tag}` } },
        headers: auth,
      });
      await expect(source).toContainText(`אולם אולם שני ${tag}`, { timeout: 20_000 });
    } else
      test.info().annotations.push({ type: 'note', description: 'the users area has no user page here' });
  });

  test('a viewer sees the accounts without contact details', async ({ page, request }) => {
    test.setTimeout(90_000);
    const tag = unique('bepv');
    const { userId } = await openThroughBadookEvents(request, tag);
    await signInStaff(page, 'viewer');
    await openConsole(page, `/app/admin/partners?q=${encodeURIComponent(tag)}`);
    const row = account(page, userId);
    await expect(row).toContainText(`לקוחה ${tag}`);
    await expect(row).toContainText('p***@example.com');
    await expect(page.locator(`[data-opener="be-u-${tag}"]`)).toContainText('r***@venue.example.com');
    const html = await page.content();
    expect(html).not.toContain(`p-${tag}@example.com`);
    expect(html).not.toContain(`ronit-${tag}@venue.example.com`);
    expect(html).not.toContain('527654321');
    // an email the viewer doesn't see finds nothing
    await openConsole(page, `/app/admin/partners?q=${encodeURIComponent(`p-${tag}@`)}`);
    await expect(page.getByTestId('accounts-summary')).toContainText('0');
  });

  for (const lang of ['he', 'en'] as const)
    test(`passes an accessibility audit · ${lang}`, async ({ page, request }) => {
      test.setTimeout(90_000);
      const tag = unique('bepa');
      await openThroughBadookEvents(request, tag);
      await signInStaff(page, 'owner');
      await uiLanguage(page, lang);
      await openConsole(page, '/app/admin/partners');
      await expect(page.getByTestId('admin-partners')).toBeVisible();
      await audit(page, `partners-${lang}`);
      await page.locator('#api summary').click();
      await audit(page, `partners-${lang}-table`);
    });
});

import { expect, test } from '@playwright/test';
import {
  audit,
  createInvitation,
  customer,
  live,
  mark,
  noSideScroll,
  numberIn,
  open,
  publish,
  reply,
  shot,
  staffMember,
  stillMarked,
  uiLang,
} from '../support/admin';

// The admin console's overview (/app/admin): the business now — its numbers by period, the last 30
// days, the live feed — and it follows the system by itself: what another browser does shows up on the
// open page without a reload.

test.describe('the admin console’s overview', () => {
  test('a new customer, their invitation and a guest’s reply show up live, without a reload', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await staffMember(page, 'owner', 'אביחי');
    await open(page, '/app/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'סקירה' })).toBeVisible();
    await live(page);
    await page.getByRole('radio', { name: '30 ימים' }).click();
    await expect(page.getByTestId('admin-kpis')).toHaveAttribute('data-period', 'd30');
    const invitations = await numberIn(page, 'kpi-invitations');
    const rsvps = await numberIn(page, 'kpi-rsvps');
    const users = await numberIn(page, 'kpi-users');
    await mark(page);

    // another browser: a customer signs up, creates a wedding, it goes live, a guest replies
    const bride = `כלה${Date.now().toString(36)}`;
    const host = await customer(browser, 'דנה בדיקה');
    const invitation = await createInvitation(host.page, bride, 'חתן');
    await publish(invitation.id);
    await reply(host.page, invitation.slug, 2);

    const feed = page.getByTestId('admin-feed');
    const title = `${bride} & חתן`;
    await expect(feed.getByText(`הזמנה חדשה: ${title}`)).toBeVisible({ timeout: 25_000 });
    await expect(feed.getByText(`אישור הגעה ל־${title}: 2 מגיעים`)).toBeVisible({ timeout: 25_000 });
    await expect(feed.getByText('הרשמה חדשה: דנה בדיקה · במייל')).toBeVisible();
    await expect.poll(() => numberIn(page, 'kpi-invitations')).toBeGreaterThanOrEqual(invitations + 1);
    await expect.poll(() => numberIn(page, 'kpi-rsvps')).toBeGreaterThanOrEqual(rsvps + 1);
    await expect.poll(() => numberIn(page, 'kpi-users')).toBeGreaterThanOrEqual(users + 1);
    // all of it without a reload
    expect(await stillMarked(page)).toBe(true);

    // no contact details in the feed
    await expect(feed).not.toContainText(host.email);
    // a line leads to what it is about
    await feed.getByRole('link', { name: new RegExp(`הזמנה חדשה: ${bride}`) }).click();
    await page.waitForURL(new RegExp(`/app/admin/invitations/${invitation.id}$`));
    await expect(page.getByTestId('admin-invitation-title')).toHaveText(title);
    await host.context.close();
  });

  test('the charts are there for screen readers too; the chosen period is remembered', async ({ page }) => {
    await staffMember(page, 'viewer');
    await open(page, '/app/admin');
    for (const chart of ['signups', 'invitations', 'rsvps', 'messages']) {
      const figure = page.getByTestId(`chart-${chart}`);
      await expect(figure.getByRole('group')).toBeVisible();
      // 30 days, one row each
      await expect(figure.locator('table tbody tr')).toHaveCount(30);
    }
    // the keyboard moves through the days and says each one
    const signups = page.getByTestId('chart-signups').getByRole('group');
    await signups.focus();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('chart-signups').locator('p[aria-live]')).not.toBeEmpty();
    await page.getByRole('radio', { name: 'היום' }).click();
    await page.reload();
    await expect(page.getByTestId('admin-kpis')).toHaveAttribute('data-period', 'today');
  });

  test('in Hebrew and English: accessible, and nothing overflows the page', async ({ page }) => {
    await staffMember(page, 'owner');
    for (const lang of ['he', 'en'] as const) {
      await uiLang(page, lang);
      await open(page, '/app/admin');
      await expect(page.getByTestId('admin-kpis')).toBeVisible();
      await expect(page.getByTestId('admin-feed')).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-overview-${lang}`);
      await shot(page, `${lang}-overview`, true);
    }
  });
});

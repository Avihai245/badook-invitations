import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  createInvitation,
  customer,
  hydrated,
  publish,
  reply,
  signUpAs,
  staffMember,
  unique,
} from '../support/admin';
import { setPlan } from '../support/phase5b';

/**
 * The system's look (features/site/theme.ts): light, dark or as the device is set — chosen in the
 * sidebar (from 1024px) or the account menu (phones), kept in the browser, on <html> before the first
 * paint, and only in the signed-in system (/app); the public pages keep their own design. Every screen
 * of the app and of the admin console in the dark look: WCAG 2.1 AA (contrast included) and, on a
 * phone, nothing wider than the screen. The legal pages: on every page, once.
 *
 * QA_THEMES=light,dark runs the screens in both looks; QA_SHOTS=1 keeps a screenshot of each
 * (tests/.artifacts/theme-shots).
 */

const THEME_KEY = 'badook:theme';
const THEMES = (process.env.QA_THEMES ?? 'dark').split(',') as ('light' | 'dark')[];
const SHOTS = process.env.QA_SHOTS ? 'tests/.artifacts/theme-shots' : null;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const phone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const themeOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

/** The look this browser chose (as the switch keeps it), from its next page on. */
async function choose(page: Page, pref: 'light' | 'dark' | 'system') {
  await page.addInitScript(([key, value]) => localStorage.setItem(key!, value!), [THEME_KEY, pref]);
}

/** Once the page has settled (no running animation), what WCAG 2.1 AA finds on it. */
async function violations(page: Page) {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      null,
      { timeout: 4_000 },
    )
    .catch(() => undefined);
  const results = await new AxeBuilder({ page })
    .options({ resultTypes: ['violations'] })
    .withTags(TAGS)
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    help: v.help,
    targets: v.nodes
      .slice(0, 6)
      .map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1] ?? ''}`),
  }));
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({
    path: `${SHOTS}/${phone(page) ? 'phone' : 'desktop'}-${name}.png`,
    fullPage: true,
  });
}

/** Each screen in `theme`: the look on <html> from the first paint, AA, no sideways scroll on a phone. */
async function sweep(page: Page, theme: 'light' | 'dark', screens: [string, string][]) {
  for (const [name, url] of screens) {
    await page.goto(url, { waitUntil: 'commit' });
    // before React: the head's script set it
    await page.waitForLoadState('domcontentloaded');
    expect.soft(await themeOf(page), `${name}: the look before hydration`).toBe(theme);
    await hydrated(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await shot(page, `${theme}-${name}`);
    expect.soft(await violations(page), `${name} (${theme}): WCAG 2.1 AA`).toEqual([]);
    if (phone(page)) {
      // the project's phone (390) and the narrowest common one (360)
      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect.soft(overflow, `${name}: scrolls sideways at ${width}px`).toBeLessThanOrEqual(1);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
  }
}

test.describe('the system’s look', () => {
  test('chosen in the app, kept, applied before the first paint — and only in the app', async ({ page }) => {
    await signUpAs(page, unique('theme-pick'), 'Dana Levi');
    expect(await themeOf(page)).toBe('light');

    if (phone(page)) {
      // phones: in the account menu (the sidebar's switch is a computer's)
      await page.getByTestId('user-menu').click();
      await page.getByRole('menuitemradio', { name: 'כהה' }).click();
      await expect(page.getByRole('menuitemradio', { name: 'כהה' })).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('Escape');
    } else {
      const look = page.getByRole('radiogroup', { name: 'מראה' });
      await look.getByRole('radio', { name: 'כהה' }).click();
      await expect(look.getByRole('radio', { name: 'כהה' })).toHaveAttribute('aria-checked', 'true');
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(18, 16, 14)',
    );

    // kept: the next visit is dark from its first paint
    await page.goto('/app/billing', { waitUntil: 'commit' });
    await page.waitForLoadState('domcontentloaded');
    expect(await themeOf(page)).toBe('dark');
    await hydrated(page);

    // the public pages keep their design; back in the app, dark again
    await page.goto('/privacy');
    await hydrated(page);
    expect(await themeOf(page)).toBe('light');
    await page.goto('/app/invitations');
    await hydrated(page);
    expect(await themeOf(page)).toBe('dark');

    // as the device is set: follows it, and its changes
    await page.evaluate((key) => localStorage.setItem(key, 'system'), THEME_KEY);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await hydrated(page);
    expect(await themeOf(page)).toBe('light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // printing is always light (seating plans, table cards)
    await page.emulateMedia({ media: 'print' });
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(250, 250, 249)',
    );
  });

  test('the legal pages: on every page of the app, once', async ({ page }) => {
    await signUpAs(page, unique('theme-legal'), 'Dana Levi');
    const legal = page.getByRole('navigation', { name: 'מידע ומדיניות' });
    // one place on each screen size: the sidebar's foot, or the phones' page foot
    await expect(legal).toHaveCount(1);
    await legal.scrollIntoViewIfNeeded();
    await expect(legal).toBeVisible();
    for (const name of ['מדיניות פרטיות', 'תנאי שימוש', 'מדיניות עוגיות', 'הצהרת נגישות'])
      await expect(legal.getByRole('link', { name })).toBeVisible();
    // not again in the account menu
    await page.getByTestId('user-menu').click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'מדיניות פרטיות' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // before any purchase: what it is subject to, with the cancelling section itself
    await page.goto('/app/billing');
    await hydrated(page);
    await expect(
      page.getByTestId('billing-terms').getByRole('link', { name: 'ביטול עסקה והחזרים' }),
    ).toHaveAttribute('href', '/terms#cancel');
  });

  for (const theme of THEMES) {
    test(`every screen of the app — ${theme}`, async ({ page }) => {
      test.setTimeout(300_000);
      await choose(page, theme);
      const email = unique('theme-host');
      await signUpAs(page, email, 'Dana Levi');
      await setPlan(email, 'business');
      const inv = await createInvitation(page, 'נועה', 'איתי');
      await publish(inv.id);
      for (const adults of [2, 0, 3]) await reply(page, inv.slug, adults);
      const ticket = await page.request.post('/api/support/tickets', {
        data: {
          subject: 'הסרטון ברקע לא מתנגן בטלפון',
          category: 'bug',
          body: 'בדקתי בשני טלפונים, הסרטון מופיע כתמונה בלבד.',
          invitationId: inv.id,
          locale: 'he',
          source: 'app',
        },
      });
      expect(ticket.ok(), await ticket.text()).toBe(true);
      const { ticket: t } = (await ticket.json()) as { ticket: { id: string } };
      const base = `/app/invitations/${inv.id}`;
      await sweep(page, theme, [
        ['list', '/app/invitations'],
        ['new', '/app/invitations/new'],
        ['overview', base],
        ['responses', `${base}/responses`],
        ['guests', `${base}/guests`],
        ['share', `${base}/share`],
        ['seating', `${base}/seating`],
        ['gallery', `${base}/gallery`],
        ['film', `${base}/gallery/film`],
        ['live', `${base}/live`],
        ['insights', `${base}/insights`],
        ['editor', `${base}/edit`],
        ['billing', '/app/billing'],
        ['account', '/app/account'],
        ['support', '/app/support'],
        ['support-new', '/app/support/new'],
        ['ticket', `/app/support/${t.id}`],
      ]);
    });

    test(`every screen of the admin console — ${theme}`, async ({ page, browser }) => {
      test.setTimeout(300_000);
      const host = await customer(browser, 'Dana Levi');
      const inv = await createInvitation(host.page, 'נועה', 'איתי');
      await publish(inv.id);
      await reply(host.page, inv.slug, 2);
      const opened = await host.page.request.post('/api/support/tickets', {
        data: {
          subject: 'שאלה על החבילה',
          category: 'billing',
          body: 'איך מחליפים חבילה?',
          locale: 'he',
          source: 'app',
        },
      });
      expect(opened.ok(), await opened.text()).toBe(true);
      const { ticket } = (await opened.json()) as { ticket: { id: string } };
      await host.context.close();

      await choose(page, theme);
      await staffMember(page, 'owner');
      await sweep(page, theme, [
        ['admin-overview', '/app/admin'],
        ['admin-users', '/app/admin/users'],
        ['admin-user', `/app/admin/users/${host.userId}`],
        ['admin-invitations', '/app/admin/invitations'],
        ['admin-invitation', `/app/admin/invitations/${inv.id}`],
        ['admin-messages', '/app/admin/messages'],
        ['admin-finance', '/app/admin/finance'],
        ['admin-support', '/app/admin/support'],
        ['admin-ticket', `/app/admin/support/${ticket.id}`],
        ['admin-partners', '/app/admin/partners'],
        ['admin-staff', '/app/admin/staff'],
        ['admin-audit', '/app/admin/audit'],
        ['admin-system', '/app/admin/system'],
      ]);
    });
  }
});

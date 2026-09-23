import { expect, test, type Page } from '@playwright/test';
import { TEMPLATE_IDS } from '../../src/features/invitations/templates/registry';

// P0 smoke: the kitchen sink renders every template × locale cleanly (run against a production build
// with INVITES_DEV_ROUTES=true — see playwright.config.ts). The pixel comparison against the design
// reference lives in scripts/qa-screens.ts.

const NOW = '2026-09-23T10:00:00Z';
const render = (id: string, locale: string, doc = 'demo', query = 'open=1') =>
  `/dev/invitations/render/${id}/${locale}/${doc}?${query}&now=${NOW}`;

/** Navigates and waits until React has hydrated — before that, controls are plain HTML. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

/** Console errors + uncaught exceptions (hydration mismatches are console errors). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test.describe('invitation renders', () => {
  for (const id of TEMPLATE_IDS) {
    for (const locale of ['he', 'en'] as const) {
      test(`${id} · ${locale}`, async ({ page }) => {
        const errors = collectErrors(page);
        await page.goto(render(id, locale));
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
        await expect(page.locator('.hero .names')).toBeVisible();
        await expect(page.locator('main > section, main > footer').first()).toBeAttached();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }
});

test('cover opens and unlocks scrolling', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, render('sahar-bordeaux', 'he', 'wedding-he-en', 'x=1'));
  const cover = page.locator('.cover > button[aria-label]');
  await expect(cover).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/locked/);
  await cover.click();
  await expect(page.locator('html')).toHaveAttribute('data-opened', '1');
  await expect(page.locator('.cover')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('body')).not.toHaveClass(/locked/);
  expect(errors).toEqual([]);
});

test('RSVP form validates, then submits (simulated in the kitchen sink)', async ({ page }) => {
  await open(page, render('sahar-bordeaux', 'en', 'wedding-he-en'));
  const form = page.locator('.form');
  await form.locator('.opt').first().click();
  await form.locator('button.btn-primary').click();
  await expect(form.locator('.msg[role="alert"]').first()).toBeVisible();
  await form.locator('[id$="-a0.firstName"]').fill('Dana');
  await form.locator('[id$="-a0.lastName"]').fill('Levi');
  await form.locator('[id$="-a0.phone"]').fill('050-123-4567');
  await form.locator('button.btn-primary').click();
  await expect(page.locator('.success[role="status"]')).toBeVisible({ timeout: 5000 });
});

test('flip-card timeline flips on tap and from the keyboard', async ({ page }) => {
  await open(page, render('sahar-bordeaux', 'en', 'demo', 'open=1&tl=flip-cards'));
  const cards = page.locator('.flip');
  await cards.first().click();
  await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
  await cards.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('horizontal timeline puts the time pill above the dot (≥ 640px)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'horizontal layout starts at 640px');
  await page.goto(render('sahar-bordeaux', 'en', 'demo', 'open=1&tl=horizontal-icons'));
  const item = page.locator('.tl.h li').first();
  const pill = await item.locator('.pill').boundingBox();
  const dot = await item.locator('.dot').boundingBox();
  expect(pill && dot && pill.y + pill.height <= dot.y).toBe(true);
});

test('kitchen sink index lists every template × locale', async ({ page }) => {
  await page.goto('/dev/invitations');
  await expect(page.locator('iframe')).toHaveCount(TEMPLATE_IDS.length * 2);
  await page.goto('/dev/invitations?doc=babyshower-en');
  await expect(page.locator('iframe')).toHaveCount(TEMPLATE_IDS.length);
  await expect(page.getByText('no he in this document')).toHaveCount(TEMPLATE_IDS.length);
});

test('host-app UI showcase renders in he and en without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/dev/app-ui');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('main')).toBeVisible();
  await page.goto('/dev/app-ui?lang=en');
  await expect(page.locator('[dir="ltr"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

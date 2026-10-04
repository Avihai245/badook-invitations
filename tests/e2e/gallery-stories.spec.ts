import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { LOCAL, galleryOn, newHost, seedPhotos } from '../support/phase5b';

// The guests' page of the live gallery as stories: a circle for each person who shared, a full-screen
// viewer that plays one person's photos and then the next, the ring turning grey once watched (kept on
// the phone), the Badook logo at the bottom, and English. With STORIES_SHOTS=1 it also photographs the
// page for design QA into tests/.artifacts/qa/gallery/.

test.skip(!LOCAL, 'seeds photos straight into the local database and storage');
test.setTimeout(150_000);

const OUT = 'tests/.artifacts/qa/gallery';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Dana ×3, Yoav ×2 (wide), and two guests who gave no name: Dana shared first, "Guest 2" last. */
async function seeded(page: Page) {
  const host = await newHost(page, 'stories', 'pro', { date: day(30) });
  const link = await galleryOn(page, host.id);
  await seedPhotos(host.id, [
    { color: [70, 110, 170], who: 'dana', name: 'דנה', minute: 1 },
    { color: [190, 120, 90], who: 'dana', name: 'דנה', minute: 4 },
    { color: [90, 150, 110], who: 'dana', name: 'דנה', minute: 9 },
    { color: [170, 90, 140], who: 'yoav', name: 'יואב', minute: 12, width: 1600, height: 1000 },
    { color: [120, 120, 190], who: 'yoav', name: 'יואב', minute: 15, width: 1600, height: 1000 },
    { color: [200, 170, 80], who: 'one', name: null, minute: 20 },
    { color: [100, 170, 170], who: 'two', name: null, minute: 25 },
  ]);
  return { host, link };
}

async function guestPage(
  browser: import('@playwright/test').Browser,
  project: { use: Record<string, unknown> },
  link: string,
  query = '',
) {
  const use = project.use as {
    viewport?: { width: number; height: number };
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
    userAgent?: string;
  };
  const context = await browser.newContext({
    viewport: use.viewport,
    deviceScaleFactor: use.deviceScaleFactor,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    userAgent: use.userAgent,
    locale: 'he-IL',
  });
  const page = await context.newPage();
  await page.goto(`${link}${query}`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  return { page, context };
}

const shot = async (page: Page, name: string, fullPage = true) => {
  if (!process.env.STORIES_SHOTS) return;
  mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
};

test('each person who shared is a circle; a tap plays their story, then the next person’s; the ring turns grey and stays so', async ({
  page,
  browser,
}, testInfo) => {
  const { link } = await seeded(page);
  const { page: guest, context } = await guestPage(browser, testInfo.project, link);
  const tag = testInfo.project.name;

  // the tray: one circle for each of the four people, the newest activity first, all of them new
  const tray = guest.getByTestId('gallery-stories');
  await expect(tray).toBeVisible();
  await expect(tray.locator('[data-story]')).toHaveCount(4);
  await expect(tray.getByRole('button', { name: 'צפייה בסטורי של דנה: 3 פריטים, חדש' })).toBeVisible();
  await expect(tray.getByRole('button', { name: 'צפייה בסטורי של יואב: 2 פריטים, חדש' })).toBeVisible();
  await expect(tray.getByRole('button', { name: /אורח\/ת 1: פריט אחד/ })).toBeVisible();
  await expect(tray.getByRole('button', { name: /אורח\/ת 2: פריט אחד/ })).toBeVisible();
  // the numbers say how much was shared and by how many
  await expect(guest.getByTestId('gallery-people')).toContainText('4 אורחים שיתפו');
  // the grid of everything is still there under the stories
  await expect(guest.getByTestId('gallery-feed').locator('[data-item]')).toHaveCount(7);
  await shot(guest, `he-${tag}-1-page`);

  // Yoav's story: his two photos, in the order he shared them
  await tray.getByRole('button', { name: /יואב/ }).click();
  const viewer = guest.getByTestId('story-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('aria-label', 'הסטורי של יואב');
  await expect(viewer.getByTestId('story-progress').locator('[data-state]')).toHaveCount(2);
  await expect(viewer.getByTestId('story-progress').locator('[data-state="active"]')).toHaveCount(1);
  await expect(viewer.locator('img[src*="display.jpg"]')).toBeVisible();
  await shot(guest, `he-${tag}-2-story`, false);

  // a tap at the end side (the left, in Hebrew) goes on; at the start side (the right) goes back
  const stage = await viewer.locator('> div').first().boundingBox();
  expect(stage).not.toBeNull();
  const y = stage!.y + stage!.height * 0.5;
  await guest.mouse.click(stage!.x + stage!.width * 0.2, y);
  await expect(viewer.getByText('פריט 2 מתוך 2')).toBeAttached();
  await guest.mouse.click(stage!.x + stage!.width * 0.9, y);
  await expect(viewer.getByText('פריט 1 מתוך 2')).toBeAttached();

  // the arrow keys go on; after Yoav's last comes the next person (Dana: the order the viewer opened in)
  await guest.keyboard.press('ArrowLeft');
  await expect(viewer.getByText('פריט 2 מתוך 2')).toBeAttached();
  await guest.keyboard.press('ArrowLeft');
  await expect(viewer).toHaveAttribute('aria-label', 'הסטורי של דנה');
  await expect(viewer.getByTestId('story-progress').locator('[data-state]')).toHaveCount(3);

  // Escape leaves: Yoav's ring is grey (his last photo was on screen), Dana's is still new
  await guest.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(tray.locator('[data-story][data-unseen]')).toHaveCount(3);
  await expect(tray.getByRole('button', { name: /יואב/ })).not.toHaveAttribute('data-unseen', '');
  await expect(tray.getByRole('button', { name: /דנה/ })).toHaveAttribute('data-unseen', '');

  // the phone remembers
  await guest.reload();
  await guest.getByRole('heading', { level: 1 }).waitFor();
  await expect(guest.getByTestId('gallery-stories').locator('[data-story][data-unseen]')).toHaveCount(3);
  await expect(
    guest.getByTestId('gallery-stories').getByRole('button', { name: /יואב/ }),
  ).not.toHaveAttribute('data-unseen', '');
  await shot(guest, `he-${tag}-3-watched`, false);

  // swiping down (or the close button) leaves the viewer too
  await guest.getByTestId('gallery-stories').getByRole('button', { name: /דנה/ }).click();
  await expect(viewer).toBeVisible();
  await viewer.getByRole('button', { name: 'סגירה' }).click();
  await expect(viewer).toBeHidden();
  await context.close();
});

test('the page ends with the Badook logo, and everything is in English for an English guest', async ({
  page,
  browser,
}, testInfo) => {
  const { link } = await seeded(page);
  const tag = testInfo.project.name;
  const { page: guest, context } = await guestPage(browser, testInfo.project, link, '&lang=en');

  await expect(guest.getByRole('heading', { name: 'Event stories' })).toBeVisible();
  await expect(guest.getByRole('heading', { name: 'All photos & videos' })).toBeVisible();
  await expect(guest.getByTestId('gallery-people')).toContainText('4 guests shared');
  await expect(guest.getByTestId('gallery-stories').getByRole('button', { name: /Guest 1/ })).toBeVisible();
  await expect(guest.locator('html')).toHaveAttribute('dir', 'ltr');

  // the logo, last on the page, linking to Badook
  const brand = guest.getByTestId('gallery-brand');
  await brand.scrollIntoViewIfNeeded();
  await expect(brand.locator('img').first()).toBeVisible();
  await expect(brand).toHaveAttribute('href', '/');
  await expect(brand.locator('img').first()).toHaveAttribute('src', /badook-logo/);
  const box = await brand.boundingBox();
  const footer = await guest.locator('footer').boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(footer!.y + footer!.height + 1);
  await shot(guest, `en-${tag}-1-page`);

  // the names stay as the guests typed them; Dana, the first to share, is the last circle
  await guest.getByTestId('gallery-stories').locator('[data-story]').last().click();
  const viewer = guest.getByTestId('story-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Pause' })).toBeVisible();
  // English reads left to right: the arrow to the right goes on
  await guest.keyboard.press('ArrowRight');
  await expect(viewer.getByText(/Item 2 of/)).toBeAttached();
  await shot(guest, `en-${tag}-2-story`, false);
  await context.close();
});

test('with no photos yet there are no stories, just the invitation to share', async ({
  page,
  browser,
}, testInfo) => {
  const host = await newHost(page, 'stories-empty', 'pro', { date: day(30) });
  const link = await galleryOn(page, host.id);
  const { page: guest, context } = await guestPage(browser, testInfo.project, link);
  await expect(guest.getByText('עוד אין כאן תמונות. היו הראשונים לשתף!')).toBeVisible();
  await expect(guest.getByTestId('gallery-stories')).toHaveCount(0);
  await expect(guest.getByTestId('gallery-people')).toHaveCount(0);
  await expect(guest.getByTestId('gallery-brand')).toBeVisible();
  await shot(guest, `he-${testInfo.project.name}-0-empty`);
  await context.close();
});

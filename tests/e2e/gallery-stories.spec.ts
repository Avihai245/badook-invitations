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
  const story = 'story' as const;
  await seedPhotos(host.id, [
    { color: [70, 110, 170], who: 'dana', name: 'דנה', minute: 1, placement: story },
    { color: [190, 120, 90], who: 'dana', name: 'דנה', minute: 4, placement: story },
    { color: [90, 150, 110], who: 'dana', name: 'דנה', minute: 9, placement: story },
    {
      color: [170, 90, 140],
      who: 'yoav',
      name: 'יואב',
      minute: 12,
      width: 1600,
      height: 1000,
      placement: story,
    },
    {
      color: [120, 120, 190],
      who: 'yoav',
      name: 'יואב',
      minute: 15,
      width: 1600,
      height: 1000,
      placement: story,
    },
    { color: [200, 170, 80], who: 'one', name: null, minute: 20, placement: story },
    { color: [100, 170, 170], who: 'two', name: null, minute: 25, placement: story },
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
  await expect(guest.getByTestId('gallery-people')).toContainText('4');
  await expect(guest.getByTestId('gallery-people')).toContainText('שיתפו');
  // stories aren't feed posts; the grid of everything has them all
  await expect(guest.getByTestId('gallery-posts')).toHaveCount(0);
  await guest.locator('[data-view="grid"]').click();
  await expect(guest.getByTestId('gallery-feed').locator('[data-item]')).toHaveCount(7);
  await guest.locator('[data-view="feed"]').click();
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
  await expect(guest.getByTestId('gallery-people')).toContainText('4');
  await expect(guest.getByTestId('gallery-people')).toContainText('shared');
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
  await expect(guest.getByText('עוד אין פוסטים בפיד. היו הראשונים לשתף!')).toBeVisible();
  // the stories offer only "your story"
  await expect(guest.getByTestId('gallery-stories').locator('[data-story]')).toHaveCount(0);
  await expect(guest.getByTestId('gallery-stories').getByText('הסטורי שלך')).toBeVisible();
  await expect(guest.getByTestId('gallery-people')).toContainText('0');
  await expect(guest.getByTestId('gallery-brand')).toBeVisible();
  await shot(guest, `he-${testInfo.project.name}-0-empty`);
  await context.close();
});

test('Badook is plain to see at the bottom, with its site and Badook Events; a button to add photos follows the guest', async ({
  page,
  browser,
}, testInfo) => {
  const { host, link } = await seeded(page);
  // a full gallery: the page is long enough to scroll past the upload card without reaching the footer
  await seedPhotos(
    host.id,
    Array.from({ length: 30 }, (_, i) => ({
      color: [60 + ((i * 37) % 160), 80 + ((i * 53) % 140), 90 + ((i * 29) % 150)] as [
        number,
        number,
        number,
      ],
      who: `crowd-${i % 5}`,
      name: ['מיכל', 'רון', 'שירה', 'עומר', null][i % 5]!,
      minute: 30 + i,
    })),
  );
  const { page: guest, context } = await guestPage(browser, testInfo.project, link);

  const card = guest.getByTestId('gallery-brand-card');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  await expect(card.getByRole('img', { name: 'Badook' }).first()).toBeVisible();
  await expect(card.getByText('גלריה חיה של Badook')).toBeVisible();
  await expect(card.getByText('הזמנות דיגיטליות וארגון אירועים')).toBeVisible();
  // the logo and the button go to Badook's site (invitations and events), in a new tab
  await expect(guest.getByTestId('gallery-brand')).toHaveAttribute('href', '/');
  const site = card.getByRole('link', { name: /לאתר Badook/ });
  await expect(site).toHaveAttribute('href', '/');
  await expect(site).toHaveAttribute('target', '_blank');
  // and Badook Events, to find a venue
  const events = card.getByRole('link', { name: /Badook אירועים/ });
  await expect(events).toHaveAttribute('href', 'https://event.badooks.com/');
  await expect(events).toHaveAttribute('target', '_blank');
  await expect(events).toContainText('למצוא מקום לאירוע');
  // the site's link opens the home page
  const [home] = await Promise.all([context.waitForEvent('page'), site.click()]);
  await home.waitForLoadState('domcontentloaded');
  expect(new URL(home.url()).pathname).toBe('/');
  await home.close();

  // sharing is always at hand: the dock (the story, or a post); the first time asks the name — or not
  const dock = guest.getByTestId('gallery-dock');
  await expect(dock).toBeVisible();
  await guest.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await expect(dock).toBeVisible();
  await shot(guest, `he-${testInfo.project.name}-4-dock`, false);
  await dock.getByTestId('gallery-share').click();
  const chooser = guest.waitForEvent('filechooser');
  await guest.getByTestId('name-sheet').getByRole('button', { name: 'בלי שם' }).click();
  await chooser;
  await guest.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(guest, `he-${testInfo.project.name}-5-footer`, false);
  await context.close();
});

test('the feed: photos shared together are one post to swipe; a heart (or a double tap) likes it, and every phone sees the count', async ({
  page,
  browser,
}, testInfo) => {
  const host = await newHost(page, 'feed-likes', 'pro', { date: day(30) });
  const link = await galleryOn(page, host.id);
  const post = 'dana-post-0123456789';
  await seedPhotos(host.id, [
    {
      color: [70, 110, 170],
      who: 'dana',
      name: 'דנה',
      minute: 1,
      placement: 'feed',
      post,
      instagram: 'dana.k',
    },
    { color: [190, 120, 90], who: 'dana', name: 'דנה', minute: 2, placement: 'feed', post },
    { color: [170, 90, 140], who: 'yoav', name: 'יואב', minute: 5, placement: 'feed' },
    { color: [100, 170, 170], who: 'yoav', name: 'יואב', minute: 6, placement: 'story' },
  ]);
  const { page: guest, context } = await guestPage(browser, testInfo.project, link);
  const tag = testInfo.project.name;

  // two posts, newest first; Dana's has two photos and says so; Yoav's story is a circle, not a post
  const posts = guest.getByTestId('gallery-posts');
  await expect(posts.locator('[data-post]')).toHaveCount(2);
  await expect(posts.locator('[data-post]').first()).toHaveAttribute('aria-label', 'הפוסט של יואב');
  const dana = posts.locator(`[data-post="${post}"]`);
  await expect(dana.locator('[data-item]')).toHaveCount(2);
  // Dana asked to be tagged: her Instagram username, linked
  await expect(dana.locator('[data-instagram="dana.k"]')).toHaveAttribute(
    'href',
    'https://www.instagram.com/dana.k/',
  );
  await expect(guest.getByTestId('gallery-stories').locator('[data-story]')).toHaveCount(1);
  // the accessibility menu is on the side
  await expect(guest.getByTestId('a11y-button')).toBeVisible();
  await shot(guest, `he-${tag}-6-feed`);

  // a double tap on the photo likes it (once); the heart takes it back
  await dana.locator('[data-item]').first().dblclick();
  await expect(dana.getByText('לייק אחד')).toBeVisible();
  await expect(dana.getByRole('button', { name: 'ביטול הלייק' })).toHaveAttribute('aria-pressed', 'true');
  await dana.scrollIntoViewIfNeeded();
  await shot(guest, `he-${tag}-6b-post`, false);
  await dana.locator('[data-item]').first().dblclick();
  await expect(dana.getByText('לייק אחד')).toBeVisible();

  // another phone sees it, and adds its own
  const other = await guestPage(browser, testInfo.project, link);
  const theirs = other.page.getByTestId('gallery-posts').locator(`[data-post="${post}"]`);
  await expect(theirs.getByText('לייק אחד')).toBeVisible();
  await expect(theirs.getByRole('button', { name: 'לייק', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await theirs.getByRole('button', { name: 'לייק', exact: true }).click();
  await expect(theirs.getByText('2 לייקים')).toBeVisible();
  // the first phone follows (live, or at its next refresh)
  await expect(dana.getByText('2 לייקים')).toBeVisible({ timeout: 20_000 });
  await other.context.close();

  // unliked: back to one, and it holds after a reload
  await dana.getByRole('button', { name: 'ביטול הלייק' }).click();
  await expect(dana.getByText('לייק אחד')).toBeVisible();
  await guest.reload();
  await guest.getByRole('heading', { level: 1 }).waitFor();
  await expect(
    guest.getByTestId('gallery-posts').locator(`[data-post="${post}"]`).getByText('לייק אחד'),
  ).toBeVisible();

  // sharing to the story, the first time: the name and "want us to tag you?", then the phone's picker
  await guest.getByTestId('story-add').click();
  const sheet = guest.getByTestId('name-sheet');
  await expect(sheet.getByRole('heading', { name: 'איך לקרוא לכם?' })).toBeVisible();
  await sheet.getByTestId('name-input').fill('רוני');
  await expect(sheet.getByTestId('instagram-input')).toHaveCount(0);
  await sheet.getByRole('switch', { name: 'רוצים שנתייג אתכם?' }).click();
  await sheet.getByTestId('instagram-input').fill('not a handle!');
  await sheet.getByTestId('name-continue').click();
  await expect(sheet.getByRole('alert')).toHaveText('רק אותיות באנגלית, ספרות, נקודה וקו תחתון');
  await sheet.getByTestId('instagram-input').fill('@Roni.K');
  await shot(guest, `he-${tag}-7-name`, false);
  let chooser = guest.waitForEvent('filechooser');
  await sheet.getByTestId('name-continue').click();
  await chooser;
  await expect(sheet).toBeHidden();
  // from now on one tap: straight to the picker (the story, or a post from the dock)
  chooser = guest.waitForEvent('filechooser');
  await guest.getByTestId('share-story').click();
  await chooser;
  await expect(sheet).toBeHidden();
  // the name is a small button at the top: it edits the name and the tag
  const me = guest.getByTestId('name-edit');
  await expect(me).toHaveText('ר');
  await me.click();
  await expect(sheet.getByTestId('name-input')).toHaveValue('רוני');
  await expect(sheet.getByTestId('instagram-input')).toHaveValue('roni.k');
  await sheet.getByRole('switch', { name: 'רוצים שנתייג אתכם?' }).click();
  await sheet.getByRole('button', { name: 'שמירה' }).click();
  await expect(sheet).toBeHidden();
  expect(await guest.evaluate(() => localStorage.getItem('badook-gallery:instagram'))).toBeNull();
  // the hosts: who asked to be tagged, as a list to download (Dana, with her two photos)
  await page.goto(`/app/invitations/${host.id}/gallery`);
  const tags = page.getByTestId('gallery-tags');
  await expect(tags).toHaveText('בקשות תיוג (1)');
  await expect(tags).toHaveAttribute('href', `/api/invitations/${host.id}/gallery/tags`);
  const csv = await page.evaluate(async (href) => {
    const res = await fetch(href);
    return { type: res.headers.get('content-type'), text: await res.text() };
  }, `/api/invitations/${host.id}/gallery/tags`);
  expect(csv.type).toContain('text/csv');
  const lines = csv.text.replace(/^\ufeff/, '').split('\r\n');
  expect(lines[0]).toBe('שם משתמש באינסטגרם,קישור לפרופיל,השם שכתבו,תמונות,שיתפו לראשונה,הקבצים בהורדה');
  expect(lines).toHaveLength(2);
  expect(lines[1]).toMatch(/^dana\.k,https:\/\/www\.instagram\.com\/dana\.k\/,דנה,1,/);
  await context.close();
});

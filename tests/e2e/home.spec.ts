import { expect, test } from '@playwright/test';

// The home page: the pitch over a background video, the live sample in a phone (with and without a
// background video), the designs, pricing and questions; signed-in hosts go straight to their invitations.

test('a visitor sees the pitch and the way in; a signed-in host goes to the invitations', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(
    page.getByRole('heading', { level: 1, name: 'הזמנות דיגיטליות שמרגשות את האורחים' }),
  ).toBeVisible();
  // the first screen and the closing band lead to signing up
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'יצירת הזמנה בחינם' })).toHaveAttribute('href', '/signup');
  await expect(main.getByRole('link', { name: 'יצירת הזמנה', exact: true })).toHaveAttribute(
    'href',
    '/signup',
  );
  // sign in: in the header on wide screens, in the menu on phones
  const header = page.getByRole('banner');
  const inMenu = !(await header.getByRole('link', { name: 'כניסה' }).first().isVisible());
  if (inMenu) await header.getByRole('button', { name: 'תפריט' }).click();
  await expect(header.getByRole('link', { name: 'כניסה' }).filter({ visible: true })).toHaveAttribute(
    'href',
    '/login',
  );
  if (inMenu) await page.keyboard.press('Escape');
  // every design, as its invitation's first screen
  await expect(page.getByRole('heading', { level: 2, name: 'עיצובים לכל אירוע' })).toBeVisible();
  for (const name of [
    'סהר בורדו',
    'ניירת זהב',
    'חוף קיסריה',
    'רמון בשקיעה',
    'עטרה',
    'ניצן',
    'גג בשקיעה',
    'אחו הדבש',
  ])
    await expect(main.getByText(name, { exact: true })).toBeAttached();
  // the plans, with their prices
  const pricing = page.locator('#pricing');
  await expect(pricing.getByRole('heading', { level: 3, name: 'Pro' })).toBeAttached();
  await expect(pricing.locator('[data-plan="pro"]')).toContainText('49');
  await expect(pricing.locator('[data-plan="business"]')).toContainText('149');
  await expect(pricing.locator('[data-plan="free"]')).toContainText('עד 150 מוזמנים בכל הזמנה');

  await main.getByRole('link', { name: 'יצירת הזמנה בחינם' }).click();
  await page.waitForURL(/\/signup$/);
  await page.fill(
    'input[name=email]',
    `home-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  );
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.goto('/');
  await page.waitForURL(/\/app\/invitations$/);
});

test('the sample invitation in a phone: without and with the YouTube video; external content can be turned off', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  // the first screen's link goes to the sample
  await expect(page.getByRole('link', { name: 'לצפייה בהזמנה לדוגמה' })).toHaveAttribute('href', '#sample');
  // the first screen's background plays from 3:27 right away (YouTube's privacy-enhanced mode)
  await expect(page.getByTestId('site-hero-video')).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\/5GvcO2lufGU\?.*cc_load_policy=0.*start=207/,
  );

  const banner = page.getByTestId('cookie-banner');
  await expect(banner).toBeVisible();
  const sample = page.locator('#sample');
  await sample.scrollIntoViewIfNeeded();
  const phone = sample.locator('iframe');
  await expect(phone).toHaveAttribute('src', '/i/noa-and-itay-classic?lang=he');
  await expect(phone).toHaveAttribute('title', 'הזמנה לדוגמה בטלפון · בלי סרטון');
  // exactly a phone's screen, whatever the visitor's screen
  expect(await phone.evaluate((el) => [el.clientWidth, el.clientHeight])).toEqual([390, 844]);
  expect((await page.request.get('/i/noa-and-itay-classic?lang=he')).status()).toBe(200);

  // with a video: the same invitation, playing the video from 3:27
  await sample.getByRole('radio', { name: 'עם סרטון ברקע' }).click();
  await expect(sample.getByTestId('sample-points')).toContainText('3:27');
  await expect(sample.locator('iframe')).toHaveAttribute('src', '/i/noa-and-itay-video?lang=he&open=1');
  expect((await page.request.get('/i/noa-and-itay-video?lang=he')).status()).toBe(200);
  const invitation = page.frameLocator('#sample iframe');
  await expect(invitation.locator('.hero-embed iframe')).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\/5GvcO2lufGU\?.*start=207/,
  );

  // "essential only" turns external content off: a still instead of both videos…
  await banner.getByRole('button', { name: 'רק חיוניות' }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByTestId('site-hero-video')).toHaveCount(0);
  await expect(sample.getByText('כיביתם תוכן חיצוני, ולכן הסרטון מיוטיוב לא מוצג כאן.')).toBeVisible();
  // …until the visitor allows it again
  await sample.getByRole('button', { name: 'אישור והצגת הסרטון' }).click();
  await expect(sample.locator('iframe')).toHaveAttribute('src', '/i/noa-and-itay-video?lang=he&open=1');
  await expect(page.getByTestId('site-hero-video')).toHaveAttribute('src', /embed\/5GvcO2lufGU\?.*start=207/);
});

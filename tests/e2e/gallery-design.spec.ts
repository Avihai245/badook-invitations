import { expect, test, type Browser, type Page } from '@playwright/test';
import { LOCAL, PHONE, api, galleryOn, jpeg, newHost, open, publish, seedPhotos } from '../support/phase5b';

// The gallery as people see it, end to end on the local stack, with screenshots for design review
// (tests/.artifacts/qa/gallery-design/): the host's gallery tab — every part named for what it does —
// and the AI photos' setup explained; the guests' feed on a phone; the event's ring opening its
// stories; the AI studio on a phone with a tall photo (the create button in view, the keyboard or
// not); a finished AI photo added to the gallery takes the guest back to the feed, where it is first.

test.skip(!LOCAL, 'reads and writes rows of the local stack');

const SHOTS = 'tests/.artifacts/qa/gallery-design';

/** A wedding with photos and stories in its gallery and the couple set up for the AI photos. */
async function wedding(page: Page) {
  const host = await newHost(page, 'design', 'business');
  const link = await galleryOn(page, host.id);
  await publish(host.id);
  const colors: [number, number, number][] = [
    [176, 70, 90],
    [60, 110, 170],
    [200, 150, 60],
    [90, 150, 110],
    [150, 90, 170],
    [70, 160, 160],
  ];
  await seedPhotos(host.id, [
    ...colors.map((color, i) => ({
      color,
      name: ['דנה', 'יואב', 'מיכל', null, 'רון', 'שירה'][i],
      who: `g${i % 3}`,
    })),
    { color: [120, 80, 60], placement: 'story' as const, name: 'דנה', who: 'g0' },
    { color: [60, 90, 140], placement: 'story' as const, name: 'יואב', who: 'g1' },
  ]);
  for (const [role, name, color] of [
    ['groom', { he: 'נועה', en: 'Noa' }, [130, 95, 75]],
    ['bride', { he: 'איתי', en: 'Itay' }, [205, 150, 160]],
  ] as const) {
    const photo = (await jpeg([...color], 800, 1000)).toString('base64');
    const res = await api(page, `/api/invitations/${host.id}/ai-photos/people`, 'POST', {
      role,
      name,
      photo,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  expect((await api(page, `/api/invitations/${host.id}/ai-photos`, 'PATCH', { consent: true })).status).toBe(
    200,
  );
  expect((await api(page, `/api/invitations/${host.id}/ai-photos`, 'PATCH', { enabled: true })).status).toBe(
    200,
  );
  return { host, link };
}

async function phone(browser: Browser) {
  const context = await browser.newContext(PHONE);
  return { context, page: await context.newPage() };
}

test('the host’s gallery tab: every part named for what it does; the AI photos explained', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the host on a computer');
  test.setTimeout(120_000);
  const { host } = await wedding(page);
  await open(page, `/app/invitations/${host.id}/gallery`);
  await expect(page.getByTestId('gallery-screen')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/he-desktop-1-host-gallery.png`, fullPage: true });
  // each part of the tab is reachable by a name that says what it is
  for (const name of ['שיתוף עם האורחים', 'התמונות והסרטונים', 'אלבום, סרטון ו־AI', 'הגדרות'])
    await expect.soft(page.getByRole('tab', { name: new RegExp(name) })).toBeVisible();
  await open(page, `/app/invitations/${host.id}/gallery/ai`);
  await expect(page.getByTestId('ai-setup')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/he-desktop-2-ai-setup.png`, fullPage: true });
  // what it is, in three steps, before anything else
  await expect.soft(page.getByTestId('ai-explainer')).toBeVisible();
});

test('a guest’s phone: the feed, the event’s ring opens its stories, the AI studio end to end', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run (the guest on a phone context)');
  test.setTimeout(180_000);
  const { link } = await wedding(page);
  const { context, page: guest } = await phone(browser);
  await guest.goto(link);
  await expect(guest.getByTestId('gallery-share')).toBeEnabled();
  await expect(guest.getByTestId('gallery-posts').locator('article')).toHaveCount(6);
  await guest.waitForLoadState('networkidle');
  await guest.screenshot({ path: `${SHOTS}/he-mobile-3-feed.png`, fullPage: true });
  await guest.screenshot({ path: `${SHOTS}/he-mobile-4-feed-top.png` });

  // the event's ring: its stories
  await guest.getByTestId('gallery-ring').click();
  await expect.soft(guest.getByTestId('story-viewer')).toBeVisible();
  await guest.keyboard.press('Escape');
  await expect(guest.getByTestId('story-viewer')).toBeHidden();

  // the AI studio with a tall photo from the phone
  await guest.getByTestId('ai-photos-open').click();
  const studio = guest.getByTestId('ai-studio');
  await expect(studio).toBeVisible();
  await guest.screenshot({ path: `${SHOTS}/he-mobile-5-ai-studio.png` });
  const tall = await jpeg([90, 120, 150], 1200, 2600);
  await studio.locator('input[type=file]:not([capture])').setInputFiles({
    name: 'tall.jpg',
    mimeType: 'image/jpeg',
    buffer: tall,
  });
  await expect(studio.locator('img').first()).toBeVisible();
  await studio.getByTestId('ai-prompt').fill('נועה ואיתי מרימים כוסית איתנו');
  // the create button is on the screen — not below it
  await expect.soft(studio.getByTestId('ai-create')).toBeInViewport();
  await guest.screenshot({ path: `${SHOTS}/he-mobile-6-ai-ready.png` });
  // no footnote about processing (the privacy policy says it all)
  await expect.soft(studio.getByText('OpenAI')).toHaveCount(0);
  await studio.getByTestId('ai-create').click();
  await expect(studio.getByTestId('ai-working')).toBeVisible();
  await guest.screenshot({ path: `${SHOTS}/he-mobile-7-ai-working.png` });
  await expect(studio.getByTestId('ai-result')).toBeVisible({ timeout: 90_000 });
  await guest.screenshot({ path: `${SHOTS}/he-mobile-8-ai-result.png` });

  // into the gallery: back to the feed, the new photo first
  await studio.getByTestId('ai-to-gallery').click();
  await expect.soft(guest.getByTestId('ai-studio')).toBeHidden();
  await expect
    .soft(guest.getByTestId('gallery-posts').locator('article').first().locator('[data-ai]'))
    .toBeVisible({ timeout: 15_000 });
  await guest.screenshot({ path: `${SHOTS}/he-mobile-9-back-to-feed.png` });
  await context.close();
});

import { expect, test, type Page } from '@playwright/test';

// P4 done-when: "Host sees live stats; all section types editable". Automated here: the responses
// dashboard (KPIs, search, filter, details, delete, CSV with BOM, notification setting), the daily
// digest endpoint, the save-the-date flow (published without a venue, its calendar file, the full
// invitation after it), gallery + lightbox, the three reveals, copying gift details and the
// template gallery's preview videos.

/** Same value as INVITES_CRON_SECRET in playwright.config.ts (webServer env). */
const CRON_SECRET = 'e2e-cron-secret-0123456789abcdef';
const SINK = '/dev/invitations/render/sahar-bordeaux/he';

async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function signUp(page: Page) {
  await page.goto('/signup');
  await page.fill(
    'input[name=email]',
    `p4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  );
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
}

async function createInvitation(page: Page, over: Record<string, unknown> = {}) {
  return page.evaluate(
    async (body) => {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return (await res.json()) as { id: string; slug: string };
    },
    {
      templateId: 'sahar-bordeaux',
      eventType: 'wedding',
      locales: ['he'],
      defaultLocale: 'he',
      hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
      date: '2027-06-17',
      startTime: '19:30',
      timezone: 'Asia/Jerusalem',
      ...over,
    },
  );
}

const publishApi = (page: Page, id: string) =>
  page.evaluate(async (invitationId) => {
    const res = await fetch(`/api/invitations/${invitationId}/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    return { status: res.status, body: (await res.json()) as { slug?: string } };
  }, id);

/** The P2 way: the publish dialog points to the missing venue, the host fills it in and publishes. */
async function publishWithVenue(page: Page, id: string) {
  await open(page, `/app/invitations/${id}/edit`);
  // the header's (phones also have one in the bottom mode bar)
  const publishButton = page.getByRole('banner').getByRole('button', { name: 'פרסום', exact: true });
  await publishButton.click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /שם המקום/ }).click();
  await page.getByRole('textbox', { name: 'שם המקום' }).fill('אחוזת הגפן');
  await page.getByRole('textbox', { name: 'כתובת', exact: true }).fill('דרך הכרמים 12, זכרון יעקב');
  await expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({
    timeout: 15_000,
  });
  await publishButton.click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'פרסום', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
  return new URL(await dialog.getByRole('textbox').inputValue()).pathname.split('/')[2]!;
}

type Adult = { firstName: string; lastName: string; phone?: string; dietary?: string[] };
const reply = (slug: string, body: Record<string, unknown>) => ({
  invitationSlug: slug,
  locale: 'he',
  hp: '',
  renderedAt: Date.now() - 10_000,
  answers: {},
  message: null,
  ...body,
});
const adults = (list: Adult[]) =>
  list.map((a) => ({
    firstName: a.firstName,
    lastName: a.lastName,
    phone: a.phone ?? null,
    email: null,
    dietary: a.dietary ?? [],
    dietaryNotes: null,
  }));

async function rsvp(page: Page, body: Record<string, unknown>) {
  const res = await page.request.post('/api/invitations/rsvp', { data: body });
  expect(res.status(), await res.text()).toBe(200);
}

// In #main: right after hydration the streamed copy of the page (a hidden <div id="S:0">) can still
// be in the document.
const kpi = (page: Page, label: string) =>
  page.locator('#main dl').filter({ has: page.getByText(label, { exact: true }) });
/** The visible toast (Radix also announces its text in a hidden live region for a second). */
const toast = (page: Page, text: string) => page.locator('li').filter({ hasText: text });

test.describe('responses dashboard', () => {
  test('live stats, search and filter, a reply’s details, delete, CSV and notifications', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await signUp(page);
    const { id } = await createInvitation(page);
    const slug = await publishWithVenue(page, id);

    await rsvp(
      page,
      reply(slug, {
        attending: true,
        message: 'מזל טוב! 🎉',
        adults: adults([
          { firstName: 'דנה', lastName: 'כהן', phone: '050-123-4567', dietary: ['vegetarian'] },
          { firstName: 'יואב', lastName: 'כהן' },
        ]),
        children: [{ fullName: 'אלה כהן', age: 6, dietary: [], dietaryNotes: null }],
      }),
    );
    await rsvp(
      page,
      reply(slug, {
        attending: true,
        adults: adults([{ firstName: 'רון', lastName: 'לוי', phone: '052-765-4321' }]),
        children: [],
      }),
    );
    await rsvp(
      page,
      reply(slug, {
        attending: false,
        contact: { fullName: 'מיכל אברהם', phone: '054-111-2233', email: null },
      }),
    );

    await open(page, `/app/invitations/${id}/responses`);
    await expect(page.getByRole('heading', { level: 1, name: 'אישורי הגעה' })).toBeVisible();
    await expect(kpi(page, 'מגיעים').locator('dd').first()).toHaveText('4');
    await expect(kpi(page, 'מגיעים')).toContainText('3 מבוגרים · ילד אחד');
    await expect(kpi(page, 'תשובות').locator('dd').first()).toHaveText('3');
    await expect(kpi(page, 'לא מגיעים').locator('dd').first()).toHaveText('1');
    await expect(kpi(page, 'לא מגיעים')).toContainText('33% מהתשובות');

    const table = page.getByRole('table', { name: 'התשובות לאישור ההגעה' });
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await page.getByRole('searchbox', { name: 'חיפוש לפי שם, טלפון או אימייל' }).fill('לוי');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('רון לוי');
    // by phone, as typed in any format
    await page.getByRole('searchbox', { name: 'חיפוש לפי שם, טלפון או אימייל' }).fill('0541112233');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('מיכל אברהם');
    await page.getByRole('searchbox', { name: 'חיפוש לפי שם, טלפון או אימייל' }).fill('');
    await page.getByRole('radio', { name: 'לא מגיעים' }).click();
    await expect(rows).toHaveCount(1);
    await page.getByRole('radio', { name: 'הכל' }).click();
    await expect(rows).toHaveCount(3);

    // a reply's details
    await rows.filter({ hasText: 'דנה כהן' }).click();
    const drawer = page.getByRole('dialog', { name: 'דנה כהן' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: '050-123-4567' })).toHaveAttribute(
      'href',
      'tel:+972501234567',
    );
    await expect(drawer).toContainText('יואב כהן');
    await expect(drawer).toContainText('אלה כהן');
    await expect(drawer).toContainText('מזל טוב! 🎉');

    // delete it
    await drawer.getByRole('button', { name: 'מחיקת התשובה' }).click();
    const confirm = page.getByRole('dialog', { name: 'למחוק את התשובה של דנה כהן?' });
    await confirm.getByRole('button', { name: 'מחיקה' }).click();
    await expect(toast(page, 'התשובה נמחקה')).toBeVisible();
    await expect(rows).toHaveCount(2);
    await expect(kpi(page, 'תשובות').locator('dd').first()).toHaveText('2');
    await expect(kpi(page, 'מגיעים').locator('dd').first()).toHaveText('1');

    // CSV: UTF-8 with a BOM (Excel shows the Hebrew), CRLF, a header row and one line per reply
    const exportLink = page.getByRole('link', { name: 'ייצוא ל-Excel' });
    await expect(exportLink).toHaveAttribute('download', `${slug}-rsvps.csv`);
    const csv = await page.request.get((await exportLink.getAttribute('href'))!);
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(csv.headers()['content-disposition']).toBe(`attachment; filename="${slug}-rsvps.csv"`);
    const bytes = await csv.body();
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = bytes.subarray(3).toString('utf8').trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^שם,סטטוס,/);
    expect(lines.slice(1).join('\n')).toContain('רון לוי');
    expect(lines.slice(1).join('\n')).not.toContain('דנה כהן');

    // notification setting: saved and kept after a reload
    const desktop = testInfo.project.name === 'desktop';
    const mode = desktop ? 'סיכום יומי' : 'כבויות';
    await page.getByRole('button', { name: 'התראות במייל: על כל תשובה' }).click();
    await page.getByRole('menuitem', { name: mode }).click();
    await expect(toast(page, 'הגדרת ההתראות נשמרה')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: `התראות במייל: ${mode}` })).toBeVisible();
    expect(errors).toEqual([]);

    // the daily summary (called by the GitHub Actions cron) — one project only: it covers every
    // invitation set to "daily summary" in the database
    if (!desktop) return;
    const cron = (authorization?: string) =>
      page.request.post('/api/cron/rsvp-digest', {
        headers: authorization ? { authorization } : {},
      });
    expect((await cron()).status()).toBe(401);
    expect((await cron('Bearer wrong-secret')).status()).toBe(401);
    const first = await cron(`Bearer ${CRON_SECRET}`);
    expect(first.status()).toBe(200);
    // the same daily call also purges data past its keeping time (the privacy policy)
    const purged = {
      rsvpRate: expect.any(Number),
      supportRate: expect.any(Number),
      ipHashes: expect.any(Number),
      contact: expect.any(Number),
    };
    expect(await first.json()).toEqual({ sent: 1, failed: 0, purged, overdue: 0 });
    // nothing new since → nothing sent
    expect(await (await cron(`Bearer ${CRON_SECRET}`)).json()).toEqual({
      sent: 0,
      failed: 0,
      purged,
      overdue: 0,
    });
  });
});

test.describe('save-the-date', () => {
  test('published without a venue; the date reveal and its calendar file; the full invitation, linked once published', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await signUp(page);
    const { id, slug } = await createInvitation(page, { eventType: 'save_the_date' });
    expect(slug).toMatch(/-save-the-date(-[0-9a-f]+)?$/);
    expect(await publishApi(page, id)).toMatchObject({ status: 200 });

    // §10.3: hero → the reveal → a note → footer
    await open(page, `/i/${slug}?lang=he&open=1`);
    await expect(page.locator('.rv-scratch')).toBeVisible();
    await expect(page.getByText('הזמנה רשמית תישלח בהמשך.')).toBeVisible();
    await expect(page.locator('#rsvp, .v-name')).toHaveCount(0);
    await page.locator('.rv-kbd').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.rv[data-revealed]')).toHaveCount(1);
    await expect(page.locator('.rv-cal')).toBeVisible();
    const ics = await page.request.get(`/i/${slug}/event.ics?lang=he`);
    expect(ics.status()).toBe(200);
    expect(ics.headers()['content-type']).toBe('text/calendar; charset=utf-8');
    const body = await ics.text();
    expect(body).toContain('DTSTART:20270617T163000Z');
    expect(body).toContain('SUMMARY:נועה & איתי');

    // the full invitation, from the list
    await open(page, '/app/invitations');
    await page.getByRole('button', { name: 'אפשרויות נוספות' }).first().click();
    await page.getByRole('menuitem', { name: 'יצירת ההזמנה המלאה' }).click();
    const dialog = page.getByRole('dialog', { name: 'ההזמנה המלאה' });
    await expect(dialog.getByRole('radio', { name: 'חתונה' })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('button', { name: 'יצירת ההזמנה' }).click();
    await page.waitForURL(/\/app\/invitations\/[0-9a-f-]{36}\/edit$/);
    const fullId = new URL(page.url()).pathname.split('/')[3]!;
    expect(fullId).not.toBe(id);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByText('נועה & איתי · חתונה')).toBeVisible();
    await open(page, '/app/invitations');
    await expect(page.getByRole('heading', { level: 2, name: 'נועה & איתי' })).toHaveCount(2);

    // once the full invitation is published, the save-the-date links to it (its cached page refreshed)
    const fullSlug = await publishWithVenue(page, fullId);
    await open(page, `/i/${slug}?lang=he&open=1`);
    const link = page.getByRole('link', { name: 'לצפייה בהזמנה' });
    await expect(link).toHaveAttribute('href', `/i/${fullSlug}?lang=he`);
    await expect(page.getByRole('heading', { name: 'ההזמנה כבר כאן' })).toBeVisible();
    await link.click();
    await page.waitForURL(new RegExp(`/i/${fullSlug}\\?lang=he$`));
    await expect(page.locator('#rsvp')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test.describe('sections', () => {
  test('gallery: carousel, lightbox (keys follow the page direction, Esc, focus back), grid', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await open(page, `${SINK}/wedding-he-en?open=1&gallery=carousel`);
    const items = page.locator('.g-carousel .g-item');
    await expect(items).toHaveCount(5);
    const dot = page.getByRole('button', { name: '3 מתוך 5', exact: true });
    await dot.click();
    await expect(dot).toHaveAttribute('aria-current', 'true');

    await items.nth(2).click();
    // named by the gallery's title ("רגעים" in the kitchen sink)
    const lightbox = page.getByRole('dialog', { name: 'רגעים' });
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('.lb-count')).toHaveText('3 מתוך 5');
    await expect(lightbox.getByRole('button', { name: 'סגירה' })).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // RTL: the next photo
    await expect(lightbox.locator('.lb-count')).toHaveText('4 מתוך 5');
    await expect(lightbox.locator('img')).toHaveAttribute('alt', 'תמונה 4');
    await page.keyboard.press('Escape');
    await expect(lightbox).toHaveCount(0);
    await expect(items.nth(2)).toBeFocused();

    await open(page, `${SINK}/wedding-he-en?open=1&gallery=grid`);
    await expect(page.locator('.g-grid .g-item')).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test('reveal: scratch, tap and spin each show the date, then "add to calendar"', async ({ page }) => {
    await open(page, `${SINK}/savethedate-he?open=1`);
    const foil = page.locator('.rv-foil');
    await foil.scrollIntoViewIfNeeded();
    const box = (await foil.boundingBox())!;
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    for (let row = 0; row < 7; row++) {
      const y = box.y + 8 + (row * (box.height - 16)) / 6;
      await page.mouse.move(box.x + (row % 2 ? box.width - 5 : 5), y, { steps: 10 });
      await page.mouse.move(box.x + (row % 2 ? 5 : box.width - 5), y, { steps: 10 });
    }
    await page.mouse.up();
    await expect(page.locator('.rv[data-revealed]')).toHaveCount(1);
    await expect(page.locator('.rv-foil')).toHaveCount(0);
    await expect(page.locator('.rv-cal')).toBeVisible();

    await open(page, `${SINK}/savethedate-he?open=1&reveal=tap`);
    await expect(page.locator('.rv-prompt')).toHaveText('(הקישו כדי לגלות)');
    await page.locator('.rv-seal').click();
    await expect(page.locator('.rv[data-revealed]')).toHaveCount(1);
    await expect(page.locator('.rv-seal')).toHaveCount(0);

    await open(page, `${SINK}/savethedate-he?open=1&reveal=spin`);
    await page.locator('.rv-spin-box').scrollIntoViewIfNeeded();
    await expect(page.locator('.rv[data-revealed]')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('.rv-date .rv-long')).toHaveText('יום חמישי, 17 ביוני 2027');
  });

  test('gifts: account details copy to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, `${SINK}/demo?open=1`);
    const copy = page.locator('.copy-btn');
    await copy.click();
    await expect(copy).toHaveText('הועתק');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'בנק הפועלים (12) · סניף 600 · חשבון 123456',
    );
    await expect(copy).toHaveText('העתקה', { timeout: 4000 });
  });
});

test.describe('template gallery', () => {
  test('preview videos: one at a time, on hover or in view; the poster stays when a file is missing', async ({
    page,
  }, testInfo) => {
    await signUp(page);
    // the pointer would stay where sign-up's button was — right where a card appears in the gallery
    await page.mouse.move(2, 2);
    await open(page, '/app/invitations/new?previews=fixture');
    const cards = page.locator('ul > li > button');
    const playing = page.locator('video[data-playing]');
    if (testInfo.project.name === 'desktop') {
      await expect(playing).toHaveCount(0);
      await cards.nth(0).hover();
      await expect(cards.nth(0).locator('video[data-playing]')).toHaveCount(1);
      await cards.nth(2).hover();
      await expect(cards.nth(2).locator('video[data-playing]')).toHaveCount(1);
      await expect(playing).toHaveCount(1);
      await page.mouse.move(2, 2);
      await expect(playing).toHaveCount(0);

      await open(page, '/app/invitations/new?previews=missing');
      await cards.nth(0).hover();
      await expect(cards.nth(0).locator('video')).toHaveCount(0);
      await expect(cards.nth(1).locator('video')).toHaveCount(1);
    } else {
      // the card well in view plays, and only that one
      await expect(playing).toHaveCount(1);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(playing).toHaveCount(1);
      await expect(cards.nth(0).locator('video[data-playing]')).toHaveCount(0);
    }
  });
});

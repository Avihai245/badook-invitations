import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// P2 done-when: "A new user creates, edits and publishes an invitation without touching code" —
// sign up → gallery → preview → wizard → editor (edit, autosave, undo) → publish → the public page.
// Runs against the local stack of playwright.config.ts (or PW_BASE_URL); the UI is Hebrew (default).

async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    // the gallery's template previews and demo media aren't produced in the local stack
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function signUp(page: Page) {
  await open(page, '/signup');
  await page.fill(
    'input[name=email]',
    `host-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
  );
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

const saved = (page: Page) =>
  expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({ timeout: 15_000 });

test.describe('host: create → edit → publish', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 1024,
    'the full flow runs on desktop; mobile has its own test',
  );

  test('a new host publishes an invitation without touching code', async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = collectErrors(page);
    await signUp(page);

    // empty list → gallery
    await expect(page.getByRole('heading', { name: 'עוד אין הזמנות' })).toBeVisible();
    await page.getByRole('link', { name: 'בחירת עיצוב' }).click();
    await page.waitForURL(/\/app\/invitations\/new$/);
    await expect(page.getByRole('heading', { name: 'בחרו עיצוב' })).toBeVisible();

    // filter chips narrow the gallery
    await page.getByRole('button', { name: 'ברית', exact: true }).click();
    await expect(page.getByRole('button', { name: /סהר בורדו/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'הכל', exact: true }).click();

    // preview → use this design
    await page.getByRole('button', { name: /סהר בורדו/ }).click();
    const preview = page.getByRole('dialog');
    await expect(preview.getByRole('heading', { name: 'סהר בורדו' })).toBeVisible();
    await preview.getByRole('button', { name: /כחול לילה/ }).click();
    await preview.getByRole('button', { name: 'שימוש בעיצוב הזה' }).click();

    // wizard
    const wizard = page.getByRole('dialog');
    await expect(wizard.getByRole('heading', { name: 'איזה אירוע חוגגים?' })).toBeVisible();
    await expect(wizard.getByRole('radio', { name: 'חתונה' })).toHaveAttribute('aria-checked', 'true');
    await wizard.getByRole('button', { name: 'המשך' }).click();
    await wizard.getByRole('button', { name: 'המשך' }).click(); // empty → errors
    await expect(wizard.getByText('שדה חובה').first()).toBeVisible();
    await wizard.getByLabel('שם 1').fill('נועה');
    await wizard.getByLabel('שם 2').fill('איתי');
    await wizard.getByLabel('תאריך').fill('2027-06-17');
    await wizard.getByLabel('שעה').fill('19:30');
    await wizard.getByRole('button', { name: 'המשך' }).click();
    await expect(wizard.getByRole('heading', { name: 'באיזו שפה?' })).toBeVisible();
    await wizard.getByRole('button', { name: 'יצירת ההזמנה' }).click();

    // editor
    await page.waitForURL(/\/app\/invitations\/[0-9a-f-]{36}\/edit$/, { timeout: 30_000 });
    const editorUrl = page.url();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByRole('heading', { level: 2, name: 'פתיחה (Hero)' })).toBeVisible();
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    await expect(frame.locator('h1.names')).toContainText('נועה', { timeout: 30_000 });

    // edit a text: live preview, autosave, undo
    const eyebrow = page.getByRole('textbox', { name: 'שורת פתיחה' });
    await eyebrow.fill('מתחתנים בכרם!');
    await expect(frame.locator('.eyebrow')).toHaveText('מתחתנים בכרם!');
    await saved(page);
    await page.keyboard.press('Control+z');
    await expect(eyebrow).not.toHaveValue('מתחתנים בכרם!');
    await page.keyboard.press('Control+Shift+z');
    await expect(eyebrow).toHaveValue('מתחתנים בכרם!');

    // publishing is blocked until the venue is filled in; the issue jumps to its field
    await page.getByRole('button', { name: 'פרסום', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByText('צריך למלא את "שם המקום"')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'פרסום', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: /שם המקום/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'מקום האירוע' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'שם המקום' })).toBeFocused();
    await page.getByRole('textbox', { name: 'שם המקום' }).fill('אחוזת הגפן');
    await page.getByRole('textbox', { name: 'כתובת', exact: true }).fill('דרך הכרמים 12, זכרון יעקב');
    await saved(page);

    // not published yet: the share panel says the link isn't live, and a guest opening it gets the
    // friendly "not available" page (a 404, cached like any page — publishing must refresh it)
    await page.getByRole('tab', { name: 'הגדרות' }).click();
    await page.getByRole('button', { name: 'קישור ושיתוף' }).click();
    await expect(page.getByText('ההזמנה עוד לא פורסמה — הקישור יתחיל לעבוד אחרי הפרסום.')).toBeVisible();
    const draftPath = new URL(await page.getByRole('textbox', { name: 'כתובת ההזמנה' }).inputValue())
      .pathname;
    const guest = await page.context().newPage();
    expect((await guest.goto(draftPath))?.status()).toBe(404);
    await expect(guest.getByRole('heading', { name: 'ההזמנה לא זמינה כרגע' })).toBeVisible();
    await expect(
      guest.getByRole('heading', { name: 'This invitation isn’t available right now' }),
    ).toBeVisible();
    await guest.close();

    // publish, from the share panel
    await page.getByRole('button', { name: 'פרסום עכשיו' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByText('הכל מוכן לפרסום')).toBeVisible();
    await dialog.getByRole('button', { name: 'פרסום', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
    const url = await dialog.getByRole('textbox').inputValue();
    expect(url).toMatch(/\/i\/noa-and-[a-z0-9-]+$/); // transliterated from the Hebrew names
    await dialog.getByRole('button', { name: 'סגירה' }).click();
    await expect(page.getByText('פורסם', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'פתיחת ההזמנה' })).toHaveAttribute('href', url);

    // the public page shows the published invitation (the cached "not available" page is gone)
    const slug = new URL(url).pathname.split('/').pop()!;
    expect(`/i/${slug}`).toBe(draftPath);
    const res = await open(page, `/i/${slug}?open=1`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('.eyebrow')).toHaveText('מתחתנים בכרם!');
    await expect(page.getByText('אחוזת הגפן')).toBeVisible();
    // hidden from search engines by default (§4)…
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow, noarchive, noimageindex',
    );

    // …until the host switches it off and publishes again (the cached page is refreshed)
    await open(page, editorUrl);
    await page.getByRole('tab', { name: 'הגדרות' }).click();
    await page.getByRole('button', { name: 'קישור ושיתוף' }).click();
    const hide = page.getByRole('switch', { name: 'להסתיר ממנועי חיפוש' });
    await expect(hide).toHaveAttribute('aria-checked', 'true');
    await hide.click();
    await expect(hide).toHaveAttribute('aria-checked', 'false');
    await saved(page);
    await page.getByRole('button', { name: 'פרסום השינויים' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'פרסום', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'סגירה' }).click();
    await open(page, `/i/${slug}?open=1`);
    await expect(page.locator('.eyebrow')).toHaveText('מתחתנים בכרם!');
    await expect(page.locator('meta[name="robots"], meta[name="googlebot"]')).toHaveCount(0);

    // back in the list: the card is published
    await open(page, '/app/invitations');
    const main = page.locator('#main');
    await expect(main.getByRole('link', { name: 'נועה & איתי' })).toBeVisible();
    await expect(main.getByText('פורסם', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('hero background', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'the desktop editor');

  test('an uploaded video gets a still as its poster; its sound can be the music; a YouTube link', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signUp(page);
    const created = await page.evaluate(async () => {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: 'papercut-gold',
          eventType: 'wedding',
          locales: ['he'],
          defaultLocale: 'he',
          hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
          date: '2027-06-17',
          startTime: '19:30',
          timezone: 'Asia/Jerusalem',
        }),
      });
      return (await res.json()) as { id: string };
    });
    await open(page, `/app/invitations/${created.id}/edit`);
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');

    // a video (the test clip — Chrome reads it by its content): uploaded, with a still read from it
    await page.locator('input[type=file][accept*="video/mp4"]').setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: readFileSync('tests/fixtures/media/cover-open.webm'),
    });
    await page
      .getByRole('dialog', { name: 'מה חשוב בתמונה?' })
      .getByRole('button', { name: 'שמירה' })
      .click();
    await saved(page);
    const video = frame.locator('.hero-media video');
    await expect(video).toHaveAttribute('poster', /\/invitation-media\/.+\.jpg$/);
    await expect(video).toHaveAttribute('muted', '');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);

    // its sound instead of a song
    await page.getByRole('tab', { name: 'עיצוב' }).click();
    await page.getByRole('button', { name: 'מוזיקה' }).click();
    await page.getByRole('radio', { name: 'הסאונד של סרטון הרקע' }).click();
    await expect(page.getByText('האורחים ישמעו את הסאונד של הסרטון')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'שירים' })).toHaveCount(0);
    await saved(page);

    // a YouTube link instead of the file
    await page.getByRole('tab', { name: 'סקשנים' }).click();
    await page.getByRole('button', { name: 'פתיחה (Hero)', exact: true }).click();
    await page.getByRole('button', { name: 'סרטון מיוטיוב או מ־Vimeo' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'סרטון רקע מקישור' });
    await dialog.getByRole('textbox', { name: 'קישור לסרטון' }).fill('https://example.com/clip.mp4');
    await dialog.getByRole('button', { name: 'שמירה' }).click();
    await expect(dialog.getByText('זה לא נראה כמו קישור לסרטון ביוטיוב או ב־Vimeo')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'קישור לסרטון' }).fill('https://youtu.be/dQw4w9WgXcQ?si=share');
    await dialog.getByRole('button', { name: 'שמירה' }).click();
    await saved(page);
    await expect(frame.locator('.hero-embed iframe')).toHaveAttribute(
      'src',
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    );
    await expect(page.getByRole('button', { name: 'סרטון מיוטיוב או מ־Vimeo' }).first()).toBeVisible();

    // its subtitles: hidden unless the host turns them on
    const subtitles = page.getByRole('switch', { name: 'הצגת כתוביות' });
    await expect(subtitles).not.toBeChecked();
    await expect(frame.locator('.hero-embed iframe')).toHaveAttribute('src', /[?&]cc_load_policy=0(&|$)/);
    await subtitles.click();
    await expect(frame.locator('.hero-embed iframe')).toHaveAttribute('src', /[?&]cc_load_policy=1(&|$)/);
    await saved(page);
  });
});

test.describe('switched off, and dates side by side', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'the desktop editor');

  test('a hidden section is never flagged; the RSVP deadline shows the event date', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signUp(page);
    const created = await page.evaluate(async () => {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: 'papercut-gold',
          eventType: 'wedding',
          locales: ['he', 'en'],
          defaultLocale: 'he',
          hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
          date: '2027-06-17',
          startTime: '19:30',
          timezone: 'Asia/Jerusalem',
        }),
      });
      return (await res.json()) as { id: string };
    });
    await open(page, `/app/invitations/${created.id}/edit`);

    // gifts hidden, with a Bit item added and left empty: no "missing" dots, nothing to fix
    await page.getByRole('button', { name: 'מתנות', exact: true }).click();
    const shown = page.getByRole('switch', { name: 'הצגת מתנות' });
    if (await shown.isChecked()) await shown.click();
    const note = page.getByTestId('hidden-section-note');
    await expect(note).toContainText('הסקשן מוסתר');
    await page.getByRole('button', { name: 'הוספה', exact: true }).click();
    const buttonText = page.locator('[data-field-path$=".label"]').last();
    await expect(buttonText.getByRole('radio', { name: 'English' })).toBeVisible();
    await expect(buttonText.locator('[title="חסר תרגום"]')).toHaveCount(0);
    await saved(page);

    // the deadline, set in the RSVP panel, next to the event's date (set elsewhere)
    await page.getByRole('button', { name: 'אישור הגעה', exact: true }).click();
    await expect(page.getByText('תאריך האירוע: 17 ביוני 2027')).toBeVisible();
    await page.getByLabel('תאריך אחרון לאישור הגעה').fill('2027-06-20');
    await expect(page.getByText('מאוחר מתאריך האירוע (17 ביוני 2027).', { exact: false })).toBeVisible();
    await saved(page);

    // publishing: nothing about the hidden gifts; the deadline warning names both dates
    await page.getByRole('button', { name: 'פרסום', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByText('התאריך האחרון לאישור הגעה (20 ביוני 2027) מאוחר מתאריך האירוע (17 ביוני 2027)'),
    ).toBeVisible();
    await expect(dialog.getByText('מתנות')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // shown again from the note: the item is now something to complete
    await page.getByRole('button', { name: 'מתנות', exact: true }).click();
    await note.getByRole('button', { name: 'הצגה בהזמנה' }).click();
    await expect(note).toHaveCount(0);
    await expect(shown).toBeChecked();
    await expect(
      page.locator('[data-field-path$=".label"]').last().locator('[title="חסר תרגום"]'),
    ).toHaveCount(2);
  });
});

test.describe('host editor on a phone', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'mobile layout');

  test('form, preview and the sections sheet', async ({ page }) => {
    test.setTimeout(120_000);
    await signUp(page);
    const created = await page.evaluate(async () => {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: 'atara',
          eventType: 'bat_mitzvah',
          locales: ['he'],
          defaultLocale: 'he',
          hosts: { primary: { he: 'תמר' } },
          date: '2027-03-04',
          startTime: '19:00',
          timezone: 'Asia/Jerusalem',
        }),
      });
      return (await res.json()) as { id: string };
    });
    await open(page, `/app/invitations/${created.id}/edit`);
    const tabs = page.getByRole('navigation', { name: 'מצב העורך' });
    await expect(tabs).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'פתיחה (Hero)' })).toBeVisible();
    await tabs.getByRole('button', { name: 'תצוגה' }).click();
    await expect(page.locator('iframe[title="תצוגה מקדימה של ההזמנה"]')).toBeVisible();
    await tabs.getByRole('button', { name: 'עריכה' }).click();
    const sheet = page.getByRole('dialog', { name: 'כל הסקשנים' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'אישור הגעה', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'אישור הגעה' })).toBeVisible();
    // no horizontal scroll at 390px
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

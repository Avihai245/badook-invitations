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
  await page.click('button[type=submit]');
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

    // publish
    await page.getByRole('button', { name: 'פרסום', exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByText('הכל מוכן לפרסום')).toBeVisible();
    await dialog.getByRole('button', { name: 'פרסום', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
    const url = await dialog.getByRole('textbox').inputValue();
    expect(url).toMatch(/\/i\/noa-and-[a-z0-9-]+$/); // transliterated from the Hebrew names
    await dialog.getByRole('button', { name: 'סגירה' }).click();
    await expect(page.getByText('פורסם', { exact: true })).toBeVisible();

    // the public page shows the published invitation
    const slug = new URL(url).pathname.split('/').pop()!;
    const res = await open(page, `/i/${slug}?open=1`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('.eyebrow')).toHaveText('מתחתנים בכרם!');
    await expect(page.getByText('אחוזת הגפן')).toBeVisible();

    // back in the list: the card is published
    await open(page, '/app/invitations');
    const main = page.locator('#main');
    await expect(main.getByRole('link', { name: 'נועה & איתי' })).toBeVisible();
    await expect(main.getByText('פורסם', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
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

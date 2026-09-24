import { expect, test, type Page } from '@playwright/test';

// Every area of the app has a "?" that explains its buttons (lib/i18n/help.*.ts): the invitations
// list, the design gallery, the editor's bar and its rail, the RSVPs, sharing and the account — on a
// phone and on a computer, each ending with a way to ask the assistant.

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function signUp(page: Page) {
  await page.goto('/signup');
  await page.fill(
    'input[name=email]',
    `help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  );
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

/** Opens the "?" whose card is titled `title`, checks a few of its lines, and closes it. */
async function explains(
  page: Page,
  trigger: ReturnType<Page['getByTestId']>,
  title: string,
  lines: string[],
) {
  await trigger.click();
  const card = page.getByRole('dialog').filter({ hasText: title });
  await expect(card).toBeVisible();
  for (const line of lines) await expect(card.getByText(line, { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'שאלו את העוזר', exact: true })).toBeVisible();
  // the card fits the screen: its last line can be reached
  await card.getByRole('button', { name: 'שאלו את העוזר', exact: true }).scrollIntoViewIfNeeded();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
}

test('each area explains its buttons', async ({ page }) => {
  await signUp(page);
  const main = page.locator('#main');
  await explains(page, main.getByTestId('area-help'), 'ההזמנות שלי: מה כל כפתור עושה', [
    'הזמנה חדשה',
    'שכפול',
    'ארכיון',
  ]);

  await open(page, '/app/invitations/new');
  await explains(page, main.getByTestId('area-help'), 'בחירת עיצוב: מה כל כפתור עושה', ['פרימיום', 'דמו חי']);

  const id = await page.evaluate(async () => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return ((await res.json()) as { id: string }).id;
  });

  await open(page, `/app/invitations/${id}/edit`);
  await explains(page, page.getByRole('banner').getByTestId('area-help'), 'העורך: מה כל כפתור עושה', [
    'פרסום',
    'גרסאות',
  ]);
  // the rail (on a phone: the sheet that opens from the bottom bar)
  if ((page.viewportSize()?.width ?? 1440) < 1024)
    await page.getByRole('navigation', { name: 'מצב העורך' }).getByRole('button', { name: 'עיצוב' }).click();
  await explains(
    page,
    page.locator('aside:visible').getByTestId('area-help'),
    'סקשנים ועיצוב: מה כל דבר עושה',
    ['מתג הסתרה', 'הוספת סקשן'],
  );

  await open(page, `/app/invitations/${id}/responses`);
  await explains(page, main.getByTestId('area-help'), 'אישורי הגעה: מה כל כפתור עושה', ['ייצוא לאקסל']);

  await open(page, '/app/account');
  await explains(page, main.getByTestId('area-help'), 'החשבון: מה כל כפתור עושה', ['מחיקת החשבון']);
});

import { expect, test, type Locator, type Page } from '@playwright/test';

// Every area of the app has a "?" that explains its buttons (lib/i18n/help.*.ts): the invitations
// list, the design gallery with its preview and the new-invitation wizard, an invitation's overview
// (and its tabs), the editor's bar, rail, design and settings panels, publish window and versions,
// the RSVPs, sharing and the account — on a phone and on a computer. Cards on a page end with a way
// to ask the assistant; cards inside a dialog don't (the chat would open behind it).

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

const create = (page: Page, over: Record<string, unknown> = {}) =>
  page.evaluate(async (over) => {
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
        ...over,
      }),
    });
    return (await res.json()) as { id: string; slug: string };
  }, over);

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

/** Opens the "?" whose card is titled `title`, checks a few of its lines, and closes it. */
async function explains(
  page: Page,
  trigger: Locator,
  title: string,
  lines: string[],
  { assistant = true }: { assistant?: boolean } = {},
) {
  await trigger.click();
  const card = page.getByRole('dialog').filter({ hasText: title });
  await expect(card).toBeVisible();
  for (const line of lines) await expect(card.getByText(line, { exact: true })).toBeVisible();
  const ask = card.getByRole('button', { name: 'שאלו את העוזר', exact: true });
  if (assistant) {
    // the card fits the screen: its last line can be reached
    await ask.scrollIntoViewIfNeeded();
    await expect(ask).toBeVisible();
  } else await expect(ask).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
}

test('the list, the gallery with its preview and wizard, and the account', async ({ page }) => {
  await signUp(page);
  const main = page.locator('#main');
  await explains(page, main.getByTestId('area-help'), 'ההזמנות שלי: מה כל כפתור עושה', [
    'הזמנה חדשה',
    'הצעד הבא',
    'הכפתורים בכרטיס',
    'ארכיון',
  ]);

  await open(page, '/app/invitations/new');
  await explains(page, main.getByTestId('area-help'), 'בחירת עיצוב: מה כל כפתור עושה', ['פרימיום', 'דמו חי']);

  // the preview dialog has its own "?" (the gallery's is behind it)
  await main.getByRole('button', { name: /סהר בורדו/ }).click();
  const preview = page.getByRole('dialog', { name: 'סהר בורדו' });
  await explains(
    page,
    preview.getByTestId('area-help'),
    'תצוגה מקדימה: מה כל כפתור עושה',
    ['הטלפון', 'צבעים', 'דמו חי בלשונית חדשה'],
    { assistant: false },
  );
  await expect(preview).toBeVisible();

  // …and so has the wizard
  await preview.getByRole('button', { name: 'שימוש בעיצוב הזה' }).click();
  const wizard = page.getByRole('dialog', { name: /הזמנה חדשה/ });
  await explains(
    page,
    wizard.getByTestId('area-help'),
    'הזמנה חדשה: מה כל שלב עושה',
    ['סוג האירוע', 'תאריך ושעה', 'יצירת ההזמנה'],
    { assistant: false },
  );
  await expect(wizard.getByRole('heading', { name: 'איזה אירוע חוגגים?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(wizard).toBeHidden();

  await open(page, '/app/account');
  await explains(page, main.getByTestId('area-help'), 'החשבון: מה כל כפתור עושה', ['מחיקת החשבון']);
});

test('an invitation: its overview and tabs, the RSVPs and sharing; the app’s own navigation', async ({
  page,
}) => {
  await signUp(page);
  const main = page.locator('#main');
  // a save-the-date publishes without a venue
  const { id } = await create(page, { eventType: 'save_the_date' });
  const published = await page.evaluate(async (id) => {
    const res = await fetch(`/api/invitations/${id}/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    return res.status;
  }, id);
  expect(published).toBe(200);

  // the list: the card opens the invitation's overview
  await open(page, '/app/invitations');
  await main.getByRole('link', { name: 'נועה & איתי', exact: true }).click();
  await page.waitForURL(new RegExp(`/app/invitations/${id}$`));
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(page.getByRole('heading', { level: 1, name: 'סקירה' })).toBeVisible();
  await explains(page, main.getByTestId('area-help'), 'ההזמנה: מה כל דבר עושה', [
    'הלשוניות',
    'העלאת רשימת מוזמנים מאקסל',
    'שליחה בוואטסאפ לכל המוזמנים',
  ]);
  // the two main things, as big buttons: upload the list, send on WhatsApp
  await expect(main.getByRole('link', { name: 'העלאת קובץ' })).toHaveAttribute(
    'href',
    `/app/invitations/${id}/guests?import=1`,
  );
  // no guests yet: sending waits, and says why
  const whatsapp = main.locator('[data-action="whatsapp"]');
  await expect(whatsapp).toContainText('קודם מעלים רשימת מוזמנים');
  await expect(whatsapp.getByRole('button', { name: 'שליחה בוואטסאפ' })).toBeDisabled();

  // the tabs: RSVPs, then back to the overview
  const tabs = page.getByRole('navigation', { name: 'ניווט בהזמנה' });
  await expect(tabs.getByRole('link', { name: /מוזמנים/ })).toHaveAttribute(
    'href',
    `/app/invitations/${id}/guests`,
  );
  await tabs.getByRole('link', { name: 'אישורי הגעה' }).click();
  await page.waitForURL(/\/responses$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(tabs.getByRole('link', { name: 'אישורי הגעה' })).toHaveAttribute('aria-current', 'page');
  await explains(page, main.getByTestId('area-help'), 'אישורי הגעה: מה כל כפתור עושה', [
    'ייצוא לאקסל',
    'סינונים פעילים',
  ]);

  await tabs.getByRole('link', { name: 'שיתוף' }).click();
  await page.waitForURL(/\/share$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await explains(page, main.getByTestId('area-help'), 'שיתוף: מה כל כפתור עושה', ['העתקת ההודעה', 'קוד QR']);
  await tabs.getByRole('link', { name: 'סקירה' }).click();
  await page.waitForURL(new RegExp(`/app/invitations/${id}$`));

  // the app's navigation: the sidebar on a computer, the bottom bar on a phone
  const nav = isPhone(page)
    ? page.getByRole('navigation', { name: 'ניווט', exact: true })
    : page.getByRole('navigation', { name: 'ניווט ראשי' });
  await nav.getByRole('link', { name: isPhone(page) ? 'חבילה' : 'חבילה וחיובים' }).click();
  await page.waitForURL(/\/app\/billing$/);
  await nav.getByRole('link', { name: isPhone(page) ? 'ההזמנות' : 'ההזמנות שלי' }).click();
  await page.waitForURL(/\/app\/invitations$/);
});

test('the editor: its bar, rail, design and settings panels, publishing and versions', async ({ page }) => {
  await signUp(page);
  const { id } = await create(page);
  await open(page, `/app/invitations/${id}/edit`);
  const phone = isPhone(page);
  await explains(page, page.getByRole('banner').getByTestId('area-help'), 'העורך: מה כל כפתור עושה', [
    'פרסום',
    'גרסאות',
    'הפעלת הפתיחה מחדש',
    'הסרגל התחתון (בטלפון)',
  ]);

  // the rail (on a phone: the sheet that opens from the bottom bar)
  const openRail = async (tab: 'עיצוב' | 'הגדרות') => {
    if (phone) {
      await page
        .getByRole('navigation', { name: 'מצב העורך' })
        .getByRole('button', { name: 'עיצוב' })
        .click();
      if (tab === 'הגדרות') await page.locator('aside:visible').getByRole('tab', { name: 'הגדרות' }).click();
    } else await page.getByRole('tab', { name: tab }).click();
  };
  await openRail('עיצוב');
  await explains(
    page,
    page.locator('aside:visible').getByTestId('area-help'),
    'סקשנים ועיצוב: מה כל דבר עושה',
    ['מתג הסתרה', 'הוספת סקשן', 'נקודה צהובה / אדומה'],
  );

  // a design panel explains each of its controls
  await page.locator('aside:visible').getByRole('button', { name: 'צבעים', exact: true }).click();
  const colors = page.getByRole('heading', { level: 2, name: 'צבעים' });
  await expect(colors).toBeVisible();
  await explains(page, colors.locator('..').getByTestId('area-help'), 'צבעים: מה כל דבר עושה', [
    'ערכות צבעים',
    'קוד הצבע',
    'חזרה לצבעי העיצוב',
  ]);

  // …and so does a settings panel
  await openRail('הגדרות');
  await page.locator('aside:visible').getByRole('button', { name: 'פרטי האירוע', exact: true }).click();
  const event = page.getByRole('heading', { level: 2, name: 'פרטי האירוע' });
  await expect(event).toBeVisible();
  await explains(page, event.locator('..').getByTestId('area-help'), 'פרטי האירוע: מה כל שדה עושה', [
    'סוג האירוע',
    'תאריך עברי',
  ]);

  // the publish window
  await page.getByRole('banner').getByRole('button', { name: 'פרסום', exact: true }).click();
  const publish = page.getByRole('dialog', { name: 'פרסום ההזמנה' });
  await expect(publish).toBeVisible();
  await explains(
    page,
    publish.getByTestId('area-help'),
    'פרסום: מה כל דבר עושה',
    ['כתובת ההזמנה', 'צריך לתקן (אדום)', 'כדאי לבדוק (צהוב)'],
    { assistant: false },
  );
  // "publish" can't be pressed yet — and says why
  await expect(publish.getByRole('button', { name: 'פרסום', exact: true })).toBeDisabled();
  await publish.locator('[data-disabled-hint]').hover();
  await expect(page.getByRole('tooltip')).toContainText('קודם מתקנים את מה שמסומן באדום');
  // the first Escape closes the hint (the top layer), the second the window
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(publish).toBeHidden();

  // versions
  if (phone) {
    await page.getByRole('banner').getByRole('button', { name: 'פעולות נוספות' }).click();
    await page.getByRole('menuitem', { name: 'גרסאות' }).click();
  } else await page.getByRole('banner').getByRole('button', { name: 'גרסאות' }).click();
  const versions = page.getByRole('dialog', { name: 'גרסאות שפורסמו' });
  await explains(
    page,
    versions.getByTestId('area-help'),
    'גרסאות: מה כל כפתור עושה',
    ['באוויר', 'החזרה לטיוטה'],
    { assistant: false },
  );
  await expect(versions).toBeVisible();
});

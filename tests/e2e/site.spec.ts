import { expect, test } from '@playwright/test';
import pg from 'pg';

// The public site around the product: cookie consent, the accessibility menu, the policy pages and the
// contact form.

const LOCAL = !process.env.PW_BASE_URL;
const e2eDb = () => {
  const admin = new URL(
    process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  );
  return Object.assign(new URL(admin), { pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}` }).toString();
};

test('cookie consent: asked once, necessary only by default, changeable from the footer', async ({
  page,
}) => {
  await page.goto('/privacy');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  const banner = page.getByTestId('cookie-banner');
  await expect(banner.getByRole('heading', { name: 'אנחנו משתמשים בעוגיות' })).toBeVisible();
  await expect(banner.getByRole('link', { name: 'למדיניות העוגיות' })).toHaveAttribute('href', '/cookies');
  await banner.getByRole('button', { name: 'רק חיוניות' }).click();
  await expect(banner).toBeHidden();
  const consent = async () =>
    JSON.parse(
      decodeURIComponent((await page.context().cookies()).find((c) => c.name === 'cookie_consent')!.value),
    );
  expect(await consent()).toMatchObject({ v: 1, media: false });
  await page.reload();
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await expect(banner).toBeHidden();

  // the footer reopens it on the settings
  await page.getByRole('contentinfo').getByRole('button', { name: 'הגדרות עוגיות' }).click();
  await expect(banner.getByText('תמיד פעילות', { exact: true })).toBeVisible();
  const media = banner.getByRole('switch', { name: 'תוכן חיצוני' });
  await expect(media).not.toBeChecked();
  await media.click();
  await banner.getByRole('button', { name: 'שמירת ההגדרות' }).click();
  await expect(banner).toBeHidden();
  expect(await consent()).toMatchObject({ v: 1, media: true });
});

test('the accessibility menu: settings apply at once and stay after a reload', async ({ page }) => {
  await page.goto('/accessibility');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByTestId('cookie-banner').getByRole('button', { name: 'רק חיוניות' }).click();
  const html = page.locator('html');
  await page.getByTestId('a11y-button').click();
  const menu = page.getByRole('dialog', { name: 'נגישות' });
  await menu.getByRole('button', { name: 'הגדלת טקסט' }).click();
  await menu.getByRole('switch', { name: 'ניגודיות גבוהה' }).click();
  await menu.getByRole('switch', { name: 'עצירת אנימציות' }).click();
  await expect(html).toHaveAttribute('data-a11y-text', '1');
  await expect(html).toHaveAttribute('data-a11y-contrast', '');
  await expect(html).toHaveAttribute('data-a11y-motion', '');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.getByTestId('a11y-button')).toBeFocused();
  // applied before the page paints on the next visit
  await page.reload();
  await expect(html).toHaveAttribute('data-a11y-contrast', '');
  await expect(html).toHaveAttribute('data-a11y-text', '1');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByTestId('a11y-button').click();
  await page.getByRole('dialog', { name: 'נגישות' }).getByRole('button', { name: 'איפוס' }).click();
  await expect(html).not.toHaveAttribute('data-a11y-contrast', '');
  await expect(html).not.toHaveAttribute('data-a11y-text', /.+/);
});

test('the policy pages: privacy, terms, cookies and the accessibility statement', async ({ page }) => {
  for (const [path, title, section] of [
    ['/privacy', 'מדיניות פרטיות', '8. הזכויות שלכם'],
    ['/terms', 'תנאי שימוש', '7. ביטול והחזרים'],
    ['/cookies', 'מדיניות עוגיות', '1. עוגיות חיוניות (תמיד פעילות)'],
    ['/accessibility', 'הצהרת נגישות', '4. פנייה בנושא נגישות'],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: section })).toBeAttached();
    await expect(page.getByText(/עודכן לאחרונה: 24 בספטמבר 2026/)).toBeVisible();
    // every policy is linked from every page's footer
    const footer = page.getByRole('contentinfo');
    for (const name of ['מדיניות פרטיות', 'תנאי שימוש', 'מדיניות עוגיות', 'הצהרת נגישות'])
      await expect(footer.getByRole('link', { name })).toBeAttached();
  }
  // the plans' prices appear in the terms as on the pricing page
  await page.goto('/terms');
  await expect(page.getByText(/Pro ב־₪49 ו־Business ב־₪149 לחודש/)).toBeVisible();
  // English
  await page.context().addCookies([{ name: 'ui_lang', value: 'en', url: page.url() }]);
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('the contact form: checked in words, then stored', async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.77.${Math.floor(Math.random() * 250)}.${testInfo.workerIndex}`,
  });
  await page.goto('/contact?topic=accessibility');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByTestId('cookie-banner').getByRole('button', { name: 'רק חיוניות' }).click();
  const form = page.getByTestId('contact-form');
  await expect(form.getByRole('combobox', { name: 'נושא' })).toHaveValue('accessibility');
  await form.getByRole('button', { name: 'שליחה' }).click();
  await expect(form.getByText('שדה חובה').first()).toBeVisible();
  await expect(form.getByRole('textbox', { name: /^שם/ })).toBeFocused();
  const tag = `${testInfo.project.name}-${Date.now()}`;
  await form.getByRole('textbox', { name: /^שם/ }).fill(`דנה ${tag}`);
  await form.getByRole('textbox', { name: /^מייל/ }).fill('not-an-email');
  await form.getByRole('textbox', { name: /^ההודעה/ }).fill('הכפתור לא מוקרא בקורא המסך');
  await form.getByRole('button', { name: 'שליחה' }).click();
  await expect(form.getByText('כתובת המייל לא תקינה')).toBeVisible();
  await form.getByRole('textbox', { name: /^מייל/ }).fill('dana@example.com');
  await form.getByRole('button', { name: 'שליחה' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ההודעה נשלחה. תודה!' })).toBeVisible();
  if (!LOCAL) return;
  const client = new pg.Client({ connectionString: e2eDb() });
  await client.connect();
  try {
    const rows = (
      await client.query('select topic, email from contact_messages where name = $1', [`דנה ${tag}`])
    ).rows;
    expect(rows).toEqual([{ topic: 'accessibility', email: 'dana@example.com' }]);
  } finally {
    await client.end();
  }
});

test('the site skips to its content from the keyboard', async ({ page }) => {
  await page.goto('/terms');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'דילוג לתוכן' });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute('href', '#main');
});

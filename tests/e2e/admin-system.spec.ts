import { expect, test } from '@playwright/test';
import { audit, noSideScroll, offBecause, open, shot, staffMember, uiLang } from '../support/admin';

// The admin console's system status (/app/admin/system): the recurring jobs, the WhatsApp queues, the
// connected services as yes or no — never a value — the templates' languages, the designs' version in
// the database against the code's, the running build, and the live channel's "new name" for owners.
//
// (The rename itself isn't pressed here: the console has one live channel, and a new name would cut
// every other test's open console pages off it mid-run. tests/unit/admin-actions.test.ts and
// tests/db/admin.test.ts cover what it does.)

// the e2e server's secrets (playwright.config.ts): none of them may show, anywhere on the page
const SECRETS = [
  'e2e-whatsapp-token',
  'e2e-whatsapp-app-secret',
  'e2e-whatsapp-verify',
  'e2e-cron-secret',
  'e2e-partner-key',
  'e2e-anthropic-key',
  'e2e-tts-key',
  'local-secret',
  'e2e-salt',
];

test.describe('the admin console’s system status', () => {
  test('jobs, queues, services as yes or no — never a value — languages, designs and the build', async ({
    page,
  }) => {
    await staffMember(page, 'admin');
    await open(page, '/app/admin/system');
    await expect(page.getByRole('heading', { level: 1, name: 'מצב המערכת' })).toBeVisible();

    const jobs = page.getByTestId('admin-system-jobs');
    await expect(jobs.getByTestId('admin-job-daily')).toContainText('הריצה היומית');
    await expect(jobs.getByTestId('admin-job-daily')).toContainText('הבאה:');
    await expect(jobs.getByTestId('admin-job-whatsapp')).toContainText('תור הוואטסאפ');

    const queues = page.getByTestId('admin-system-queues');
    for (const kind of ['invitation', 'table', 'gallery'])
      await expect(queues.locator(`tr[data-kind="${kind}"] td`)).toHaveCount(4);

    const services = page.getByTestId('admin-system-services');
    const service = (name: string) => services.locator('li').filter({ hasText: name });
    const setUp = async (name: string, on: boolean) => {
      await expect(service(name)).toContainText('מוגדר');
      if (on) await expect(service(name)).not.toContainText('לא מוגדר');
      else await expect(service(name)).toContainText('לא מוגדר');
    };
    await setUp('וואטסאפ: המספר הרשמי', true);
    await setUp('וואטסאפ: תבנית מספר השולחן', true);
    await setUp('הקראה (Azure)', true);
    await setUp('מתזמן חיצוני (סוד ה־cron)', true);
    await setUp('תשלומים (PayPlus)', false);
    await setUp('המערכת מריצה עבודות בעצמה', false);
    await expect(service('מצב התשלומים')).toContainText('עמוד תשלום לבדיקה');
    await expect(page.getByTestId('admin-system-langs')).toHaveText('he, en, ru, ar');
    const html = await page.content();
    for (const secret of SECRETS) expect(html, `the page shows ${secret}`).not.toContain(secret);

    await expect(page.getByTestId('admin-system-seed')).toContainText('מעודכן');
    await expect(page.getByTestId('admin-system-commit')).toHaveText(/^([0-9a-f]{7,12}|בנייה מקומית)$/);

    // the live channel: only owners give it a new name
    await offBecause(page, page.getByTestId('admin-system-rename'), 'רק בעלים יכולים לתת לערוץ שם חדש.');
  });

  test('an owner may give the live channel a new name: the dialog says what happens, and nothing does until confirmed', async ({
    page,
  }) => {
    await staffMember(page, 'owner');
    await open(page, '/app/admin/system');
    await expect(page.getByTestId('admin-system-channel')).toContainText('הערוץ החי של הניהול');
    await page.getByTestId('admin-system-rename').click();
    const dialog = page.getByRole('dialog', { name: 'לתת לערוץ החי שם חדש?' });
    await expect(dialog).toContainText('כל דף ניהול שפתוח עכשיו (גם במכשירים אחרים) יפסיק להתעדכן לבד');
    // no reason asked: nothing about a customer changes
    await expect(dialog.locator('textarea')).toHaveCount(0);
    await expect(page.getByTestId('admin-rename-dialog-confirm')).toBeEnabled();
    await audit(page, 'admin-rename-dialog', '[role="dialog"]');
    await dialog.getByRole('button', { name: 'ביטול' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('admin-live').first()).toHaveAttribute('data-state', 'live');
  });

  test('in Hebrew and English: accessible, and nothing overflows the page', async ({ page }) => {
    await staffMember(page, 'owner');
    for (const lang of ['he', 'en'] as const) {
      await uiLang(page, lang);
      await open(page, '/app/admin/system');
      await expect(page.getByTestId('admin-system-services')).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-system-${lang}`);
      await shot(page, `${lang}-system`, true);
    }
  });
});

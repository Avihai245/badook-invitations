import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { hydrated, LOCAL, sql } from '../support/phase5b';
import { audit, numberIn, openConsole, signInStaff, uiLanguage, unique, waitLive } from '../support/admin-c';

// The admin console's cash flow (/app/admin/finance, features/admin/finance): seeded payments show the
// right numbers, the spreadsheet downloads (in the console's language), a viewer sees the numbers
// without contact details and without the export, a payment in another browser shows up by itself,
// and the page passes an accessibility audit in Hebrew and English (both projects: phone, desktop).

test.skip(!LOCAL, 'seeds payments in the local stack');

/**
 * A customer with payments in March 2021 (a month no other test pays in): Pro and a message pack paid,
 * a Business renewal, a failed purchase, and two packs at the month's edges in Israel — one in the first
 * minutes of March (still February in UTC), one in the last minutes of February.
 */
async function seedCustomer(tag: string) {
  const email = `fin-${tag}@example.com`;
  const { id } = (
    await sql<{ id: string }>(
      `insert into auth.users (id, email, raw_app_meta_data, created_at)
     values (gen_random_uuid(), $1, '{"provider":"email","providers":["email"]}', '2021-02-01')
     returning id`,
      [email],
    )
  )[0]!;
  await sql(`insert into public.accounts (user_id, full_name) values ($1, $2)`, [id, `לקוחת תזרים ${tag}`]);
  for (const [product, amount, status, at, ref] of [
    ['pro', 49, 'paid', '2021-03-03T10:00:00+02:00', `${tag}-pro`],
    ['credits_300', 46.2, 'paid', '2021-03-10T10:00:00+02:00', `${tag}-300`],
    ['pro', 49, 'failed', '2021-03-21T10:00:00+02:00', `${tag}-failed`],
    ['credits_100', 15.4, 'paid', '2021-02-28T22:30:00Z', `${tag}-first`],
    ['credits_100', 15.4, 'paid', '2021-02-28T21:30:00Z', `${tag}-february`],
  ] as const)
    await sql(
      `insert into public.billing_checkouts (user_id, product, amount, provider, provider_ref, status, created_at, completed_at)
       values ($1, $2, $3, 'test', $4, $5, $6, $6)`,
      [id, product, amount, ref, status, at],
    );
  await sql(
    `insert into public.billing_events (id, provider, type, user_id, product, amount, created_at)
     values ($1, 'test', 'renewal.paid', $2, 'business', 149, '2021-03-20T10:00:00+02:00')`,
    [`test:${tag}:renewal`, id],
  );
  return { id, email };
}

const march = (tag: string) =>
  `/app/admin/finance?from=2021-03-01&to=2021-03-31&q=${encodeURIComponent(tag)}`;
const shown = (page: Page) => page.locator('[data-testid=payments] [data-payment]:visible');

test.describe('the cash flow', () => {
  test('seeded payments show the right numbers; the spreadsheet downloads in the console’s language', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const tag = unique('fin');
    await seedCustomer(tag);
    const staff = await signInStaff(page, 'finance');
    await openConsole(page, march(tag));
    await expect(page.getByRole('heading', { level: 1, name: 'תזרים' })).toBeVisible();

    // March in Israel: four paid (₪259.60) and a failed one; the last minutes of February aren't in it
    await expect(shown(page)).toHaveCount(5);
    const summary = page.getByTestId('payments-summary');
    await expect(summary).toContainText('5');
    expect(numberIn((await summary.textContent())!.split('·')[1] ?? '')).toBe(259.6);
    const rows = await shown(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-status')));
    expect(rows).toEqual(['failed', 'paid', 'paid', 'paid', 'paid']);
    await expect(page.getByTestId('payments')).toContainText(`fin-${tag}@example.com`);

    // only the paid ones
    await openConsole(page, `${march(tag)}&status=paid`);
    await expect(shown(page)).toHaveCount(4);

    // the spreadsheet: every payment the filters match, Hebrew headers, Israel's time
    await openConsole(page, march(tag));
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('finance-export').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^badook-payments-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await download.path())!, 'utf8');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('תאריך,סוג,לקוח,מייל,מוצר,סכום (₪ כולל מע״מ),סטטוס,ספק,אסמכתה');
    expect(lines.slice(1)).toEqual([
      `2021-03-21 10:00,רכישה,לקוחת תזרים ${tag},fin-${tag}@example.com,Pro,49,נכשל,test,${tag}-failed`,
      `2021-03-20 10:00,חידוש,לקוחת תזרים ${tag},fin-${tag}@example.com,Business,149,שולם,test,test:${tag}:renewal`,
      `2021-03-10 10:00,רכישה,לקוחת תזרים ${tag},fin-${tag}@example.com,300 הודעות,46.2,שולם,test,${tag}-300`,
      `2021-03-03 10:00,רכישה,לקוחת תזרים ${tag},fin-${tag}@example.com,Pro,49,שולם,test,${tag}-pro`,
      `2021-03-01 00:30,רכישה,לקוחת תזרים ${tag},fin-${tag}@example.com,100 הודעות,15.4,שולם,test,${tag}-first`,
    ]);
    // recorded in the record of actions
    await expect
      .poll(async () =>
        (
          await sql<{ rows: number }>(
            `select (details->>'rows')::int as rows from public.admin_audit
             where action = 'finance.export' and actor_email = $1`,
            [staff],
          )
        ).map((r) => r.rows),
      )
      .toEqual([5]);

    // in English: English headers
    await uiLanguage(page, 'en');
    await openConsole(page, march(tag));
    await expect(page.getByRole('heading', { level: 1, name: 'Cash flow' })).toBeVisible();
    const [english] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('finance-export').click(),
    ]);
    const en = readFileSync((await english.path())!, 'utf8')
      .slice(1)
      .split('\r\n');
    expect(en[0]).toBe('Date,Type,Customer,Email,Product,Amount (₪ incl. VAT),Status,Provider,Reference');
    expect(en[1]).toBe(
      `2021-03-21 10:00,Purchase,לקוחת תזרים ${tag},fin-${tag}@example.com,Pro,49,Failed,test,${tag}-failed`,
    );
  });

  test('a viewer sees the numbers without contact details and without the export; support not at all', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const tag = unique('finv');
    await seedCustomer(tag);
    await signInStaff(page, 'viewer');
    await openConsole(page, march(tag));
    await expect(shown(page)).toHaveCount(5);
    await expect(page.getByTestId('payments')).toContainText('f***@example.com');
    expect(await page.content()).not.toContain(`fin-${tag}@example.com`);
    await expect(page.getByText('פרטי הקשר מוסתרים לתפקיד שלך.').first()).toBeVisible();
    // the export: disabled, and refused by the server
    await expect(page.getByTestId('finance-export')).toBeDisabled();
    expect((await page.request.get('/api/admin/finance/export')).status()).toBe(403);
    // an email the viewer doesn't see finds nothing
    await openConsole(page, `/app/admin/finance?from=2021-03-01&to=2021-03-31&q=fin-${tag}%40`);
    await expect(shown(page)).toHaveCount(0);

    // support has no cash flow: back to the overview, with a note
    const other = await browser.newContext();
    const support = await other.newPage();
    await signInStaff(support, 'support');
    await support.goto('/app/admin/finance');
    await support.waitForURL(/\/app\/admin\?denied=finance\.view$/);
    expect((await support.request.get('/api/admin/finance/export')).status()).toBe(403);
    await other.close();
  });

  test('a payment in another browser shows up by itself; this month’s income is the database’s', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await signInStaff(page, 'finance');
    const host = `fin-host-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await openConsole(page, `/app/admin/finance?q=${encodeURIComponent(host)}`);
    await waitLive(page);
    await expect(shown(page)).toHaveCount(0);
    await page.evaluate(() => ((window as unknown as { __stay: boolean }).__stay = true));

    // a host buys 100 WhatsApp messages in another browser
    const other = await browser.newContext();
    const buyer = await other.newPage();
    await buyer.goto('/signup');
    await buyer.fill('input[name=email]', host);
    await buyer.fill('input[name=password]', 'a-good-password');
    await buyer.click('form:has(input[name=password]) button[type=submit]');
    await buyer.waitForURL(/\/app\/invitations$/);
    await buyer.goto('/app/billing');
    await hydrated(buyer);
    await buyer.locator('[data-pack="100"]').getByRole('button', { name: 'קנייה' }).click();
    await buyer.waitForURL(/\/app\/billing\/test-checkout\?id=/);
    await hydrated(buyer);
    await buyer.getByRole('button', { name: 'תשלום (בדיקה)' }).click();
    await buyer.waitForURL(/\/app\/billing\?status=/);
    // (the billing page settled before its browser goes: no request cut off halfway)
    await hydrated(buyer);
    await buyer.waitForLoadState('networkidle');
    await other.close();

    // the open page, without reloading
    await expect(shown(page)).toHaveCount(1, { timeout: 20_000 });
    await expect(shown(page).first()).toHaveAttribute('data-status', 'paid');
    await expect(page.getByTestId('payments')).toContainText('100');
    expect(await page.evaluate(() => (window as unknown as { __stay?: boolean }).__stay)).toBe(true);

    // this month's income (Israel): what the database adds up — other tests pay at the same time
    await expect(async () => {
      const { total } = (
        await sql<{ total: string }>(
          `select coalesce(sum(amount), 0) as total from (
           select amount, coalesce(completed_at, created_at) as at from public.billing_checkouts where status = 'paid'
           union all select amount, created_at from public.billing_events where type = 'renewal.paid') p
         where at >= date_trunc('month', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'`,
        )
      )[0]!;
      await page.reload();
      await hydrated(page);
      const tile = numberIn(await page.getByTestId('kpi-income').locator('dd').first().textContent());
      const expected = Number(total);
      expect(tile).toBe(expected >= 1000 ? Math.round(expected) : Math.round(expected * 100) / 100);
    }).toPass({ timeout: 30_000 });
  });

  for (const lang of ['he', 'en'] as const)
    test(`passes an accessibility audit · ${lang}`, async ({ page }) => {
      test.setTimeout(90_000);
      const tag = unique('fina');
      await seedCustomer(tag);
      await signInStaff(page, 'owner');
      await uiLanguage(page, lang);
      await openConsole(page, march(tag));
      await expect(shown(page)).toHaveCount(5);
      await audit(page, `finance-${lang}`);
      // the chart's table open, the 90 days chosen
      await page.getByRole('radio', { name: lang === 'he' ? '90 ימים' : '90 days' }).click();
      await page.locator('#daily summary').click();
      await audit(page, `finance-${lang}-table`);
    });
});

import { expect, test } from '@playwright/test';
import {
  act,
  audit,
  createInvitation,
  customer,
  digitsOf,
  done,
  listed,
  live,
  mark,
  noSideScroll,
  offBecause,
  open,
  openListed,
  shot,
  signIn,
  sql,
  staffMember,
  stillMarked,
  uiLang,
} from '../support/admin';

// The admin console's users (/app/admin/users and a user's page): finding a customer, what the team
// may do to them — credits, a plan as a gift, a discount, sign-in suspended — each with a reason, what
// the customer sees of it, what each role may do, and the page following the customer live.

test.describe('the admin console’s users', () => {
  test('credits added and taken back with a reason: the customer’s billing says the team did it; the page follows the customer live', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await staffMember(page, 'owner', 'אביחי');
    const host = await customer(browser, 'דנה קרדיטים');

    // found by their email; their page
    await open(page, `/app/admin/users?q=${encodeURIComponent(host.email)}`);
    await expect(page.getByTestId('admin-users-total')).toHaveText('משתמש אחד');
    await openListed(page, 'data-user', host.userId);
    await page.waitForURL(new RegExp(`/app/admin/users/${host.userId}$`));
    await expect(page.getByTestId('admin-user-name')).toHaveText('דנה קרדיטים');
    await expect(page.getByTestId('admin-user-email')).toHaveText(host.email);
    await live(page);

    // the customer creates an invitation: it shows up on the open page by itself
    await mark(page);
    const bride = `כלה${Date.now().toString(36)}`;
    await createInvitation(host.page, bride, 'חתן');
    await expect(page.getByTestId('admin-user-invitations')).toContainText(`${bride} & חתן`, {
      timeout: 25_000,
    });
    expect(await stillMarked(page)).toBe(true);

    // 25 credits with a reason
    const before = await digitsOf(page.getByTestId('admin-user-credits'));
    await page.getByTestId('admin-action-credits').click();
    await act(page, 'admin-credits-dialog', 'פיצוי על תקלה בשליחה', async (form) => {
      await form.locator('input[name=amount]').fill('25');
      await expect(form).toContainText(`יתווספו 25 קרדיטים. היתרה תהיה ${before + 25}`);
    });
    await done(page, `היתרה של דנה קרדיטים עכשיו ${before + 25}`);
    await expect(page.getByTestId('admin-user-credits')).toHaveText(String(before + 25));
    // the ledger: the team, who and why
    const ledger = page.getByTestId('admin-user-ledger');
    await expect(ledger).toContainText('הצוות');
    await expect(ledger).toContainText('אביחי: פיצוי על תקלה בשליחה');

    // then 5 taken back
    await page.getByTestId('admin-action-credits').click();
    await act(page, 'admin-credits-dialog', 'תיקון טעות בהוספה', async (form) => {
      await form.getByRole('radio', { name: 'הורדה' }).click();
      await form.locator('input[name=amount]').fill('5');
    });
    await done(page, `היתרה של דנה קרדיטים עכשיו ${before + 20}`);

    // the customer's billing screen: added and removed by the Badook team, no names, no reasons
    await open(host.page, '/app/billing');
    await expect(host.page.getByText('נוסף על ידי צוות Badook')).toBeVisible();
    await expect(host.page.getByText('הוסר על ידי צוות Badook')).toBeVisible();
    await expect(host.page.locator('main')).not.toContainText('פיצוי על תקלה');
    await expect(host.page.locator('main')).not.toContainText('אביחי');

    // the user's own record of actions, in words
    const record = page.getByTestId('admin-user-audit');
    await expect(record).toContainText('אביחי הוסיף 25 קרדיטים ל־דנה קרדיטים');
    await expect(record).toContainText('סיבה: פיצוי על תקלה בשליחה');
    await host.context.close();
  });

  test('a plan as a gift: no charge and nothing to cancel on the billing screen, back to Free when taken back; a discount from the team', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await staffMember(page, 'admin', 'מיכל');
    const host = await customer(browser, 'יעל מתנה');
    await open(page, `/app/admin/users/${host.userId}`);

    await page.getByTestId('admin-action-gift').click();
    await act(page, 'admin-gift-dialog', 'זוג שהתחתן אצלנו בעבר', async (form) => {
      await form.getByRole('radio', { name: 'Business' }).click();
      await expect(form).toContainText('יעל מתנה יקבל את חבילת Business עד');
    });
    await done(page, 'חבילת Business במתנה ל־יעל מתנה');
    await expect(page.getByTestId('admin-user-effective-plan')).toHaveText('Business');
    await expect(page.getByTestId('admin-user-plan')).toContainText('מתנה מהצוות עד');

    // the customer: Business as a gift from the Badook team, nothing to cancel
    await open(host.page, '/app/billing');
    const current = host.page.getByTestId('current-plan');
    await expect(current).toContainText('Business');
    await expect(host.page.getByTestId('plan-gift')).toHaveText('מתנה');
    await expect(current).toContainText('מתנה מצוות Badook עד');
    await expect(host.page.getByRole('button', { name: 'ביטול המנוי' })).toHaveCount(0);
    await expect(host.page.getByRole('button', { name: 'מעבר לחינם' })).toHaveCount(0);

    // a discount from the team: never credited to Badook Events
    await page.getByTestId('admin-action-discount').click();
    await act(page, 'admin-discount-dialog', 'הנחת נאמנות', async (form) => {
      // more than 90% isn't on offer
      await form.locator('input[name=percent]').fill('95');
      await form.locator('textarea[name=reason]').fill('הנחת נאמנות');
      await expect(page.getByTestId('admin-discount-dialog-confirm')).toBeDisabled();
      await form.locator('input[name=percent]').fill('20');
      await form.locator('input[name=note]').fill('סוכם בטלפון');
    });
    await done(page, 'הנחה של 20% ל־יעל מתנה');
    await expect(page.getByTestId('admin-user-discount')).toContainText('20% בלי תאריך סיום · מהצוות');
    await expect(page.getByTestId('admin-user-discount')).toContainText('הערה: סוכם בטלפון');
    await host.page.reload();
    const discount = host.page.getByTestId('discount');
    await expect(discount).toContainText('הנחה של 20% על החבילות');
    await expect(discount).toContainText('מצוות Badook');
    await expect(discount).not.toContainText('Badook Events');
    await expect(discount).not.toContainText('סוכם בטלפון');

    // the gift taken back: Free at once
    await page.getByTestId('admin-action-ungift').click();
    await act(page, 'admin-ungift-dialog', 'ניתנה בטעות');
    await done(page, 'המתנה של יעל מתנה בוטלה');
    await expect(page.getByTestId('admin-user-effective-plan')).toHaveText('Free');
    await host.page.reload();
    await expect(host.page.getByTestId('plan-gift')).toHaveCount(0);
    await expect(host.page.getByTestId('current-plan')).toContainText('חינם, בלי הגבלת זמן');

    // and the discount removed
    await page.getByTestId('admin-action-undiscount').click();
    await act(page, 'admin-undiscount-dialog', 'ההנחה הסתיימה');
    await done(page, 'ההנחה של יעל מתנה הוסרה');
    await host.page.reload();
    await expect(host.page.getByTestId('discount')).toHaveCount(0);
    await host.context.close();
  });

  test('sign-in suspended: the customer is signed out at once and told why; restored, they sign in again', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await staffMember(page, 'admin', 'רון');
    const host = await customer(browser, 'אבי חסום');
    await open(page, `/app/admin/users/${host.userId}`);

    await page.getByTestId('admin-action-suspend').click();
    await act(page, 'admin-suspend-dialog', 'ניסיונות הונאה בתשלום');
    await done(page, 'הכניסה של אבי חסום נחסמה');
    await expect(page.getByTestId('admin-user-suspended')).toBeVisible();

    // the session they still hold opens nothing: the API first, then their next page
    const api = await host.page.request.post('/api/invitations', { data: {} });
    expect(api.status()).toBe(401);
    await host.page.reload();
    await host.page.waitForURL(/\/login\?/);
    await expect(host.page.getByText('הכניסה לחשבון הזה הושעתה על ידי צוות Badook')).toBeVisible();
    // and signing in again is refused, with the reason
    await signIn(host.page, host.email);
    await expect(host.page.getByText('הכניסה לחשבון הזה הושעתה על ידי צוות Badook')).toBeVisible();
    await expect(host.page).toHaveURL(/\/login/);

    await page.getByTestId('admin-action-restore').click();
    await act(page, 'admin-restore-dialog', 'הבירור הסתיים');
    await done(page, 'הכניסה של אבי חסום הוחזרה');
    await expect(page.getByTestId('admin-user-suspended')).toHaveCount(0);
    await signIn(host.page, host.email);
    await host.page.waitForURL(/\/app\/invitations$/);
    await host.context.close();
  });

  test('each role its own: a viewer sees contact details masked and every action off, and why; support up to 100 credits; nobody suspends themselves or a teammate of their rank', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const host = await customer(browser, 'שירה פרטית');

    // a viewer: masked, searches by name only, every action off
    const viewer = await browser.newContext();
    const vp = await viewer.newPage();
    await staffMember(vp, 'viewer');
    await open(vp, `/app/admin/users?q=${encodeURIComponent(host.email)}`);
    await expect(vp.getByTestId('admin-users-total')).toHaveText('0 משתמשים');
    await open(vp, `/app/admin/users?q=${encodeURIComponent('שירה פרטית')}`);
    await expect(listed(vp, 'data-user', host.userId)).toHaveCount(1);
    await open(vp, `/app/admin/users/${host.userId}`);
    await expect(vp.getByTestId('admin-user-email')).toHaveText(/^a\*\*\*@example\.com$/);
    await expect(vp.getByTestId('admin-user-identity')).toContainText(
      'פרטי קשר מוצגים רק לתפקידים עם הרשאה לכך.',
    );
    await expect(vp.locator('main')).not.toContainText(host.email);
    for (const action of ['credits', 'gift', 'discount', 'suspend'])
      await expect(vp.getByTestId(`admin-action-${action}`)).toBeDisabled();
    await offBecause(vp, vp.getByTestId('admin-action-credits'), 'לתפקיד שלך אין הרשאה לפעולה הזו.');
    // and the API says the same
    const refused = await vp.request.post(`/api/admin/users/${host.userId}/credits`, {
      data: { delta: 5, reason: 'ניסיון' },
    });
    expect(refused.status()).toBe(403);
    await viewer.close();

    // support: credits up to 100 at a time (the database checks it again); no gifts, discounts or suspensions
    await staffMember(page, 'support');
    await open(page, `/app/admin/users/${host.userId}`);
    await expect(page.getByTestId('admin-user-email')).toHaveText(host.email);
    await offBecause(page, page.getByTestId('admin-action-gift'), 'לתפקיד שלך אין הרשאה לפעולה הזו.');
    await expect(page.getByTestId('admin-action-discount')).toBeDisabled();
    await expect(page.getByTestId('admin-action-suspend')).toBeDisabled();
    await page.getByTestId('admin-action-credits').click();
    const form = page.getByTestId('admin-credits-dialog');
    await expect(form).toContainText('עד 100 בפעולה אחת לתפקיד שלך.');
    await form.locator('input[name=amount]').fill('101');
    await form.locator('textarea[name=reason]').fill('בקשה של הלקוח');
    await expect(page.getByTestId('admin-credits-dialog-confirm')).toBeDisabled();
    await page.keyboard.press('Escape');
    const over = await page.request.post(`/api/admin/users/${host.userId}/credits`, {
      data: { delta: 150, reason: 'בקשה של הלקוח' },
    });
    expect(over.status()).toBe(409);
    expect(await over.json()).toMatchObject({ code: 'over_cap' });

    // an admin: not themselves, not a teammate of their rank (the database refuses it too)
    const admin = await browser.newContext();
    const ap = await admin.newPage();
    const adminEmail = await staffMember(ap, 'admin');
    const other = await browser.newContext();
    const otherEmail = await staffMember(await other.newPage(), 'admin');
    const ids = await sql<{ id: string; email: string }>(
      `select id, email from auth.users where email = any($1)`,
      [[adminEmail, otherEmail]],
    );
    const idOf = (email: string) => ids.find((r) => r.email === email)!.id;
    await open(ap, `/app/admin/users/${idOf(adminEmail)}`);
    await offBecause(ap, ap.getByTestId('admin-action-suspend'), 'אי אפשר לחסום את עצמך.');
    await open(ap, `/app/admin/users/${idOf(otherEmail)}`);
    await offBecause(
      ap,
      ap.getByTestId('admin-action-suspend'),
      'אי אפשר לחסום חבר צוות בתפקיד שלך או מעליו.',
    );
    const rank = await ap.request.post(`/api/admin/users/${idOf(otherEmail)}/suspend`, {
      data: { suspend: true, reason: 'ניסיון' },
    });
    expect(rank.status()).toBe(409);
    expect(await rank.json()).toMatchObject({ code: 'staff_rank' });
    await admin.close();
    await other.close();
    await host.context.close();
  });

  test('in Hebrew and English: accessible, and nothing overflows the page', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const host = await customer(browser, 'נגה נגישה');
    await createInvitation(host.page, 'נגה', 'עומר');
    await staffMember(page, 'owner');
    // a bit of everything on the user's page
    for (const delta of [30, -4])
      await page.request.post(`/api/admin/users/${host.userId}/credits`, {
        data: { delta, reason: 'בדיקת נגישות' },
      });
    for (const lang of ['he', 'en'] as const) {
      await uiLang(page, lang);
      await open(page, '/app/admin/users');
      await expect(listed(page, 'data-user', host.userId).first()).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-users-${lang}`);
      await shot(page, `${lang}-users`, true);

      await open(page, `/app/admin/users/${host.userId}`);
      await expect(page.getByTestId('admin-user-ledger')).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-user-${lang}`);
      await shot(page, `${lang}-user`, true);

      // an action's dialog too
      await page.getByTestId('admin-action-credits').click();
      await expect(page.getByTestId('admin-credits-dialog')).toBeVisible();
      await audit(page, `admin-credits-dialog-${lang}`, '[role="dialog"]');
      await shot(page, `${lang}-credits-dialog`);
      await page.keyboard.press('Escape');
    }
    await host.context.close();
  });
});

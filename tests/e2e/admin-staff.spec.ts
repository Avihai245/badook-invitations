import { expect, test, type Page } from '@playwright/test';
import {
  act,
  audit,
  done,
  live,
  mark,
  noSideScroll,
  offBecause,
  open,
  shot,
  signUpAs,
  sql,
  staffMember,
  stillMarked,
  uiLang,
  unique,
} from '../support/admin';

// The admin console's staff and permissions (/app/admin/staff): who is on the team, in which role,
// whether their account can use the console yet (it follows their sign-up live), adding, changing and
// removing a member with a reason — only the roles one's own role may manage, the database refusing the
// rest in words — the platform's owners locked "from the settings", and what each role may do.

const row = (page: Page, email: string) =>
  page.getByTestId('admin-staff-list').locator(`tr[data-email="${email}"]`);

test.describe('the admin console’s staff', () => {
  test('an owner adds a member with a reason; their state follows their sign-up live; a new role; removed', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await staffMember(page, 'owner', 'אביחי');
    await open(page, '/app/admin/staff');
    await live(page);
    const email = unique('adm-a-joins');

    await page.getByTestId('admin-staff-add').click();
    await act(page, 'admin-staff-add-dialog', 'מצטרף לצוות התמיכה', async (form) => {
      await form.locator('input[name=email]').fill(email);
      await form.locator('select[name=role]').selectOption('support');
      await form.locator('input[name=note]').fill('עונה לפניות בערבים');
      await expect(form).toContainText(`${email} יצורף לצוות בתפקיד תמיכה`);
    });
    await done(page, `${email} נוסף לצוות`);
    await expect(row(page, email)).toHaveAttribute('data-role', 'support');
    await expect(row(page, email)).toContainText('עוד לא נרשם');
    await expect(row(page, email)).toContainText('עונה לפניות בערבים');

    // they sign up in another browser: the open page says they can come in now, by itself
    await mark(page);
    const member = await browser.newContext();
    const mp = await member.newPage();
    await signUpAs(mp, email, 'נועם');
    await expect(row(page, email)).toContainText('יכול להיכנס לניהול', { timeout: 25_000 });
    expect(await stillMarked(page)).toBe(true);
    await open(mp, '/app/admin/support');
    await expect(mp.getByRole('heading', { level: 1 })).toBeVisible();

    // a new role
    await row(page, email).getByTestId('admin-staff-change').click();
    await act(page, 'admin-staff-change-dialog', 'עובר לטפל בחשבוניות', async (form) => {
      await form.locator('select[name=role]').selectOption('finance');
      await expect(form).toContainText('כספים: לקוחות, קרדיטים ותזרים, כולל ייצוא.');
    });
    await done(page, `התפקיד של ${email} עודכן`);
    await expect(row(page, email)).toHaveAttribute('data-role', 'finance');
    // support isn't theirs anymore
    await mp.goto('/app/admin/support');
    await mp.waitForURL(/\/app\/admin\?denied=support\.view$/);

    // removed: the console is closed to them
    await row(page, email).getByTestId('admin-staff-remove').click();
    await act(page, 'admin-staff-remove-dialog', 'סיים את העבודה אצלנו');
    await done(page, `${email} הוצא מהצוות`);
    await expect(row(page, email)).toHaveCount(0);
    expect((await mp.goto('/app/admin'))?.status()).toBe(404);

    // all three in the record of actions, with their reasons (a member with an account by their name)
    await open(page, `/app/admin/audit?targetType=staff&targetId=${encodeURIComponent(email)}`);
    const list = page.getByTestId('admin-audit-list');
    await expect(list).toContainText('אביחי צירף את נועם לצוות בתפקיד תמיכה');
    await expect(list).toContainText('אביחי שינה את התפקיד של נועם: תמיכה ← כספים');
    await expect(list).toContainText('אביחי הסיר את נועם מהצוות (כספים)');
    await expect(list).toContainText('סיבה: מצטרף לצוות התמיכה');
    await expect(list).toContainText('הערה: עונה לפניות בערבים');
    await member.close();
  });

  test('the platform’s owners are locked “from the settings”; an admin manages every role but the owners, and the database refuses the rest in words', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const owner = unique('adm-a-console-owner');
    await sql(`insert into public.admin_staff (email, role) values ($1, 'owner')`, [owner]);
    const me = await staffMember(page, 'admin', 'מיכל');
    await open(page, '/app/admin/staff');

    // one of INVITES_ADMIN_EMAILS: from the settings, nothing to change here
    const envOwner = row(page, 'admin-owner-desktop@example.com');
    await expect(envOwner).toContainText('מההגדרות');
    await offBecause(
      page,
      envOwner.getByTestId('admin-staff-change'),
      'מבעלי הפלטפורמה: משנים אותם בהגדרות השרת.',
    );
    // an owner added in the console: above an admin
    await offBecause(
      page,
      row(page, owner).getByTestId('admin-staff-remove'),
      'לתפקיד שלך אין הרשאה לנהל את התפקיד הזה.',
    );
    // oneself
    await offBecause(
      page,
      row(page, me).getByTestId('admin-staff-change'),
      'אי אפשר לשנות את התפקיד של עצמך.',
    );

    // adding: every role but owner
    await page.getByTestId('admin-staff-add').click();
    const roles = await page
      .getByTestId('admin-staff-add-dialog')
      .locator('select[name=role] option')
      .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
    expect(roles).toEqual(['admin', 'support', 'finance', 'viewer']);
    await page.keyboard.press('Escape');

    // what the screen doesn't offer, the database refuses: an owner, an owner removed
    const add = await page.request.post('/api/admin/staff', {
      data: { email: unique('adm-a-would-be-owner'), role: 'owner', note: null, reason: 'ניסיון' },
    });
    expect(add.status()).toBe(403);
    const remove = await page.request.delete('/api/admin/staff', {
      data: { email: owner, reason: 'ניסיון' },
    });
    expect(remove.status()).toBe(403);
    // and an owner can't touch the platform's owners either
    const ownerPage = await browser.newContext();
    const op = await ownerPage.newPage();
    await staffMember(op, 'owner');
    const env = await op.request.post('/api/admin/staff', {
      data: { email: 'admin-owner-desktop@example.com', role: 'admin', note: null, reason: 'ניסיון' },
    });
    expect(env.status()).toBe(409);
    expect(await env.json()).toMatchObject({ code: 'managed_by_env' });
    await ownerPage.close();
  });

  test('in Hebrew and English: accessible, the roles’ table included, and nothing overflows the page', async ({
    page,
  }) => {
    // two languages, each audited (axe takes its time on a busy machine)
    test.setTimeout(120_000);
    await staffMember(page, 'owner');
    for (const lang of ['he', 'en'] as const) {
      await uiLang(page, lang);
      await open(page, '/app/admin/staff');
      await expect(page.getByTestId('admin-permissions')).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-staff-${lang}`);
      await shot(page, `${lang}-staff`, true);
      await page.getByTestId('admin-staff-add').click();
      await expect(page.getByTestId('admin-staff-add-dialog')).toBeVisible();
      await audit(page, `admin-staff-add-${lang}`, '[role="dialog"]');
      await page.keyboard.press('Escape');
    }
  });
});

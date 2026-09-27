import { expect, test } from '@playwright/test';
import {
  audit,
  customer,
  live,
  mark,
  noSideScroll,
  open,
  shot,
  sql,
  staffMember,
  stillMarked,
  uiLang,
} from '../support/admin';

// The admin console's record of actions (/app/admin/audit): every action of the team in words — who
// did what to whom, the reason, when — newest first, 50 a page (by id), filtered by who, what and about
// what, each line leading to what it was about, and new actions showing up live.

const idOf = async (email: string) =>
  (await sql<{ id: string }>(`select id from auth.users where email = $1`, [email]))[0]!.id;

test.describe('the admin console’s record of actions', () => {
  test('each action in words with its reason, newest first; filters; a line leads to its subject; new ones show up live', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const host = await customer(browser, 'דנה יומן');
    const ownerEmail = await staffMember(page, 'owner', 'אביחי');
    const owner = await idOf(ownerEmail);
    const lastDay = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    for (const [path, data] of [
      ['credits', { delta: 10, reason: 'פיצוי על עיכוב' }],
      ['gift', { plan: 'pro', lastDay, reason: 'זוג מהאולם השותף' }],
    ] as const) {
      const res = await page.request.post(`/api/admin/users/${host.userId}/${path}`, { data });
      expect(res.ok(), await res.text()).toBe(true);
    }

    // who: the actor's own actions, newest first
    await open(page, '/app/admin/audit');
    await page.getByTestId('admin-audit-actor').selectOption(owner);
    await expect(page).toHaveURL(new RegExp(`[?&]actor=${owner}`));
    const lines = page.getByTestId('admin-audit-text');
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(0)).toHaveText(
      /^אביחי העניק ל־דנה יומן את חבילת Pro במתנה עד \d{1,2} ב\S+ \d{4}$/,
    );
    await expect(lines.nth(1)).toHaveText('אביחי הוסיף 10 קרדיטים ל־דנה יומן');
    const list = page.getByTestId('admin-audit-list');
    await expect(list.locator('li').nth(1)).toContainText('סיבה: פיצוי על עיכוב');
    await expect(list.locator('li').nth(1)).toContainText(/היתרה: \d+ ← \d+/);

    // what: only the credits
    await page.getByTestId('admin-audit-action').selectOption('users.credits');
    await expect(lines).toHaveCount(1);
    await expect(lines.first()).toHaveText('אביחי הוסיף 10 קרדיטים ל־דנה יומן');
    // about what: nothing of theirs on invitations
    await page.getByTestId('admin-audit-target').selectOption('invitation');
    await expect(page.getByText('אין פעולות שמתאימות לסינון.')).toBeVisible();
    await page.getByRole('button', { name: 'ניקוי הסינון' }).click();
    await expect(page).toHaveURL(/\/app\/admin\/audit$/);

    // a line leads to what it is about
    await open(page, `/app/admin/audit?actor=${owner}`);
    await lines.nth(1).getByRole('link').click();
    await page.waitForURL(new RegExp(`/app/admin/users/${host.userId}$`));

    // another member acts: the open record shows it by itself
    await open(page, `/app/admin/audit?targetType=user&targetId=${host.userId}`);
    await expect(page.getByRole('button', { name: 'רק על: דנה יומן' })).toBeVisible();
    await live(page);
    await mark(page);
    const other = await browser.newContext();
    const op = await other.newPage();
    await staffMember(op, 'admin', 'מיכל');
    const res = await op.request.post(`/api/admin/users/${host.userId}/discount`, {
      data: { percent: 15, lastDay: null, note: null, reason: 'לקוחה חוזרת' },
    });
    expect(res.ok(), await res.text()).toBe(true);
    await expect(lines.first()).toHaveText('מיכל נתן ל־דנה יומן הנחה של 15% בלי תאריך סיום', {
      timeout: 25_000,
    });
    await expect(list.locator('li').first()).toContainText('סיבה: לקוחה חוזרת');
    expect(await stillMarked(page)).toBe(true);
    await other.close();
    await host.context.close();
  });

  test('50 a page: older ones a page at a time, and back to the newest', async ({ page }) => {
    test.setTimeout(90_000);
    const email = await staffMember(page, 'owner', 'אביחי');
    const actor = await idOf(email);
    // 55 of this member's actions
    await sql(
      `insert into public.admin_audit (actor_id, actor_email, action, target_type, target_id, details)
       select $1, $2, 'system.channel_rotate', 'system', null, jsonb_build_object('n', i)
       from generate_series(1, 55) i`,
      [actor, email],
    );
    await open(page, `/app/admin/audit?actor=${actor}`);
    const lines = page.getByTestId('admin-audit-text');
    await expect(lines).toHaveCount(50);
    await page.getByTestId('admin-audit-older').click();
    await expect(page).toHaveURL(/[?&]before=\d+/);
    await expect(lines).toHaveCount(5);
    await expect(page.getByTestId('admin-audit-older')).toHaveCount(0);
    await page.getByRole('button', { name: 'לחדשים ביותר' }).click();
    await expect(lines).toHaveCount(50);
  });

  test('in Hebrew and English: accessible, and nothing overflows the page', async ({ page }) => {
    // two languages, each audited (axe takes its time on a busy machine)
    test.setTimeout(120_000);
    const email = await staffMember(page, 'owner');
    const actor = await idOf(email);
    await sql(
      `insert into public.admin_audit (actor_id, actor_email, action, target_type, target_id, details)
       values ($1, $2, 'system.channel_rotate', 'system', null, '{}'),
              ($1, $2, 'staff.set', 'staff', 'someone-new@example.com', '{"role":"support","reason":"מצטרף"}')`,
      [actor, email],
    );
    for (const lang of ['he', 'en'] as const) {
      await uiLang(page, lang);
      await open(page, '/app/admin/audit');
      await expect(page.getByTestId('admin-audit-list')).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-audit-${lang}`);
      await shot(page, `${lang}-audit`, true);
    }
  });
});

import { expect, test } from '@playwright/test';
import { act, createInvitation, customer, offBecause, open, sql, staffMember } from '../support/admin';

// Remote support from the console: a staff member opens a customer's own app (their invitations,
// everything) while staying signed in as themself — a banner on every screen, payments and the
// account's own settings refused, a record of it, and the way back. Roles without the permission
// can't, and a forged claim does nothing.

test.describe('acting as a customer from the admin console', () => {
  test('support opens the customer’s account, works in it, can’t pay or delete it, and comes back', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const staffEmail = await staffMember(page, 'support', 'נועה תמיכה');
    const host = await customer(browser, 'דנה לקוחה');
    const bride = `כלה${Date.now().toString(36)}`;
    await createInvitation(host.page, bride, 'חתן');

    // the staff member's own list has no such invitation
    await open(page, '/app/invitations');
    await expect(page.getByText(bride)).toHaveCount(0);

    await open(page, `/app/admin/users/${host.userId}`);
    await page.getByTestId('admin-action-act-as').click();
    await act(page, 'admin-act-as-dialog', 'הלקוחה ביקשה עזרה בעריכה');
    // the customer's app: their one event opens straight away, as it does for them
    await page.waitForURL(/\/app\/invitations(\/[0-9a-f-]{36})?(\?|$)/);

    // the customer's app, as they see it, with the banner
    const bar = page.getByTestId('acting-as-bar');
    await expect(bar).toContainText(host.email);
    await expect(page.getByText(bride).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(staffEmail)).toHaveCount(0);

    // it works in their account: their invitation's guests screen opens
    const [inv] = await sql<{ id: string }>(`select id from public.invitations where owner_id = $1`, [
      host.userId,
    ]);
    await open(page, `/app/invitations/${inv!.id}/guests`);
    await expect(page.getByRole('heading', { name: 'רשימת המוזמנים', exact: true })).toBeVisible();
    await expect(bar).toBeVisible();

    // only the owner may pay, cancel or delete the account
    for (const [url, data] of [
      ['/api/billing/checkout', { product: 'pro' }],
      ['/api/billing/cancel', {}],
      ['/api/account/delete', { confirm: true }],
    ] as const) {
      const res = await page.request.post(url, { data });
      expect(res.status(), url).toBe(403);
      expect(await res.json()).toEqual({ ok: false, code: 'acting_as' });
    }

    // recorded with the reason
    const [row] = await sql<{ reason: string }>(
      `select details->>'reason' as reason from public.admin_audit
       where action = 'users.act_as' and target_id = $1`,
      [host.userId],
    );
    expect(row?.reason).toBe('הלקוחה ביקשה עזרה בעריכה');

    // the console is still theirs
    await open(page, '/app/admin');
    await expect(page).toHaveURL(/\/app\/admin$/);

    // back: to the customer's page in the console, themself again
    await open(page, '/app/invitations');
    await page.getByTestId('acting-as-exit').click();
    await page.waitForURL(new RegExp(`/app/admin/users/${host.userId}$`));
    await open(page, '/app/invitations');
    await expect(page.getByTestId('acting-as-bar')).toHaveCount(0);
    await expect(page.getByText(bride)).toHaveCount(0);
    expect(
      (
        await sql(`select 1 from public.admin_audit where action = 'users.act_as_end' and target_id = $1`, [
          host.userId,
        ])
      ).length,
    ).toBe(1);

    // the customer never noticed: still themself, their own invitation
    await open(host.page, '/app/invitations?all=1');
    await expect(host.page.getByTestId('acting-as-bar')).toHaveCount(0);
    await expect(host.page.getByText(bride).first()).toBeVisible();
    await host.context.close();
  });

  test('a role without the permission can’t, and a forged claim does nothing', async ({ page, browser }) => {
    test.setTimeout(90_000);
    await staffMember(page, 'viewer', 'צופה');
    const host = await customer(browser, 'יוסי לקוח');
    await open(page, `/app/admin/users/${host.userId}`);
    await offBecause(page, page.getByTestId('admin-action-act-as'), 'לתפקיד שלך אין הרשאה לפעולה הזו.');
    const res = await page.request.post(`/api/admin/users/${host.userId}/act-as`, {
      data: { reason: 'ניסיון' },
    });
    expect(res.status()).toBe(403);

    // a made-up claim in the cookie: still themself
    await page.context().addCookies([
      {
        name: 'badook_act_as',
        value: `00000000-0000-4000-8000-000000000000.${host.userId}.9999999999.forged`,
        url: new URL(page.url()).origin,
      },
    ]);
    await open(page, '/app/invitations');
    await expect(page.getByTestId('acting-as-bar')).toHaveCount(0);
    await host.context.close();
  });
});

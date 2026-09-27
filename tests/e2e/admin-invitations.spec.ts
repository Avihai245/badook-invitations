import { expect, test } from '@playwright/test';
import {
  act,
  audit,
  createInvitation,
  customer,
  done,
  listed,
  live,
  mark,
  noSideScroll,
  offBecause,
  open,
  openListed,
  publish,
  reply,
  shot,
  staffMember,
  stillMarked,
  uiLang,
} from '../support/admin';

// The admin console's invitations (/app/admin/invitations and an invitation's page): how many were
// created and of what, search and filters in the address, one invitation read-only with its numbers
// following the guests live, and a feature opened beyond the owner's plan — with a reason.

test.describe('the admin console’s invitations', () => {
  test('counts that filter, a search in the address, and an invitation’s page that follows its guests live', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await staffMember(page, 'support', 'רון');
    const host = await customer(browser, 'הילה מארחת');
    const bride = `כלה${Date.now().toString(36)}`;
    const invitation = await createInvitation(host.page, bride, 'חתן');
    await publish(invitation.id);
    const title = `${bride} & חתן`;

    await open(page, '/app/admin/invitations');
    const counts = page.getByTestId('admin-invitation-counts');
    await expect(counts).toContainText('כמה נוצרו');
    // a count is a filter
    await counts.getByRole('button', { name: /באוויר/ }).click();
    await expect(page).toHaveURL(/[?&]status=published/);
    await expect(counts.getByRole('button', { name: /באוויר/ })).toHaveAttribute('aria-pressed', 'true');
    // the search joins it, in the address
    await page.getByTestId('admin-invitations-search').fill(bride);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(bride)}`));
    await expect(page.getByTestId('admin-invitations-total')).toHaveText('הזמנה אחת');
    // a draft doesn't match "published"
    await page.reload();
    await expect(listed(page, 'data-invitation', invitation.id)).toHaveCount(1);
    await open(page, `/app/admin/invitations?q=${encodeURIComponent(bride)}&status=draft`);
    await expect(page.getByTestId('admin-invitations-total')).toHaveText('0 הזמנות');

    await open(page, `/app/admin/invitations?q=${encodeURIComponent(bride)}`);
    await openListed(page, 'data-invitation', invitation.id);
    await page.waitForURL(new RegExp(`/app/admin/invitations/${invitation.id}$`));
    await expect(page.getByTestId('admin-invitation-title')).toHaveText(title);
    await expect(page.getByText('לקריאה בלבד: זה התוכן של הלקוח.')).toBeVisible();
    await expect(page.getByTestId('admin-invitation-summary')).toContainText(`/i/${invitation.slug}`);
    await expect(page.getByTestId('admin-invitation-summary')).toContainText('הילה מארחת');
    await expect(page.getByTestId('admin-invitation-public')).toHaveAttribute(
      'href',
      `/i/${invitation.slug}`,
    );
    const rsvps = page.getByTestId('admin-invitation-rsvps');
    await expect(rsvps).toHaveText('0 כן · 0 לא · 0 אנשים');

    // guests reply: the numbers change on the open page, no reload
    await live(page);
    await mark(page);
    await reply(host.page, invitation.slug, 2);
    await expect(rsvps).toHaveText('1 כן · 0 לא · 2 אנשים', { timeout: 25_000 });
    await reply(host.page, invitation.slug, 0);
    await expect(rsvps).toHaveText('1 כן · 1 לא · 2 אנשים', { timeout: 25_000 });
    expect(await stillMarked(page)).toBe(true);

    // support sees the features, but only owners and admins open them
    const features = page.getByTestId('admin-invitation-features');
    await expect(features.locator('[data-feature="checkin"]')).toHaveAttribute('data-on', 'false');
    await offBecause(
      page,
      page.getByTestId('admin-feature-checkin'),
      'רק בעלים ואדמין יכולים לפתוח יכולות להזמנה.',
    );
    await host.context.close();
  });

  test('a feature opened beyond the plan, with a reason: the customer’s event has it; closed again, it doesn’t', async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await staffMember(page, 'admin', 'מיכל');
    const host = await customer(browser, 'תמר חופשית');
    const invitation = await createInvitation(host.page, 'תמר', 'יואב');
    const featuresOf = async () =>
      (
        (await (await host.page.request.get(`/api/invitations/${invitation.id}/features`)).json()) as {
          features: string[];
        }
      ).features;
    expect(await featuresOf()).not.toContain('checkin');

    await open(page, `/app/admin/invitations/${invitation.id}`);
    const row = page.getByTestId('admin-invitation-features').locator('[data-feature="checkin"]');
    await expect(row).toContainText('לא בחבילה');
    await page.getByTestId('admin-feature-checkin').click();
    await act(page, 'admin-feature-dialog', 'אולם ששותף שלנו ביקש לנסות');
    await done(page, '"קבלת אורחים בכניסה" נפתח להזמנה');
    await expect(row).toHaveAttribute('data-on', 'true');
    await expect(row).toContainText('נפתח על ידי הצוות');
    expect(await featuresOf()).toContain('checkin');

    await page.getByTestId('admin-feature-checkin').click();
    await act(page, 'admin-feature-dialog', 'הניסיון הסתיים');
    await done(page, '"קבלת אורחים בכניסה" נסגר להזמנה');
    await expect(row).toHaveAttribute('data-on', 'false');
    expect(await featuresOf()).not.toContain('checkin');
    await host.context.close();
  });

  test('in Hebrew and English: accessible, and nothing overflows the page', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const host = await customer(browser, 'ליאור נגיש');
    const invitation = await createInvitation(host.page, 'ליאור', 'שני');
    await publish(invitation.id);
    await reply(host.page, invitation.slug, 3);
    await staffMember(page, 'owner');
    for (const lang of ['he', 'en'] as const) {
      await uiLang(page, lang);
      await open(page, '/app/admin/invitations');
      await expect(listed(page, 'data-invitation', invitation.id).first()).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-invitations-${lang}`);
      await shot(page, `${lang}-invitations`, true);

      await open(page, `/app/admin/invitations/${invitation.id}`);
      await expect(page.getByTestId('admin-invitation-features')).toBeVisible();
      await noSideScroll(page);
      await audit(page, `admin-invitation-${lang}`);
      await shot(page, `${lang}-invitation`, true);
    }
    await host.context.close();
  });
});

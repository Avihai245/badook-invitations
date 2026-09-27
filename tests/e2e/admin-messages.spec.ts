import { expect, test } from '@playwright/test';
import { LOCAL, sql } from '../support/phase5b';
import {
  audit,
  nudgeConsole,
  openConsole,
  signInStaff,
  uiLanguage,
  unique,
  waitLive,
} from '../support/admin-c';

// The admin console's messages (/app/admin/messages, features/admin/messages): WhatsApp failures of
// its kinds grouped by error and listed with their invitation and owner, the log of emails by kind —
// and the open page following a change by itself when the server says so (its hint, as adminNudge sends
// it: the senders' own hints tell the console about every message); a viewer without the owners' contact
// details; an accessibility audit in Hebrew and English (both projects: phone, desktop).

test.skip(!LOCAL, 'seeds messages in the local stack');

/** An email kind of this test's own (letters only, like the log's kinds). */
const kindOf = (tag: string) =>
  `zz_${tag.replace(/[^a-z0-9]/g, '').replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!)}`.slice(0, 40);

/**
 * A host with a published invitation whose WhatsApp messages failed with this test's error — `invites`
 * invitations and a gallery link, the newest failures there are — and emails of this test's kind.
 */
async function seedFailures(tag: string, invites = 2) {
  const email = `msg-${tag}@example.com`;
  const { id } = (
    await sql<{ id: string }>(
      `insert into auth.users (id, email, raw_app_meta_data)
     values (gen_random_uuid(), $1, '{"provider":"email","providers":["email"]}') returning id`,
      [email],
    )
  )[0]!;
  await sql(`insert into public.accounts (user_id, full_name) values ($1, $2)`, [id, `מארחת ${tag}`]);
  const { inv } = (
    await sql<{ inv: string }>(
      `insert into public.invitations (owner_id, template_id, slug, status, event_type, draft, published_at)
     values ($1, 'sahar-bordeaux', $2, 'published', 'wedding', $3, now()) returning id as inv`,
      [
        id,
        `e2e-${tag}`.toLowerCase().slice(0, 60),
        { hosts: { primary: { he: `נועה ${tag}` }, secondary: null, joiner: null }, defaultLocale: 'he' },
      ],
    )
  )[0]!;
  const error = `(#131026) e2e ${tag}`;
  for (let i = 0; i < invites; i++)
    await sql(
      `insert into public.whatsapp_messages (invitation_id, owner_id, to_phone, status, error, price_usd, created_at, updated_at)
       values ($1, $2, '+972501111111', 'failed', $3, 0.0353, now(), now() + interval '1 minute')`,
      [inv, id, error],
    );
  await sql(
    `insert into public.gallery_notices (invitation_id, owner_id, channel, status, to_phone, error, price_usd, created_at, updated_at)
     values ($1, $2, 'whatsapp', 'failed', '+972502222222', $3, 0.0353, now(), now() + interval '1 minute')`,
    [inv, id, error],
  );
  const kind = kindOf(tag);
  await sql(`insert into public.email_log (kind, status) values ($1, 'sent'), ($1, 'sent'), ($1, 'failed')`, [
    kind,
  ]);
  return { email, error, kind };
}

test.describe('the messages', () => {
  test('failures by error and the latest ones, emails by kind — and the open page follows by itself', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const tag = unique('msg');
    await signInStaff(page, 'support');
    await openConsole(page, '/app/admin/messages');
    await expect(page.getByRole('heading', { level: 1, name: 'הודעות' })).toBeVisible();
    await waitLive(page);
    await page.evaluate(() => ((window as unknown as { __stay: boolean }).__stay = true));

    // messages failed and emails went out; the server says something changed
    const { email, error, kind } = await seedFailures(tag, 5);
    await nudgeConsole('message');

    // the open page, without reloading (other tests fail messages too: this one's by its error)
    const errors = page.getByTestId('errors');
    await expect(errors).toContainText(error, { timeout: 20_000 });
    const group = errors.locator('li').filter({ hasText: error });
    await expect(group).toContainText('6');
    await expect(group).toContainText('הזמנות 5');
    await expect(group).toContainText('קישורי גלריה 1');
    const more = page.getByTestId('failures-more');
    if (await more.count()) await more.click();
    const mine = page.locator('[data-testid=failures] [data-failure]:visible').filter({ hasText: error });
    await expect(mine).toHaveCount(6);
    await expect(mine.first()).toContainText(`מארחת ${tag}`);
    await expect(mine.first()).toContainText(email);
    await expect(mine.first()).toContainText(`נועה ${tag}`);
    const emails = page.locator(`[data-testid=emails-by-kind] [data-kind="${kind}"]`);
    await expect(emails).toContainText(kind);
    expect(await emails.locator('td').allTextContents()).toEqual([kind, '2', '1', '0']);
    expect(await page.evaluate(() => (window as unknown as { __stay?: boolean }).__stay)).toBe(true);
  });

  test('a viewer sees the failures without the owners’ contact details', async ({ page }) => {
    test.setTimeout(90_000);
    const tag = unique('msgv');
    const { email, error } = await seedFailures(tag);
    await signInStaff(page, 'viewer');
    await openConsole(page, '/app/admin/messages');
    const more = page.getByTestId('failures-more');
    if (await more.count()) await more.click();
    const mine = page.locator('[data-testid=failures] [data-failure]:visible').filter({ hasText: error });
    await expect(mine.first()).toContainText(`מארחת ${tag}`);
    await expect(mine.first()).toContainText('m***@example.com');
    expect(await page.content()).not.toContain(email);
  });

  for (const lang of ['he', 'en'] as const)
    test(`passes an accessibility audit · ${lang}`, async ({ page }) => {
      test.setTimeout(90_000);
      await seedFailures(unique('msga'));
      await signInStaff(page, 'owner');
      await uiLanguage(page, lang);
      await openConsole(page, '/app/admin/messages');
      await expect(page.getByTestId('admin-messages')).toBeVisible();
      await audit(page, `messages-${lang}`);
      // another kind, the chart's table, every failure
      await page.getByRole('radio', { name: lang === 'he' ? 'מספרי שולחן' : 'Table numbers' }).click();
      await page.locator('#daily summary').click();
      const more = page.getByTestId('failures-more');
      if (await more.count()) await more.click();
      await audit(page, `messages-${lang}-open`);
    });
});

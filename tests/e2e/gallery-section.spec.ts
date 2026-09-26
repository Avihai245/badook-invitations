import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { LOCAL, PHONE, galleryOn, newHost, open, publish, sql } from '../support/phase5b';

// The invitation leads guests to the live gallery (feature live_gallery): the host adds the gallery
// section from the editor's catalog (offered only while the event has the gallery, once), and the
// published page — the same cached HTML for everyone — shows each guest, in their own browser, the
// phase they are in: before the event an invitation to the gallery, around it "upload your photos",
// after it "see the album"; the button keeps the guest's personal link, and wide screens get a QR
// code. Then the host sends guests the gallery link from the system's WhatsApp number (the third
// template), a credit each.

test.skip(!LOCAL, 'reads rows of the local database');

const MOCKS = `http://127.0.0.1:${process.env.PW_WHATSAPP_PORT || 54340}`;

const saved = (page: Page) =>
  expect(page.locator('[role=status]', { hasText: 'כל השינויים נשמרו' }).first()).toBeAttached({
    timeout: 20_000,
  });

test('the gallery section: added once from the catalog, then before, during and after the event', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the editor on a computer; the guests on phones');
  test.setTimeout(150_000);
  const host = await newHost(page, 'lgsec', 'pro');
  const link = await galleryOn(page, host.id);

  // the editor's catalog offers it, once
  await open(page, `/app/invitations/${host.id}/edit`);
  const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
  await expect(frame.locator('h1.names')).toContainText('נועה', { timeout: 30_000 });
  const catalog = page.getByRole('dialog', { name: 'איזה סקשן להוסיף?' });
  await page.getByRole('button', { name: 'הוספת סקשן' }).click();
  await catalog.getByRole('button', { name: /^גלריית האורחים/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'גלריית האורחים' })).toBeVisible();
  await expect(frame.locator('.lg-card')).toBeVisible();
  await saved(page);
  await page.getByRole('button', { name: 'הוספת סקשן' }).click();
  await expect(catalog.getByRole('button', { name: /^טקסט ותמונה/ })).toBeVisible();
  await expect(catalog.getByRole('button', { name: /^גלריית האורחים/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const [stored] = await sql<{ n: number }>(
    `select count(*)::int as n from invitations i, jsonb_array_elements(i.draft->'sections') s
      where i.id = $1 and s->>'type' = 'live_gallery'`,
    [host.id],
  );
  expect(stored!.n).toBe(1);
  await publish(host.id);

  // a guest from their personal link
  const token = `lg${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  await sql(
    `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, 'דנה', 2, null, $2)`,
    [host.id, token],
  );
  const uploadPath = new URL(link).pathname + new URL(link).search;
  const at = async (iso: string | null, width = 390) => {
    const context = await browser.newContext({
      ...PHONE,
      viewport: { width, height: 844 },
      isMobile: width < 720,
    });
    const guest = await context.newPage();
    if (iso) await guest.clock.setFixedTime(new Date(iso));
    await guest.goto(`/i/${host.slug}/he?g=${token}&open=1`);
    const card = guest.locator('.lg-card');
    await card.scrollIntoViewIfNeeded();
    return { context, guest, card };
  };

  // before (now: the event is next June)
  const before = await at(null);
  await expect(before.card).toHaveAttribute('data-phase', 'before');
  await expect(before.card.locator('h2')).toHaveText('צלמו ושתפו');
  const cta = before.card.locator('a.lg-cta');
  await expect(cta).toHaveText('לגלריה של האירוע');
  const href = new URL((await cta.getAttribute('href'))!, 'http://x');
  expect(href.pathname + '?t=' + href.searchParams.get('t')).toBe(uploadPath);
  expect(href.searchParams.get('g')).toBe(token);
  // a phone gets no QR code
  await expect(before.card.locator('.lg-qr')).toHaveCount(0);
  await before.context.close();

  // during: from three hours before it starts (19:30 in Jerusalem)
  const during = await at('2027-06-17T15:00:00Z');
  await expect(during.card).toHaveAttribute('data-phase', 'during');
  await expect(during.card.locator('a.lg-cta')).toHaveText('העלאת תמונות');
  await during.card.locator('a.lg-cta').click();
  await during.guest.waitForURL(/\/e\/[a-z0-9-]+\/upload\?t=/);
  expect(new URL(during.guest.url()).searchParams.get('g')).toBe(token);
  await expect(during.guest.getByRole('button', { name: 'בחירת תמונות וסרטונים' })).toBeVisible();
  await during.context.close();

  // after: the album — and on a computer, its QR code
  const after = await at('2027-06-20T09:00:00Z', 1280);
  await expect(after.card).toHaveAttribute('data-phase', 'after');
  await expect(after.card.locator('h2')).toHaveText('האלבום מהאירוע');
  await expect(after.card.locator('a.lg-cta')).toHaveText('לאלבום');
  await expect(after.card.locator('.lg-qr svg')).toBeVisible({ timeout: 10_000 });
  await expect(after.card.locator('.lg-qr figcaption')).toHaveText('סרקו כדי לראות בטלפון');
  await after.context.close();
});

test('the host sends guests the gallery link from the system’s WhatsApp number, a credit each', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  const host = await newHost(page, 'lglink', 'pro');
  await galleryOn(page, host.id);
  await publish(host.id);
  const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const phone = `+9725${suffix}01`;
  for (const [name, p] of [
    ['משפחת כהן', phone],
    ['יעל', null],
  ] as const)
    await sql(
      `insert into invitation_guests (invitation_id, name, party_size, phone, token) values ($1, $2, 2, $3, $4)`,
      [host.id, name, p, `gl${randomUUID().replace(/-/g, '').slice(0, 20)}`],
    );
  await sql(
    `update accounts set message_credits = 3 where user_id = (select id from auth.users where email = $1)`,
    [host.email],
  );

  await open(page, `/app/invitations/${host.id}/gallery`);
  await page.getByTestId('gallery-send-links').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('gallery-notices-rows').locator('li')).toHaveCount(2);
  await expect(dialog.locator('[data-notice-row="יעל"]')).toContainText('אין טלפון');
  const send = dialog.getByTestId('gallery-notices-send');
  await expect(send).toHaveText('שליחה בוואטסאפ לאורח אחד');
  await send.click();
  // sent: out of "not yet", in "everyone"
  await expect(dialog.locator('[data-notice-row="משפחת כהן"]')).toHaveCount(0, { timeout: 20_000 });
  await dialog.getByRole('radio', { name: /^כולם/ }).click();
  await expect(dialog.locator('[data-notice-row="משפחת כהן"]')).toHaveAttribute(
    'data-notice-state',
    /queued|sent/,
  );
  // the template, with the guest's name, the hosts, and their own gallery link on the button
  await expect
    .poll(
      async () => {
        const sent = (await (await fetch(`${MOCKS}/__sent`)).json()) as {
          to: string;
          template: string;
          params: string[];
          button: string;
        }[];
        return sent.find((m) => m.to.endsWith(phone.slice(1)) && m.template === 'badook_gallery') ?? null;
      },
      { timeout: 20_000 },
    )
    .toMatchObject({
      params: ['משפחת כהן', 'נועה & איתי'],
      button: expect.stringMatching(new RegExp(`^${host.slug}/upload\\?t=[A-Za-z0-9_-]{24}&g=gl`)),
    });
  const [account] = await sql<{ credits: number }>(
    `select message_credits as credits from accounts where user_id = (select id from auth.users where email = $1)`,
    [host.email],
  );
  expect(account!.credits).toBe(2);
});

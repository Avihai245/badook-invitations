import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { LOCAL, PHONE, galleryOn, newHost, open, publish, sql } from '../support/phase5b';

// The invitation leads guests to the live gallery (feature live_gallery): the host adds the gallery
// section from the editor's catalog (offered only while the event has the gallery, once), and the
// published page — the same cached HTML for everyone — shows each guest, in their own browser, the
// phase they are in: before the event an invitation to the gallery, around it "upload your photos",
// after it "see the album"; the button keeps the guest's personal link, and wide screens get a QR
// code. Then the host sends guests the gallery link from the system's WhatsApp number (the third
// template), a credit each — in each guest's language (the invitation's when Meta has no template in
// theirs), and from their own WhatsApp or as a copied message in it too; Meta's statuses come back.

test.skip(!LOCAL, 'reads rows of the local database');

const MOCKS = `http://127.0.0.1:${process.env.PW_WHATSAPP_PORT || 54340}`;
// the webhook's signing secret (playwright.config.ts)
const APP_SECRET = 'e2e-whatsapp-app-secret';

/** Meta's webhook: a signed delivery of message statuses. */
async function webhook(request: APIRequestContext, statuses: { id: string; status: string }[]) {
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '0',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              statuses: statuses.map((s) => ({
                ...s,
                timestamp: '1790000000',
                recipient_id: '972500000000',
              })),
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac('sha256', APP_SECRET).update(payload).digest('hex')}`;
  return request.post('/api/whatsapp/webhook', {
    data: payload,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
  });
}

type Sent = { id: string; to: string; template: string; language: string; params: string[]; button: string };

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
  await expect(during.guest.getByTestId('gallery-share')).toBeVisible();
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

test('the gallery link in each guest’s language: counted and previewed by language, sent in it (the invitation’s when Meta has none), its statuses back', async ({
  page,
  context,
  request,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  test.setTimeout(150_000);
  // an invitation in Hebrew, English, Russian, Arabic and Amharic; the templates are set up in
  // Hebrew, English, Russian and Arabic, and the stand-in's Meta refuses Arabic (132001)
  const host = await newHost(page, 'lglang', 'pro', { locales: ['he', 'en', 'ru', 'ar', 'am'] });
  await galleryOn(page, host.id);
  await publish(host.id);
  const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const guests = [
    { name: 'דנה כהן', language: null },
    { name: 'Ольга Иванова', language: 'ru' },
    { name: 'سمير حداد', language: 'ar' },
    { name: 'አበበ ከበደ', language: 'am' },
  ].map((g, i) => ({
    ...g,
    phone: `+9725${suffix}${i}4`,
    token: `gl${randomUUID().replace(/-/g, '').slice(0, 20)}`,
  }));
  for (const g of guests)
    await sql(
      `insert into invitation_guests (invitation_id, name, party_size, phone, token, preferred_language)
       values ($1, $2, 2, $3, $4, $5)`,
      [host.id, g.name, g.phone, g.token, g.language],
    );
  const [dana, olga, samir, abebe] = guests as [(typeof guests)[number], ...(typeof guests)[number][]];
  await sql(
    `update accounts set message_credits = 10 where user_id = (select id from auth.users where email = $1)`,
    [host.email],
  );
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, `/app/invitations/${host.id}/gallery`);
  // "send from my WhatsApp" opens wa.me: remember what it would open
  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return null;
    };
  });
  await page.getByTestId('gallery-send-links').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('gallery-notices-rows').locator('li')).toHaveCount(4);
  // each guest's language on their row (no language of their own: the invitation's)
  for (const [g, lang] of [
    [dana!, 'he'],
    [olga!, 'ru'],
    [samir!, 'ar'],
    [abebe!, 'am'],
  ] as const)
    await expect(dialog.locator(`[data-notice-row="${g.name}"] [data-notice-language]`)).toHaveAttribute(
      'data-notice-language',
      lang,
    );

  // how many go out in each language: Amharic has no Meta template — the invitation's Hebrew
  const languages = dialog.getByTestId('gallery-notices-languages');
  await expect(languages).toContainText('עברית: 2 הודעות');
  await expect(languages).toContainText('Русский: הודעה אחת');
  await expect(languages).toContainText('العربية: הודעה אחת');
  await expect(languages).toContainText(
    'עוד אין הודעת גלריה מאושרת באמהרית: האורחים האלה יקבלו אותה בעברית.',
  );
  // each language's message as it will look: the hosts in it, right to left in Arabic
  const preview = dialog.getByTestId('gallery-notices-preview');
  await dialog.getByRole('radio', { name: 'Русский' }).click();
  await expect(preview).toHaveAttribute('lang', 'ru');
  await expect(preview).toHaveAttribute('dir', 'ltr');
  await expect(preview).toContainText('Галерея праздника «Ноа & Итай» открыта');
  await expect(preview).toContainText('В галерею');
  await dialog.getByRole('radio', { name: 'العربية' }).click();
  await expect(preview).toHaveAttribute('dir', 'rtl');
  await expect(preview).toContainText('معرض مناسبة نوعا & إيتاي مفتوح الآن');

  // the copied message: in the guest's language, with their link — opening in it
  await dialog.locator(`[data-notice-row="${olga!.name}"] [data-copy-message]`).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Галерея праздника');
  expect(copied).toContain('Ольга Иванова');
  expect(copied).toMatch(
    new RegExp(`/e/${host.slug}/upload\\?t=[A-Za-z0-9_-]{24}&g=${olga!.token}&lang=ru$`),
  );
  // from the host's own WhatsApp: the Amharic guest in Amharic (marked as sent)
  await dialog.locator(`[data-notice-row="${abebe!.name}"] [data-send-own]`).click();
  const [wa] = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  const waUrl = new URL(wa!);
  expect(waUrl.host).toBe('wa.me');
  expect(waUrl.pathname).toBe(`/${abebe!.phone.slice(1)}`);
  const text = waUrl.searchParams.get('text')!;
  expect(text).toContain('የፎቶ ማዕከል ተከፍቷል');
  expect(text).toContain('ኖዓ & ኢታይ');
  expect(text).toMatch(new RegExp(`&g=${abebe!.token}&lang=am$`));
  await expect(dialog.locator(`[data-notice-row="${abebe!.name}"]`)).toHaveCount(0, { timeout: 10_000 });

  // from the system's number: the three left, each in their language
  const send = dialog.getByTestId('gallery-notices-send');
  await expect(send).toHaveText('שליחה בוואטסאפ ל־3 אורחים');
  await send.click();
  // nobody is left to send to: the list shows everyone, each with where their link stands
  for (const g of [dana!, olga!, samir!])
    await expect(dialog.locator(`[data-notice-row="${g.name}"]`)).toHaveAttribute(
      'data-notice-state',
      /queued|sent/,
      { timeout: 20_000 },
    );
  const sentTo = async (phone: string) =>
    ((await (await request.get(`${MOCKS}/__sent?to=${phone.slice(1)}`)).json()) as Sent[]).filter(
      (m) => m.template === 'badook_gallery',
    );
  const link = (g: { token: string }, lang: string | null) =>
    new RegExp(`^${host.slug}/upload\\?t=[A-Za-z0-9_-]{24}&g=${g.token}${lang ? `&lang=${lang}` : ''}$`);
  await expect.poll(async () => (await sentTo(olga!.phone)).length, { timeout: 20_000 }).toBe(1);
  const [ru] = await sentTo(olga!.phone);
  expect(ru).toMatchObject({
    language: 'ru',
    params: [olga!.name, 'Ноа & Итай'],
    button: expect.stringMatching(link(olga!, 'ru')),
  });
  // Meta hasn't approved the Arabic template here: sent at once in the invitation's Hebrew — the
  // hosts in Hebrew, the gallery still opening in Arabic
  await expect.poll(async () => (await sentTo(samir!.phone)).length, { timeout: 20_000 }).toBe(1);
  const [ar] = await sentTo(samir!.phone);
  expect(ar).toMatchObject({
    language: 'he',
    params: [samir!.name, 'נועה & איתי'],
    button: expect.stringMatching(link(samir!, 'ar')),
  });
  await expect.poll(async () => (await sentTo(dana!.phone)).length, { timeout: 20_000 }).toBe(1);
  expect((await sentTo(dana!.phone))[0]).toMatchObject({
    language: 'he',
    button: expect.stringMatching(link(dana!, null)),
  });

  // Meta's statuses come back through the webhook, whatever the language
  expect(
    (
      await webhook(request, [
        { id: ru!.id, status: 'delivered' },
        { id: ar!.id, status: 'delivered' },
        { id: ar!.id, status: 'read' },
      ])
    ).status(),
  ).toBe(200);
  await open(page, `/app/invitations/${host.id}/gallery`);
  await page.getByTestId('gallery-send-links').click();
  await dialog.getByRole('radio', { name: /^כולם/ }).click();
  await expect(dialog.locator(`[data-notice-row="${samir!.name}"]`)).toContainText('נקרא');
  await expect(dialog.locator(`[data-notice-row="${olga!.name}"]`)).toContainText('נמסר');
  await expect(dialog.locator(`[data-notice-row="${abebe!.name}"]`)).toContainText('סימנתם שנשלח');

  // the link opens the gallery in the guest's language
  const phone = await browser.newContext(PHONE);
  const guest = await phone.newPage();
  await guest.goto(`/e/${ru!.button}`);
  await expect(guest.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(guest.getByRole('heading', { level: 1 })).toContainText('Ноа & Итай');
  await phone.close();
});

import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { xlsx } from '../support/xlsx';

// The guest list: upload it from Excel (and again, without doubling anyone), a personal link per
// guest (their name greets them, the RSVP form comes prefilled, the reply is linked to them and
// shows as their status), and sending the invitation on WhatsApp from the system's number — against
// tests/support/mock-whatsapp.mjs, with delivery statuses and guests' replies coming back through
// the signed webhook.

const WHATSAPP = `http://127.0.0.1:${Number(process.env.PW_WHATSAPP_PORT || 54340)}`;
/** Same values as the webServer env in playwright.config.ts. */
const APP_SECRET = 'e2e-whatsapp-app-secret';
const VERIFY_TOKEN = 'e2e-whatsapp-verify';
const CRON_SECRET = 'e2e-cron-secret-0123456789abcdef';

async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function signUp(
  page: Page,
  email = `guests-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
) {
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function createInvitation(page: Page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return (await res.json()) as { id: string; slug: string };
  });
}

const saved = (page: Page) =>
  expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({ timeout: 15_000 });

/** The publish dialog points to the missing venue, the host fills it in and publishes. */
async function publishWithVenue(page: Page, id: string) {
  await open(page, `/app/invitations/${id}/edit`);
  const publishButton = page.getByRole('banner').getByRole('button', { name: 'פרסום', exact: true });
  await publishButton.click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /שם המקום/ }).click();
  await page.getByRole('textbox', { name: 'שם המקום' }).fill('אחוזת הגפן');
  await page.getByRole('textbox', { name: 'כתובת', exact: true }).fill('דרך הכרמים 12, זכרון יעקב');
  await saved(page);
  await publishButton.click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'פרסום', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
  return new URL(await dialog.getByRole('textbox').inputValue()).pathname.split('/')[2]!;
}

interface ApiGuest {
  id: string;
  name: string;
  phone: string | null;
  token: string;
  sendStatus: string;
  openedAt: string | null;
  optedOut: boolean;
  response: { attending: boolean; adults: number; children: number } | null;
}

const listGuests = (page: Page, id: string) =>
  page.evaluate(async (invitationId) => {
    const res = await fetch(`/api/invitations/${invitationId}/guests`);
    return ((await res.json()) as { guests: ApiGuest[] }).guests;
  }, id);

const addGuests = (page: Page, id: string, list: { name: string; phone?: string | null }[]) =>
  page.evaluate(
    async ({ invitationId, guests }) => {
      const res = await fetch(`/api/invitations/${invitationId}/guests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ guests }),
      });
      return res.status;
    },
    { invitationId: id, guests: list },
  );

/** A guest's row: a table row on wide screens, a card on phones. */
const row = (page: Page, name: string) => page.locator('[data-guest-row]:visible').filter({ hasText: name });
const kpi = (page: Page, label: string) =>
  page.locator('#main dl').filter({ has: page.getByText(label, { exact: true }) });
const toast = (page: Page, text: string) => page.locator('li').filter({ hasText: text });

/** Meta's webhook: a signed delivery of statuses and/or guests' messages. */
async function webhook(request: APIRequestContext, value: Record<string, unknown>) {
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      { id: '0', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', ...value } }] },
    ],
  });
  const signature = `sha256=${createHmac('sha256', APP_SECRET).update(payload).digest('hex')}`;
  return request.post('/api/whatsapp/webhook', {
    data: payload,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
  });
}

/** The guest list spreadsheet: a row without a name, a repeated phone, a landline, a guest without a phone. */
const guestFile = (yossi: string) => ({
  name: 'מוזמנים.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: xlsx([
    ['שם מלא', 'טלפון', 'דוא"ל', 'כמות', 'קבוצה'],
    ['דנה לוי', '050-1234567', 'dana@example.com', 2, 'משפחה'],
    [yossi, '052-7654321', null, 1, 'חברים'],
    [null, '053-1111111', null, null, null],
    [yossi, '0527654321', null, null, null],
    ['רותי אברהם', '054-2223333', null, 3, 'עבודה'],
    ['סבתא שרה', '03-5551234', null, 2, 'משפחה'],
    ['דוד בלי טלפון', null, null, 1, null],
  ]),
});

test.describe('guest list', () => {
  test('Excel upload (twice) → a personal link greets the guest, prefills the form, and the reply is theirs', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = collectErrors(page);
    await signUp(page);
    const { id } = await createInvitation(page);

    // the personal greeting: switched on in the opening section, the preview shows a sample name
    await open(page, `/app/invitations/${id}/edit`);
    if (testInfo.project.name === 'desktop')
      await page.getByRole('button', { name: 'פתיחה (Hero)', exact: true }).click();
    await page.getByRole('switch', { name: 'ברכה אישית עם שם המוזמן' }).click();
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    if (testInfo.project.name === 'desktop')
      await expect(frame.locator('[data-guest-greeting]')).toHaveText('דנה, שמחים להזמין אותך!');
    await saved(page);
    const slug = await publishWithVenue(page, id);

    // an empty list is a three-step guide; the "?" lists what every button does
    await open(page, `/app/invitations/${id}/guests`);
    await expect(page.getByRole('heading', { level: 1, name: 'רשימת המוזמנים' })).toBeVisible();
    const guide = page.getByTestId('guests-guide');
    await expect(guide.getByRole('heading', { name: 'בואו נבנה את רשימת המוזמנים' })).toBeVisible();
    await expect(guide.getByRole('listitem')).toHaveCount(3);
    // (in #main: right after hydration the streamed copy of the page can still be in the document)
    await page.locator('#main').getByTestId('area-help').click();
    const help = page.getByRole('dialog');
    await expect(help.getByText('רשימת המוזמנים: מה כל כפתור עושה')).toBeVisible();
    await expect(help.getByText(/^מעלים קובץ Excel או CSV עם עמודות שם וטלפון/)).toBeVisible();
    for (const label of [
      'חיפוש לפי שם, טלפון או קבוצה',
      'סימון מוזמנים',
      'ביטול הסימון',
      'עריכה',
      'מחיקה',
      'עריכת הברכה',
    ])
      await expect(help.getByText(label, { exact: true })).toBeAttached();
    await page.keyboard.press('Escape');

    // the Excel file: two rows it can't use; a landline stays on the list, without WhatsApp
    await guide.getByRole('button', { name: 'העלאת קובץ אקסל' }).click();
    let dialog = page.getByRole('dialog', { name: 'העלאת רשימת מוזמנים' });
    await dialog.getByTestId('guest-file').setInputFiles(guestFile('יוסי כהן'));
    const preview = dialog.getByTestId('import-preview');
    await expect(preview.getByText('נמצאו 5 מוזמנים')).toBeVisible();
    await expect(preview.getByText('050-123-4567')).toBeVisible();
    await expect(dialog.getByText('2 שורות לא ייובאו או ייובאו חלקית')).toBeVisible();
    await expect(dialog.getByText(/אין שם/)).toBeVisible();
    await expect(dialog.getByText(/הטלפון מופיע פעמיים בקובץ/)).toBeVisible();
    await expect(dialog.getByText(/^מוזמן אחד עם מספר קווי/)).toBeVisible();
    await dialog.getByRole('button', { name: 'ייבוא 5 מוזמנים' }).click();
    await expect(toast(page, 'נוספו 5 מוזמנים, 0 עודכנו')).toBeVisible();
    await expect(row(page, 'דנה לוי')).toContainText('050-123-4567');
    await expect(row(page, 'דנה לוי')).toContainText('לא נשלח');
    await expect(row(page, 'סבתא שרה')).toContainText('מספר קווי — אין וואטסאפ');
    await expect(kpi(page, 'מוזמנים ברשימה')).toContainText('5');
    // the two main actions: upload, and send to everyone who can get it (3 mobiles) with the cost
    const actions = page.getByTestId('guests-actions');
    await expect(actions.getByRole('button', { name: 'העלאת רשימה מאקסל' })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'שליחה בוואטסאפ לכל המוזמנים' })).toBeEnabled();
    await expect(
      actions.getByText(/^3 מוזמנים עוד לא קיבלו · .*0\.16.* להודעה · יתרה: 0 קרדיטים$/),
    ).toBeVisible();

    // the same file again, one name spelled differently: updated — by phone, and by name without
    // a phone — never doubled
    await actions.getByRole('button', { name: 'העלאת רשימה מאקסל' }).click();
    dialog = page.getByRole('dialog', { name: 'העלאת רשימת מוזמנים' });
    await dialog.getByTestId('guest-file').setInputFiles(guestFile('יוסף כהן'));
    await expect(dialog.getByTestId('import-preview').getByText('נמצאו 5 מוזמנים')).toBeVisible();
    await dialog.getByRole('button', { name: 'ייבוא 5 מוזמנים' }).click();
    await expect(toast(page, 'נוספו 0 מוזמנים, 5 עודכנו')).toBeVisible();
    const guests = await listGuests(page, id);
    expect(guests.map((g) => g.name)).toEqual([
      'דנה לוי',
      'יוסף כהן',
      'רותי אברהם',
      'סבתא שרה',
      'דוד בלי טלפון',
    ]);
    const [dana, yossef] = guests;
    expect(dana).toMatchObject({ phone: '+972501234567', token: expect.stringMatching(/^[\w-]{16,}$/) });

    // "add by hand" with a phone already on the list: refused, and Dana stays Dana
    await actions.getByRole('button', { name: 'הוספה ידנית' }).click();
    const add = page.getByRole('dialog', { name: 'הוספת מוזמן' });
    await add.getByLabel('שם מלא').fill('מישהו אחר');
    await add.getByLabel('טלפון', { exact: true }).fill('050-1234567');
    await add.getByRole('button', { name: 'שמירה' }).click();
    await expect(add.getByText('מוזמן עם הטלפון הזה כבר ברשימה: דנה לוי')).toBeVisible();
    await add.getByRole('button', { name: 'ביטול' }).click();
    expect((await listGuests(page, id)).map((g) => g.name)).toEqual(guests.map((g) => g.name));

    // the personal link: copied from the row
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await row(page, 'דנה לוי').getByRole('button', { name: 'העתקת הקישור האישי' }).click();
    await expect(toast(page, 'הקישור האישי הועתק')).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toBe(`${new URL(page.url()).origin}/i/${slug}?g=${dana!.token}`);

    // the guest opens it: greeted by name, the form already has their name and phone
    const guest = await context.newPage();
    await guest.emulateMedia({ reducedMotion: 'reduce' });
    await guest.setExtraHTTPHeaders({ 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.7` });
    await open(guest, `${link}&open=1`);
    await expect(guest.locator('[data-guest-greeting]')).toHaveText('דנה לוי, שמחים להזמין אותך!');
    let form = guest.locator('.form');
    await form.locator('.opt').first().click();
    await expect(form.locator('[id$="-a0.firstName"]')).toHaveValue('דנה');
    await expect(form.locator('[id$="-a0.lastName"]')).toHaveValue('לוי');
    await expect(form.locator('[id$="-a0.phone"]')).toHaveValue('0501234567');
    // under the button: where the reply goes, and the privacy policy
    await expect(form.getByRole('link', { name: 'מדיניות הפרטיות' })).toHaveAttribute('href', '/privacy');
    await form.locator('.srow').nth(0).locator('.stepper button').last().click();
    await form.locator('[id$="-a1.firstName"]').fill('תום');
    await form.locator('[id$="-a1.lastName"]').fill('לוי');
    await form.locator('button.btn-primary').click();
    await expect(guest.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });

    // the same browser, Yossef's personal link: Dana's reply isn't his to see or edit
    await open(guest, `/i/${slug}?g=${yossef!.token}&open=1`);
    await expect(guest.locator('[data-guest-greeting]')).toHaveText('יוסף כהן, שמחים להזמין אותך!');
    await expect(guest.locator('.replied')).toHaveCount(0);
    form = guest.locator('.form');
    await form.locator('.opt').nth(1).click();
    await expect(form.locator('[id$="-d.fullName"]')).toHaveValue('יוסף כהן');
    await form.locator('button.btn-primary').click();
    await expect(guest.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
    await guest.close();

    // a visitor without a link sees no greeting; a reply with Ruti's phone is Ruti's
    const stranger = await context.newPage();
    await stranger.setExtraHTTPHeaders({ 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.9` });
    await open(stranger, `/i/${slug}?open=1`);
    await expect(stranger.locator('[data-guest-greeting]')).toHaveCount(0);
    await expect(stranger.locator('.replied')).toHaveCount(0);
    form = stranger.locator('.form');
    await form.locator('.opt').first().click();
    await form.locator('[id$="-a0.firstName"]').fill('רותי');
    await form.locator('[id$="-a0.lastName"]').fill('אברהם');
    await form.locator('[id$="-a0.phone"]').fill('054-222-3333');
    await form.locator('button.btn-primary').click();
    await expect(stranger.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
    await stranger.close();

    // the host sees each reply on its guest's row, and in the numbers
    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(row(page, 'דנה לוי')).toContainText('מגיע/ה');
    await expect(row(page, 'דנה לוי')).toContainText('מגיעים · 2');
    await expect(row(page, 'יוסף כהן')).toContainText('לא מגיע/ה');
    await expect(row(page, 'רותי אברהם')).toContainText('מגיעים · 1');
    await expect(kpi(page, 'אישרו הגעה')).toContainText('2');
    await expect(kpi(page, 'לא מגיעים')).toContainText('1');
    await page.getByRole('radio', { name: 'בלי תשובה' }).click();
    await expect(row(page, 'דנה לוי')).toHaveCount(0);
    await expect(row(page, 'סבתא שרה')).toBeVisible();
    await page.getByRole('radio', { name: 'כולם' }).click();

    // marked as sent by hand, deleted
    await row(page, 'דוד בלי טלפון').getByRole('button', { name: 'פעולות נוספות' }).click();
    await page.getByRole('menuitem', { name: 'סימון כנשלח' }).click();
    await expect(row(page, 'דוד בלי טלפון')).toContainText('נשלח ידנית');
    await row(page, 'סבתא שרה').getByRole('button', { name: 'פעולות נוספות' }).click();
    await page.getByRole('menuitem', { name: 'מחיקה' }).click();
    await page
      .getByRole('dialog', { name: 'למחוק את המוזמן?' })
      .getByRole('button', { name: 'מחיקה' })
      .click();
    await expect(row(page, 'סבתא שרה')).toHaveCount(0);

    // the export has everyone with their personal link (Excel-friendly CSV)
    const csv = await page.evaluate(async (invitationId) => {
      const res = await fetch(`/api/invitations/${invitationId}/guests/export`);
      const bytes = new Uint8Array(await res.clone().arrayBuffer());
      return { type: res.headers.get('content-type'), bom: [...bytes.slice(0, 3)], text: await res.text() };
    }, id);
    expect(csv.type).toContain('text/csv');
    expect(csv.bom).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.text).toContain(`/i/${slug}?g=${dana!.token}`);
    expect(csv.text).toContain('דנה לוי');

    // the other invitation pages link here
    await open(page, `/app/invitations/${id}/responses`);
    await page
      .getByRole('navigation', { name: 'ניווט בהזמנה' })
      .getByRole('link', { name: 'מוזמנים' })
      .click();
    await page.waitForURL(/\/guests$/);

    // no horizontal scroll on a phone
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('WhatsApp from the system number: the fixed template, what is skipped, retries that wait, statuses and STOP from the signed webhook', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    // one of INVITES_ADMIN_EMAILS: the platform's own account sends without buying credits
    await signUp(page, `wa-admin-${testInfo.project.name}@example.com`);
    const { id } = await createInvitation(page);
    const slug = await publishWithVenue(page, id);
    const suffix = testInfo.project.name === 'desktop' ? '1' : '2';
    const phones = {
      ok1: `050-77700${suffix}1`,
      ok2: `050-77700${suffix}2`,
      notOnWhatsApp: `054-${suffix}000000`,
      rateLimited: `052-${suffix}999999`,
    };
    expect(
      await addGuests(page, id, [
        { name: 'דנה לוי', phone: phones.ok1 },
        { name: 'יוסי כהן', phone: phones.ok2 },
        { name: 'לא בוואטסאפ', phone: phones.notOnWhatsApp },
        { name: 'עומס', phone: phones.rateLimited },
        { name: 'בלי טלפון', phone: null },
      ]),
    ).toBe(200);

    await open(page, `/app/invitations/${id}/guests`);
    await page.getByRole('button', { name: 'שליחה בוואטסאפ לכל המוזמנים' }).click();
    let dialog = page.getByRole('dialog', { name: 'שליחת ההזמנה בוואטסאפ' });
    // who: everyone with a mobile number who didn't get it yet
    await expect(dialog.getByRole('radio', { name: 'למי שעוד לא קיבל (4)' })).toBeChecked();
    const plan = dialog.getByTestId('whatsapp-plan');
    await expect(plan).toContainText('יישלחו 4 הודעות');
    await expect(plan).toContainText('1 בלי טלפון');
    // the message as the guest will see it, from the approved template
    await expect(dialog.getByText(/שלום דנה לוי 👋/)).toBeVisible();
    await expect(dialog.getByText(/נועה & איתי מזמינים אותך לחתונה ביום חמישי, 17 ביוני 2027/)).toBeVisible();
    await expect(dialog.getByText('להזמנה ולאישור הגעה', { exact: true })).toBeVisible();
    // the price: Meta's marketing rate for Israel ($0.0353 × 3.7, up to the agora), per message
    await expect(dialog.getByText(/^4 הודעות × .*0\.16.* = .*0\.64/)).toBeVisible();
    const send = dialog.getByRole('button', { name: 'שליחה ל-4 מוזמנים' });
    await expect(send).toBeDisabled();
    await expect(dialog.getByTestId('whatsapp-blocked')).toHaveText('סמנו את האישור כדי לשלוח');
    await dialog.getByRole('checkbox', { name: /אני מאשר\/ת שהמוזמנים מכירים אותי/ }).click();
    await expect(dialog.getByTestId('whatsapp-blocked')).toHaveCount(0);
    await send.click();
    const done = dialog.getByTestId('whatsapp-done');
    await expect(done).toBeVisible({ timeout: 60_000 });
    await expect(done).toContainText('ההזמנה נשלחה ל-2 מוזמנים');
    await expect(done).toContainText('הודעה אחת לא נשלחה (הקרדיט הוחזר)');
    // WhatsApp's rate limit: tried again later, not three times in a row
    await expect(done).toContainText('הודעה אחת תישלח שוב בעוד כמה דקות');
    await dialog.getByRole('button', { name: 'סגירה' }).first().click();

    // what reached WhatsApp: the template with the guest's name and their personal link on the button
    const guests = await listGuests(page, id);
    const dana = guests.find((g) => g.name === 'דנה לוי')!;
    const sentTo = async (to: string) =>
      (await (await request.get(`${WHATSAPP}/__sent?to=${to}`)).json()) as {
        id: string;
        template: string;
        language: string;
        params: string[];
        button: string;
      }[];
    const [message] = await sentTo(`9725077700${suffix}1`);
    expect(message).toMatchObject({
      template: 'badook_invitation',
      language: 'he',
      params: ['דנה לוי', 'נועה & איתי', 'לחתונה', 'יום חמישי, 17 ביוני 2027'],
      button: `${slug}?g=${dana.token}`,
    });
    expect(await sentTo(`9725${suffix}999999`)).toEqual([]);

    // Meta's webhook: the handshake, then signed statuses (an unsigned or malformed one is refused)
    const challenge = await request.get(
      `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1158201444`,
    );
    expect(await challenge.text()).toBe('1158201444');
    expect(
      (
        await request.get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1')
      ).status(),
    ).toBe(403);
    for (const bad of ['sha256=00', `sha256=${'z'.repeat(64)}`]) {
      const refused = await request.post('/api/whatsapp/webhook', {
        data: '{"entry":[]}',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': bad },
      });
      expect(refused.status()).toBe(401);
    }
    const delivered = await webhook(request, {
      statuses: [
        { id: message!.id, status: 'delivered', timestamp: '1790000000', recipient_id: '972507770011' },
        { id: message!.id, status: 'read', timestamp: '1790000060', recipient_id: '972507770011' },
      ],
    });
    expect(delivered.status()).toBe(200);

    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(row(page, 'דנה לוי')).toContainText('נקרא');
    await expect(row(page, 'יוסי כהן')).toContainText('נשלח');
    await expect(row(page, 'לא בוואטסאפ')).toContainText('השליחה נכשלה');
    await expect(row(page, 'לא בוואטסאפ')).toContainText('המספר לא רשום בוואטסאפ');
    await expect(row(page, 'עומס')).toContainText('בתור לשליחה');
    await expect(row(page, 'עומס')).toContainText('ניסיון נוסף בעוד כמה דקות');
    await expect(row(page, 'בלי טלפון')).toContainText('לא נשלח');

    // sending again: whoever already has it is left out, unless the host asks — and pays for it
    await page.getByRole('button', { name: 'שליחה בוואטסאפ לכל המוזמנים' }).click();
    dialog = page.getByRole('dialog', { name: 'שליחת ההזמנה בוואטסאפ' });
    await dialog.getByRole('radio', { name: 'לכל המוזמנים (1)' }).check();
    await expect(dialog.getByTestId('whatsapp-plan')).toContainText('תישלח הודעה אחת');
    await expect(dialog.getByTestId('whatsapp-plan')).toContainText('2 כבר קיבלו את ההזמנה — לא יקבלו שוב');
    await expect(dialog.getByTestId('whatsapp-plan')).toContainText('1 כבר בתור לשליחה');
    await dialog.getByRole('checkbox', { name: /לשלוח שוב גם למי שכבר קיבל \(2\)/ }).check();
    await expect(dialog.getByRole('radio', { name: 'לכל המוזמנים (3)' })).toBeChecked();
    await expect(dialog.getByText(/^3 הודעות × .*0\.16.* = .*0\.48/)).toBeVisible();
    await dialog.getByRole('button', { name: 'ביטול' }).click();

    // Meta reports a failure later (refunded), and Dana writes "הסר": never sent to again
    const [second] = await sentTo(`9725077700${suffix}2`);
    const later = await webhook(request, {
      statuses: [
        {
          id: second!.id,
          status: 'failed',
          timestamp: '1790000100',
          recipient_id: `9725077700${suffix}2`,
          errors: [
            {
              code: 131049,
              title: 'This message was not delivered to maintain healthy ecosystem engagement.',
            },
          ],
        },
      ],
      messages: [{ from: `9725077700${suffix}1`, id: 'wamid.in.1', type: 'text', text: { body: 'הסר' } }],
    });
    expect(later.status()).toBe(200);
    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(row(page, 'יוסי כהן')).toContainText('וואטסאפ עיכב את ההודעה');
    await expect(row(page, 'דנה לוי')).toContainText('ביקש/ה לא לקבל הודעות בוואטסאפ');
    expect((await listGuests(page, id)).find((g) => g.name === 'דנה לוי')!.optedOut).toBe(true);
    // the failed ones, together
    await page.getByRole('radio', { name: 'נכשל' }).click();
    await expect(row(page, 'לא בוואטסאפ')).toBeVisible();
    await expect(row(page, 'יוסי כהן')).toBeVisible();
    await expect(row(page, 'דנה לוי')).toHaveCount(0);
    await page.getByRole('radio', { name: 'כולם' }).click();

    // the scheduled job (it sends whatever is due in anyone's queue)
    const cron = await request.post('/api/cron/whatsapp', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(cron.status()).toBe(200);
    expect(await cron.json()).toEqual({
      sent: expect.any(Number),
      failed: expect.any(Number),
      retried: expect.any(Number),
    });
    expect((await request.post('/api/cron/whatsapp')).status()).toBe(401);
    expect(errors).toEqual([]);
  });

  test('without credits the dialog says how many are missing and does not send (English UI, shekels)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signUp(page);
    const { id } = await createInvitation(page);
    await publishWithVenue(page, id);
    await addGuests(page, id, [{ name: 'דנה לוי', phone: '050-1234567' }]);
    await page.context().addCookies([{ name: 'ui_lang', value: 'en', url: page.url() }]);
    await open(page, `/app/invitations/${id}/guests`);
    await page.getByRole('button', { name: 'Send on WhatsApp to all guests' }).click();
    const dialog = page.getByRole('dialog', { name: 'Send the invitation on WhatsApp' });
    await expect(dialog.getByText('1 message × ₪0.16 = ₪0.16')).toBeVisible();
    await expect(dialog.getByText('1 credit short')).toBeVisible();
    await dialog.getByRole('checkbox', { name: /I confirm my guests know me/ }).click();
    await expect(dialog.getByRole('button', { name: 'Send to 1 guest' })).toBeDisabled();
    await expect(dialog.getByTestId('whatsapp-blocked')).toHaveText('You need 1 more credits to send');
    // the server refuses too
    const res = await page.evaluate(async (invitationId) => {
      const guests = (await (await fetch(`/api/invitations/${invitationId}/guests`)).json()) as {
        guests: { id: string }[];
      };
      const r = await fetch(`/api/invitations/${invitationId}/whatsapp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ guestIds: guests.guests.map((g) => g.id), consent: true }),
      });
      return { status: r.status, body: await r.json() };
    }, id);
    expect(res).toEqual({ status: 402, body: { ok: false, code: 'credits', needed: 1, balance: 0 } });
  });

  test('links open the upload or the send dialog; a full list offers the upgrade', async ({ page }) => {
    test.setTimeout(120_000);
    await signUp(page);
    const { id } = await createInvitation(page);
    // the free plan's list: 150 guests
    const full = Array.from({ length: 150 }, (_, i) => ({ name: `אורח ${i + 1}` }));
    expect(await addGuests(page, id, full)).toBe(200);

    await open(page, `/app/invitations/${id}/guests?import=1`);
    await expect(page.getByRole('dialog', { name: 'העלאת רשימת מוזמנים' })).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    await page.keyboard.press('Escape');
    await open(page, `/app/invitations/${id}/guests?send=1`);
    const send = page.getByRole('dialog', { name: 'שליחת ההזמנה בוואטסאפ' });
    await expect(send).toBeVisible();
    await expect(send.getByTestId('whatsapp-blocked')).toHaveText('צריך לפרסם את ההזמנה קודם');
    await page.keyboard.press('Escape');
    // not published: the send button says why it can't be pressed
    const actions = page.getByTestId('guests-actions');
    await expect(actions.getByRole('button', { name: 'שליחה בוואטסאפ לכל המוזמנים' })).toBeDisabled();
    await expect(actions.getByText('צריך לפרסם את ההזמנה לפני השליחה.')).toBeVisible();

    await actions.getByRole('button', { name: 'הוספה ידנית' }).click();
    const add = page.getByRole('dialog', { name: 'הוספת מוזמן' });
    await add.getByLabel('שם מלא').fill('אורח 151');
    await add.getByRole('button', { name: 'שמירה' }).click();
    const upgrade = page.getByRole('dialog').filter({ hasText: 'בחבילה שלכם אפשר עד 150 מוזמנים בהזמנה' });
    await expect(upgrade).toBeVisible();
    await expect(upgrade.getByTestId('upgrade-link')).toHaveAttribute('href', '/app/billing');
    expect(await listGuests(page, id)).toHaveLength(150);
  });
});

import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { xlsx } from '../support/xlsx';

// The guest list: import from Excel, a personal link per guest (their name greets them, the RSVP form
// comes prefilled, the reply is linked to them and shows as their status), and sending the invitation
// on WhatsApp from the system's number — against tests/support/mock-whatsapp.mjs, with the delivery
// statuses coming back through the signed webhook.

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
  await page.click('button[type=submit]');
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
  response: { attending: boolean; adults: number; children: number } | null;
}

const listGuests = (page: Page, id: string) =>
  page.evaluate(async (invitationId) => {
    const res = await fetch(`/api/invitations/${invitationId}/guests`);
    return ((await res.json()) as { guests: ApiGuest[] }).guests;
  }, id);

/** A guest's row: a table row on wide screens, a card on phones. */
const row = (page: Page, name: string) => page.locator('[data-guest-row]:visible').filter({ hasText: name });
const kpi = (page: Page, label: string) =>
  page.locator('#main dl').filter({ has: page.getByText(label, { exact: true }) });

test.describe('guest list', () => {
  test('Excel import → a personal link greets the guest, prefills the form, and the reply is theirs', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
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

    // an empty list explains itself; the "?" lists what every button does
    await open(page, `/app/invitations/${id}/guests`);
    await expect(page.getByRole('heading', { level: 1, name: 'רשימת המוזמנים' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'עוד אין מוזמנים' })).toBeVisible();
    // (in #main: right after hydration the streamed copy of the page can still be in the document)
    await page.locator('#main').getByTestId('area-help').click();
    await expect(
      page.getByRole('dialog').getByText(/^מעלים קובץ Excel או CSV עם עמודות שם וטלפון/),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // an Excel file: Hebrew titles, one row without a name, one duplicate phone
    await page.getByRole('button', { name: 'ייבוא מאקסל' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'ייבוא מוזמנים מקובץ' });
    await dialog.getByTestId('guest-file').setInputFiles({
      name: 'מוזמנים.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsx([
        ['שם מלא', 'טלפון', 'דוא"ל', 'כמות', 'קבוצה'],
        ['דנה לוי', '050-1234567', 'dana@example.com', 2, 'משפחה'],
        ['יוסי כהן', '052-7654321', null, 1, 'חברים'],
        [null, '053-1111111', null, null, null],
        ['יוסי כהן', '0527654321', null, null, null],
        ['רותי אברהם', '054-2223333', null, 3, 'עבודה'],
      ]),
    });
    const preview = dialog.getByTestId('import-preview');
    await expect(preview.getByText('נמצאו 3 מוזמנים')).toBeVisible();
    await expect(preview.getByText('050-123-4567')).toBeVisible();
    await expect(dialog.getByText('2 שורות לא ייובאו או ייובאו חלקית')).toBeVisible();
    await expect(dialog.getByText(/אין שם/)).toBeVisible();
    await expect(dialog.getByText(/הטלפון מופיע פעמיים בקובץ/)).toBeVisible();
    await dialog.getByRole('button', { name: 'ייבוא 3 מוזמנים' }).click();
    await expect(page.locator('li').filter({ hasText: 'נוספו 3 מוזמנים, 0 עודכנו' })).toBeVisible();
    await expect(row(page, 'דנה לוי')).toContainText('050-123-4567');
    await expect(row(page, 'דנה לוי')).toContainText('לא נשלח');
    await expect(kpi(page, 'מוזמנים ברשימה')).toContainText('3');

    // the same file again updates instead of doubling
    const guests = await listGuests(page, id);
    expect(guests.map((g) => g.name)).toEqual(['דנה לוי', 'יוסי כהן', 'רותי אברהם']);
    const dana = guests[0]!;
    expect(dana).toMatchObject({ phone: '+972501234567', token: expect.stringMatching(/^[\w-]{16,}$/) });

    // the personal link: copied from the row
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await row(page, 'דנה לוי').getByRole('button', { name: 'העתקת הקישור האישי' }).click();
    await expect(page.locator('li').filter({ hasText: 'הקישור האישי הועתק' })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toBe(`${new URL(page.url()).origin}/i/${slug}?g=${dana.token}`);

    // the guest opens it: greeted by name, the form already has their name and phone
    const guest = await context.newPage();
    await guest.emulateMedia({ reducedMotion: 'reduce' });
    await guest.setExtraHTTPHeaders({ 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.7` });
    await open(guest, `${link}&open=1`);
    await expect(guest.locator('[data-guest-greeting]')).toHaveText('דנה לוי, שמחים להזמין אותך!');
    const form = guest.locator('.form');
    await form.locator('.opt').first().click();
    await expect(form.locator('[id$="-a0.firstName"]')).toHaveValue('דנה');
    await expect(form.locator('[id$="-a0.lastName"]')).toHaveValue('לוי');
    await expect(form.locator('[id$="-a0.phone"]')).toHaveValue('0501234567');
    await form.locator('.srow').nth(0).locator('.stepper button').last().click();
    await form.locator('[id$="-a1.firstName"]').fill('תום');
    await form.locator('[id$="-a1.lastName"]').fill('לוי');
    await form.locator('button.btn-primary').click();
    await expect(guest.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
    // a visitor without the link sees no greeting
    const stranger = await context.newPage();
    await open(stranger, `/i/${slug}?open=1`);
    await expect(stranger.locator('[data-guest-greeting]')).toHaveCount(0);
    await stranger.close();
    await guest.close();

    // the host sees it on Dana's row — opened, coming with 2 — and in the numbers
    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(row(page, 'דנה לוי')).toContainText('מגיע/ה');
    await expect(row(page, 'דנה לוי')).toContainText('מגיעים · 2');
    await expect(kpi(page, 'אישרו הגעה')).toContainText('1');
    await expect(kpi(page, 'פתחו את ההזמנה')).toContainText('1');
    await page.getByRole('radio', { name: 'בלי תשובה' }).click();
    await expect(row(page, 'דנה לוי')).toHaveCount(0);
    await expect(row(page, 'יוסי כהן')).toBeVisible();
    await page.getByRole('radio', { name: 'כולם' }).click();

    // marked as sent by hand, edited, deleted
    await row(page, 'יוסי כהן').getByRole('button', { name: 'פעולות נוספות' }).click();
    await page.getByRole('menuitem', { name: 'סימון כנשלח' }).click();
    await expect(row(page, 'יוסי כהן')).toContainText('נשלח ידנית');
    await row(page, 'רותי אברהם').getByRole('button', { name: 'פעולות נוספות' }).click();
    await page.getByRole('menuitem', { name: 'מחיקה' }).click();
    await page
      .getByRole('dialog', { name: 'למחוק 1 מוזמנים?' })
      .getByRole('button', { name: 'מחיקה' })
      .click();
    await expect(row(page, 'רותי אברהם')).toHaveCount(0);

    // the export has everyone with their personal link (Excel-friendly CSV)
    const csv = await page.evaluate(async (invitationId) => {
      const res = await fetch(`/api/invitations/${invitationId}/guests/export`);
      const bytes = new Uint8Array(await res.clone().arrayBuffer());
      return { type: res.headers.get('content-type'), bom: [...bytes.slice(0, 3)], text: await res.text() };
    }, id);
    expect(csv.type).toContain('text/csv');
    expect(csv.bom).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.text).toContain(`/i/${slug}?g=${dana.token}`);
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

  test('WhatsApp from the system number: the fixed template, credits, statuses from the signed webhook', async ({
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
    const added = await page.evaluate(
      async ({ invitationId, list }) => {
        const res = await fetch(`/api/invitations/${invitationId}/guests`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ guests: list }),
        });
        return res.status;
      },
      {
        invitationId: id,
        list: [
          { name: 'דנה לוי', phone: phones.ok1 },
          { name: 'יוסי כהן', phone: phones.ok2 },
          { name: 'לא בוואטסאפ', phone: phones.notOnWhatsApp },
          { name: 'עומס', phone: phones.rateLimited },
          { name: 'בלי טלפון', phone: null },
        ],
      },
    );
    expect(added).toBe(200);

    await open(page, `/app/invitations/${id}/guests`);
    await page.getByRole('button', { name: 'שליחה בוואטסאפ' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'שליחת ההזמנה בוואטסאפ' });
    // who: everyone with a phone who didn't get it yet
    await expect(dialog.getByRole('radio', { name: 'למי שעוד לא קיבל (4)' })).toBeChecked();
    // the message as the guest will see it, from the approved template
    await expect(dialog.getByText(/שלום דנה לוי 👋/)).toBeVisible();
    await expect(dialog.getByText(/נועה & איתי מזמינים אותך לחתונה ביום חמישי, 17 ביוני 2027/)).toBeVisible();
    await expect(dialog.getByText('להזמנה ולאישור הגעה', { exact: true })).toBeVisible();
    // the price: Meta's marketing rate for Israel ($0.0353 × 3.7, up to the agora), per message
    await expect(dialog.getByText(/^4 הודעות × .*0\.14.* = .*0\.56/)).toBeVisible();
    const send = dialog.getByRole('button', { name: 'שליחה ל-4 מוזמנים' });
    await expect(send).toBeDisabled();
    await dialog.getByRole('checkbox').click();
    await send.click();
    const done = dialog.getByTestId('whatsapp-done');
    await expect(done).toBeVisible({ timeout: 60_000 });
    await expect(done).toContainText('ההזמנה נשלחה ל-2 מוזמנים');
    await expect(done).toContainText('2 הודעות לא נשלחו (הקרדיט הוחזר)');
    await dialog.getByRole('button', { name: 'סגירה' }).first().click();

    // what reached WhatsApp: the template with the guest's name and their personal link on the button
    const guests = await listGuests(page, id);
    const dana = guests.find((g) => g.name === 'דנה לוי')!;
    const [message] = (await (await request.get(`${WHATSAPP}/__sent?to=9725077700${suffix}1`)).json()) as {
      id: string;
      template: string;
      language: string;
      params: string[];
      button: string;
    }[];
    expect(message).toMatchObject({
      template: 'badook_invitation',
      language: 'he',
      params: ['דנה לוי', 'נועה & איתי', 'לחתונה', 'יום חמישי, 17 ביוני 2027'],
      button: `${slug}?g=${dana.token}`,
    });

    // Meta's webhook: the handshake, then signed statuses (an unsigned one is refused)
    const challenge = await request.get(
      `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1158201444`,
    );
    expect(await challenge.text()).toBe('1158201444');
    expect(
      (
        await request.get('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1')
      ).status(),
    ).toBe(403);
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
                statuses: [
                  {
                    id: message!.id,
                    status: 'delivered',
                    timestamp: '1790000000',
                    recipient_id: '972507770011',
                  },
                  { id: message!.id, status: 'read', timestamp: '1790000060', recipient_id: '972507770011' },
                ],
              },
            },
          ],
        },
      ],
    });
    const unsigned = await request.post('/api/whatsapp/webhook', {
      data: payload,
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' },
    });
    expect(unsigned.status()).toBe(401);
    const signature = `sha256=${createHmac('sha256', APP_SECRET).update(payload).digest('hex')}`;
    const signed = await request.post('/api/whatsapp/webhook', {
      data: payload,
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
    });
    expect(signed.status()).toBe(200);

    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(row(page, 'דנה לוי')).toContainText('נקרא');
    await expect(row(page, 'יוסי כהן')).toContainText('נשלח');
    await expect(row(page, 'לא בוואטסאפ')).toContainText('השליחה נכשלה');
    await expect(row(page, 'לא בוואטסאפ')).toContainText('not a WhatsApp user');
    await expect(row(page, 'עומס')).toContainText('השליחה נכשלה');
    await expect(row(page, 'בלי טלפון')).toContainText('לא נשלח');

    // the scheduled job (it sends whatever is left in anyone's queue)
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

  test('without credits the dialog says how many are missing and does not send', async ({ page }) => {
    test.setTimeout(120_000);
    await signUp(page);
    const { id } = await createInvitation(page);
    await publishWithVenue(page, id);
    await page.evaluate(async (invitationId) => {
      await fetch(`/api/invitations/${invitationId}/guests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ guests: [{ name: 'דנה לוי', phone: '050-1234567' }] }),
      });
    }, id);
    await open(page, `/app/invitations/${id}/guests`);
    await page.getByRole('button', { name: 'שליחה בוואטסאפ' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'שליחת ההזמנה בוואטסאפ' });
    await expect(dialog.getByText('חסרים 1 קרדיטים')).toBeVisible();
    await dialog.getByRole('checkbox').click();
    await expect(dialog.getByRole('button', { name: 'שליחה ל-1 מוזמנים' })).toBeDisabled();
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
});

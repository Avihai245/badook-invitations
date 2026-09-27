import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { hydrated, LOCAL, sql } from '../support/phase5b';

// Support tickets (features/support/tickets, supabase/migrations/*_support_tickets.sql), end to end: a
// customer opens a ticket in the app and the support team's open console inbox shows it without a
// reload; they answer, and the customer's open ticket page shows it without a reload (and the answer
// was emailed); the customer answers back, the team's note never reaches the customer, "send and
// close". The assistant's "talk to a person" (the customer sees what is sent), a visitor's contact
// form, a viewer who may not open the inbox, and axe on every new screen in Hebrew and English — the
// two projects are the phone (390×844) and the desktop (1440×900).

test.skip(!LOCAL, 'sets up staff and reads tickets in the local stack’s database');

const SHOTS = 'tests/.artifacts/qa/adm-b-support';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const isMobile = (testInfo: TestInfo) => testInfo.project.name === 'mobile';
const toast = (page: Page, text: string) => page.locator('li').filter({ hasText: text });

async function signUpAs(page: Page, email: string) {
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await hydrated(page);
}

/** Another person, in a browser of their own on the same kind of device. */
async function another(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const u = testInfo.project.use;
  const context = await browser.newContext({
    viewport: u.viewport,
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
    userAgent: u.userAgent,
    locale: 'he-IL',
  });
  return context.newPage();
}

/** A member of the team with `role`, on the staff list before they sign up (as the console adds them). */
async function staffMember(page: Page, role: 'support' | 'viewer', testInfo: TestInfo) {
  const email = unique(`adm-b-${role}-${testInfo.project.name}`);
  await sql(`insert into public.admin_staff (email, role) values ($1, $2)`, [email, role]);
  await signUpAs(page, email);
  return email;
}

/** The UI language (the ui_lang cookie) for this browser. */
async function uiLanguage(page: Page, lang: 'he' | 'en') {
  await page.context().addCookies([{ name: 'ui_lang', value: lang, url: new URL(page.url()).origin }]);
}

const newWindowMark = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __sameDocument: boolean }).__sameDocument = true));
/** The page is still the one it was (a refresh by itself, never a reload). */
const sameDocument = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true);

const settle = (page: Page) =>
  page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      undefined,
      { timeout: 5000 },
    )
    .catch(() => undefined);

/** axe (WCAG 2.1 AA) on what is on screen now: no violations at all. */
async function audit(page: Page, key: string) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .options({ resultTypes: ['violations'] })
    .withTags(TAGS)
    .analyze();
  const found = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')),
  }));
  // soft: one run lists every screen's findings
  expect.soft(found, `accessibility violations on ${key} (${test.info().project.name})`).toEqual([]);
  await noOverflow(page, key);
}

/** Nothing wider than the screen: the page never scrolls sideways. */
async function noOverflow(page: Page, key: string) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect.soft(scroll, `${key} overflows the page (${test.info().project.name})`).toBeLessThanOrEqual(width);
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  // from the top: a sticky bar never lands over the content in the full-page picture
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/adm-b-${name}-${test.info().project.name}.png`, fullPage: true });
}

/** The customer's own invitation (the ticket may be about it). */
const createInvitation = (page: Page) =>
  page.evaluate(async () => {
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
    return (await res.json()) as { id: string };
  });

const emailed = async (ticketId: string) =>
  (
    await sql<{ emailed: string | null }>(
      `select emailed from support_messages where ticket_id = $1 and author = 'staff' and not internal
       order by id desc limit 1`,
      [ticketId],
    )
  )[0]?.emailed ?? null;

const ticketIdOf = (page: Page) => new URL(page.url()).pathname.split('/').pop()!;

test.describe('support tickets', () => {
  test('a customer opens a ticket; the team’s open inbox shows it, they answer, and the customer’s open page shows it — live, and emailed', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);
    const mobile = isMobile(testInfo);

    // the support team: the inbox open, live
    const agent = await another(browser, testInfo);
    await staffMember(agent, 'support', testInfo);
    await agent.goto('/app/admin/support');
    await hydrated(agent);
    await expect(agent.getByRole('heading', { level: 1, name: 'תמיכה' })).toBeVisible();
    await expect(agent.getByTestId('admin-live').first()).toHaveAttribute('data-state', 'live', {
      timeout: 15_000,
    });
    await newWindowMark(agent);

    // the customer: "Support" in the app's menu, then a new ticket about their invitation
    const customerEmail = unique(`adm-b-customer-${testInfo.project.name}`);
    await signUpAs(page, customerEmail);
    await createInvitation(page);
    const nav = mobile
      ? page.getByRole('navigation', { name: 'ניווט', exact: true })
      : page.getByRole('navigation', { name: 'ניווט ראשי' });
    await nav.getByRole('link', { name: 'תמיכה' }).click();
    await page.waitForURL(/\/app\/support$/);
    await expect(page.getByRole('heading', { level: 1, name: 'תמיכה' })).toBeVisible();
    await expect(page.getByText('עוד לא פניתם לצוות')).toBeVisible();
    await page.getByTestId('support-new').click();
    await page.waitForURL(/\/app\/support\/new$/);
    const form = page.getByTestId('ticket-form');
    // checked in words, the focus on the first field that needs it
    await page.getByTestId('ticket-submit').click();
    await expect(form.getByText('שדה חובה').first()).toBeVisible();
    await expect(form.getByRole('textbox', { name: /^נושא/ })).toBeFocused();
    const subject = `טופס אישור ההגעה ריק ${testInfo.project.name} ${Date.now()}`;
    await form.getByRole('textbox', { name: /^נושא/ }).fill(subject);
    await form.getByRole('combobox', { name: 'סוג הפנייה' }).selectOption('bug');
    await form.getByRole('combobox', { name: /^על איזו הזמנה/ }).selectOption({ label: 'נועה & איתי' });
    await form.getByRole('textbox', { name: /^ההודעה/ }).fill('הטופס בהזמנה לא מציג אף שדה.');
    await shot(page, 'customer-new-he');
    await page.getByTestId('ticket-submit').click();
    await page.waitForURL(/\/app\/support\/[0-9a-f-]{36}$/);
    const ticketId = ticketIdOf(page);
    await expect(page.getByRole('heading', { level: 1, name: subject })).toBeVisible();
    await expect(page.getByTestId('ticket-status')).toContainText('ממתינה לצוות');
    // (the title isolated from the sentence's direction)
    await expect(page.getByText(/על ההזמנה: \u2068?נועה & איתי/)).toBeVisible();
    await expect(page.getByTestId('ticket-live')).toHaveAttribute('data-state', 'live', { timeout: 15_000 });
    await newWindowMark(page);

    // the team's inbox shows it by itself
    const row = agent.getByTestId(mobile ? 'inbox-card' : 'inbox-row').filter({ hasText: subject });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText('ממתינה לצוות');
    expect(await sameDocument(agent)).toBe(true);
    await shot(agent, 'console-inbox-he');

    // they open it: the customer's account beside the conversation (support sees contact details)
    await (mobile ? row : row.getByRole('link', { name: subject })).click();
    await agent.waitForURL(new RegExp(`/app/admin/support/${ticketId}$`));
    await expect(agent.getByRole('heading', { level: 1, name: subject })).toBeVisible();
    const panel = agent.getByTestId('admin-customer');
    await expect(panel).toHaveAttribute('data-kind', 'account');
    await expect(panel).toContainText(customerEmail);
    await expect(panel.getByTestId('admin-customer-link')).toHaveAttribute(
      'href',
      /\/app\/admin\/users\/[0-9a-f-]{36}$/,
    );
    await expect(agent.getByTestId('admin-invitation')).toContainText('נועה & איתי');
    await expect(agent.getByTestId('admin-live').first()).toHaveAttribute('data-state', 'live', {
      timeout: 15_000,
    });
    await newWindowMark(agent);

    // an empty answer isn't sent; then the answer, confirmed with where it goes
    await agent.getByTestId('admin-send').click();
    await expect(agent.getByText('אי אפשר לשלוח הודעה ריקה.')).toBeVisible();
    const answer = 'שלום! תיקנו את זה. רעננו את העמוד ופרסמו שוב, בבקשה.';
    await agent.getByTestId('admin-composer-text').fill(answer);
    await agent.getByTestId('admin-send').click();
    const confirm = agent.getByRole('dialog');
    await expect(confirm).toContainText('לשלוח את התשובה?');
    await expect(confirm).toContainText(customerEmail);
    await shot(agent, 'console-confirm-he');
    await confirm.getByTestId('admin-reply-confirm').click();
    await expect(toast(agent, 'התשובה נשלחה ללקוח')).toBeVisible();
    await expect(agent.getByTestId('admin-ticket-status')).toContainText('ממתינה ללקוח');

    // the customer's open page shows it by itself, and it went by email
    await expect(page.getByTestId('ticket-messages').getByText(answer)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ticket-status')).toContainText('נענתה');
    expect(await sameDocument(page)).toBe(true);
    await expect.poll(() => emailed(ticketId), { timeout: 10_000 }).toBe('sent');
    await expect(agent.locator('[data-emailed="sent"]')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'customer-ticket-he');

    // the customer answers back: the team's open ticket shows it by itself
    const back = 'עדיין לא עובד אצלי בטלפון.';
    await page.getByTestId('ticket-reply').fill(back);
    await page.getByTestId('ticket-send').click();
    await expect(toast(page, 'ההודעה נשלחה לצוות')).toBeVisible();
    await expect(page.getByTestId('ticket-status')).toContainText('ממתינה לצוות');
    await expect(agent.getByTestId('admin-messages').getByText(back)).toBeVisible({ timeout: 20_000 });
    await expect(agent.getByTestId('admin-ticket-status')).toContainText('ממתינה לצוות');
    expect(await sameDocument(agent)).toBe(true);

    // a note for the team: set apart, and never the customer's
    await agent.getByRole('radio', { name: 'הערה פנימית' }).click();
    await agent.getByTestId('admin-composer-text').fill('לקוחה ותיקה — לבדוק גם את הטלפון שלה');
    await agent.getByTestId('admin-add-note').click();
    await expect(agent.getByRole('dialog')).toContainText('רק הצוות יראה אותה');
    await agent.getByTestId('admin-note-confirm').click();
    await expect(agent.locator('[data-note]').getByText('לקוחה ותיקה')).toBeVisible();
    await expect(page.getByTestId('ticket-status')).toContainText('ממתינה לצוות');

    // the customer leaves for the list; the team answers and closes
    await page.getByRole('link', { name: 'כל הפניות' }).click();
    await page.waitForURL(/\/app\/support$/);
    await agent.getByRole('radio', { name: 'תשובה ללקוח' }).click();
    await agent.getByTestId('admin-composer-text').fill('בדקנו — עכשיו זה עובד גם בטלפון. סוגרים את הפנייה.');
    await agent.getByTestId('admin-send-close').click();
    await agent.getByTestId('admin-reply-confirm').click();
    await expect(toast(agent, 'התשובה נשלחה והפנייה נסגרה')).toBeVisible();
    await expect(agent.getByTestId('admin-ticket-status')).toContainText('סגורה');

    // back on the list: a new answer is marked, until they look
    await page.reload();
    await hydrated(page);
    const mine = page.getByTestId('support-ticket').filter({ hasText: subject });
    await expect(mine).toHaveAttribute('data-unread', '1');
    await expect(mine).toContainText('תשובה חדשה');
    await expect(mine).toContainText('סגורה');
    await shot(page, 'customer-list-he');
    await mine.click();
    await page.waitForURL(new RegExp(`/app/support/${ticketId}$`));
    await expect(page.getByTestId('ticket-messages')).toContainText('סוגרים את הפנייה');
    await expect(page.getByTestId('ticket-messages').locator('[data-event="closed"]')).toContainText(
      'הצוות סגר את הפנייה',
    );
    await expect(page.getByText('לקוחה ותיקה')).toHaveCount(0);
    await page.goBack();
    await page.reload();
    await expect(page.getByTestId('support-ticket').filter({ hasText: subject })).not.toHaveAttribute(
      'data-unread',
      '1',
    );

    // in the database: every message, the note internal, the record of the team's actions
    const messages = await sql<{ author: string; internal: boolean }>(
      `select author, internal from support_messages where ticket_id = $1 and author <> 'system' order by id`,
      [ticketId],
    );
    expect(messages).toEqual([
      { author: 'customer', internal: false },
      { author: 'staff', internal: false },
      { author: 'customer', internal: false },
      { author: 'staff', internal: true },
      { author: 'staff', internal: false },
    ]);
    const actions = await sql<{ action: string }>(
      `select action from admin_audit where target_type = 'ticket' and target_id = $1 order by id`,
      [ticketId],
    );
    expect(actions.map((a) => a.action)).toEqual(['support.reply', 'support.note', 'support.reply']);
    await agent.context().close();
  });

  test('the assistant’s “talk to a person”: the customer sees what is sent, and the ticket carries the conversation', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signUpAs(page, unique('adm-b-handoff'));
    await page.getByTestId('support-launcher').click();
    const chat = page.getByTestId('support-chat');
    const question = 'איך מוסיפים סרטון מיוטיוב לרקע של ההזמנה?';
    const input = chat.getByRole('textbox', { name: 'כתבו שאלה…' });
    await input.fill(question);
    await input.press('Enter');
    await expect(chat.getByText(/שאלה טובה!/)).toBeVisible();

    await chat.getByTestId('support-human').click();
    const handoff = chat.getByTestId('handoff');
    await expect(handoff.getByRole('heading', { name: 'פנייה לנציג' })).toBeFocused();
    // what goes to the team: the subject and the message (theirs to change), and every line
    await expect(handoff.getByRole('textbox', { name: /^נושא/ })).toHaveValue(question);
    await expect(handoff.getByRole('textbox', { name: /^מה חשוב שהצוות ידע/ })).toHaveValue(question);
    await expect(handoff).toContainText('מה יישלח לצוות: השיחה עם העוזר (2 הודעות)');
    await expect(handoff.getByRole('listitem').filter({ hasText: question })).toBeVisible();
    await expect(handoff.getByRole('listitem').filter({ hasText: 'שאלה טובה!' })).toBeVisible();
    await handoff
      .getByRole('textbox', { name: /^מה חשוב שהצוות ידע/ })
      .fill('ניסיתי את מה שהעוזר אמר וזה לא עובד.');
    await shot(page, 'customer-handoff-he');

    // back to the conversation and again: nothing is lost
    await handoff.getByRole('button', { name: 'חזרה לשיחה' }).click();
    await expect(chat.getByRole('log').getByText(question, { exact: true })).toBeVisible();
    await chat.getByTestId('support-human').click();
    await chat.getByTestId('handoff-send').click();
    const done = chat.getByTestId('handoff-done');
    await expect(done).toContainText(/פנייה #\d+ נשלחה לצוות/);
    await done.getByTestId('handoff-open').click();
    await page.waitForURL(/\/app\/support\/[0-9a-f-]{36}$/);
    const ticketId = ticketIdOf(page);
    const attached = page.getByTestId('ticket-chat');
    await expect(attached).toContainText('השיחה עם העוזר שצורפה · 2 הודעות');
    await attached.locator('summary').click();
    await expect(attached).toContainText(question);
    await expect(page.getByTestId('ticket-messages')).toContainText('ניסיתי את מה שהעוזר אמר');

    const [row] = await sql<{ source: string; subject: string; chat: { role: string; content: string }[] }>(
      `select source, subject, chat from support_tickets where id = $1`,
      [ticketId],
    );
    expect(row).toEqual({
      source: 'chat',
      subject: question,
      chat: [
        { role: 'user', content: question },
        { role: 'assistant', content: expect.stringContaining('שאלה טובה!') },
      ],
    });
  });

  test('the contact form opens a ticket: a visitor gets the team’s answer by email; a signed-in customer finds it in the app', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const rand = () => Math.floor(Math.random() * 250);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.91.${rand()}.${rand()}` });
    const tag = `${testInfo.project.name}-${Date.now()}`;
    const visitorEmail = unique(`adm-b-visitor-${testInfo.project.name}`);
    const fill = async (name: string, email: string, message: string, first = false) => {
      await page.goto('/contact?topic=business');
      await hydrated(page);
      // the cookie banner, on the first visit
      if (first) await page.getByTestId('cookie-banner').getByRole('button', { name: 'רק חיוניות' }).click();
      const form = page.getByTestId('contact-form');
      await form.getByRole('textbox', { name: /^שם/ }).fill(name);
      await form.getByRole('textbox', { name: /^מייל/ }).fill(email);
      await form.getByRole('textbox', { name: /^ההודעה/ }).fill(message);
      await form.getByRole('button', { name: 'שליחה' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'ההודעה נשלחה. תודה!' })).toBeVisible();
    };

    await fill(`רינה ${tag}`, visitorEmail, `אתם עושים גם בר מצווה? ${tag}\nאנחנו כ־200 אורחים.`, true);
    const sent = page.getByTestId('contact-ticket');
    await expect(sent).toContainText(/מספר הפנייה: #\d+/);
    await expect(sent).toContainText('התשובה תגיע למייל שלכם');
    await expect(sent.getByRole('link')).toHaveCount(0);
    const [ticket] = await sql<{
      id: string;
      source: string;
      user_id: string | null;
      category: string;
      subject: string;
    }>(`select id, source, user_id, category, subject from support_tickets where email = $1`, [visitorEmail]);
    expect(ticket).toMatchObject({
      source: 'contact',
      user_id: null,
      category: 'business',
      subject: `אתם עושים גם בר מצווה? ${tag}`,
    });
    // (still kept as a contact message too)
    expect(await sql(`select 1 from contact_messages where email = $1`, [visitorEmail])).toHaveLength(1);

    // the team: a visitor's ticket, answered by email only
    const agent = await another(browser, testInfo);
    await staffMember(agent, 'support', testInfo);
    await agent.goto(`/app/admin/support/${ticket!.id}`);
    await hydrated(agent);
    const panel = agent.getByTestId('admin-customer');
    await expect(panel).toHaveAttribute('data-kind', 'visitor');
    await expect(panel).toContainText(visitorEmail);
    await expect(panel).toContainText('בלי חשבון');
    await expect(panel.getByTestId('admin-customer-link')).toHaveCount(0);
    await agent.getByTestId('admin-composer-text').fill('כן! נשמח לעזור. שלחנו לך פרטים.');
    await agent.getByTestId('admin-send').click();
    const confirm = agent.getByRole('dialog');
    await expect(confirm).toContainText('התשובה תישלח במייל');
    await expect(confirm).toContainText(`רינה ${tag}`);
    await expect(confirm).toContainText(visitorEmail);
    await agent.getByTestId('admin-reply-confirm').click();
    await expect(toast(agent, 'התשובה נשלחה ללקוח')).toBeVisible();
    await expect.poll(() => emailed(ticket!.id), { timeout: 10_000 }).toBe('sent');
    await agent.context().close();

    // a signed-in customer's message is theirs in the app
    await signUpAs(page, unique(`adm-b-signed-${testInfo.project.name}`));
    await fill(`דנה ${tag}`, 'dana-contact@example.com', `שאלה על חשבונית ${tag}`);
    await expect(sent).toContainText('אפשר לעקוב אחרי הפנייה ולהשיב בה ב״תמיכה״.');
    await sent.getByRole('link', { name: 'לפנייה' }).click();
    await page.waitForURL(/\/app\/support\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('ticket-messages')).toContainText(`שאלה על חשבונית ${tag}`);
  });

  test('a viewer can’t open the support inbox or act on a ticket; a customer doesn’t know it exists', async ({
    page,
    browser,
  }, testInfo) => {
    const someTicket = '00000000-0000-4000-8000-000000000000';
    await staffMember(page, 'viewer', testInfo);
    await page.goto('/app/admin/support');
    await page.waitForURL(/\/app\/admin\?denied=support\.view$/);
    await hydrated(page);
    await expect(page.getByTestId('admin-denied')).toBeVisible();
    await expect(page.getByTestId('admin-nav-support')).toHaveCount(0);
    await page.goto(`/app/admin/support/${someTicket}`);
    await page.waitForURL(/\/app\/admin\?denied=support\.view$/);
    // the server refuses the actions too
    for (const [path, method, data] of [
      [`/api/admin/support/${someTicket}/reply`, 'post', { body: 'x' }],
      [`/api/admin/support/${someTicket}/note`, 'post', { body: 'x' }],
      [`/api/admin/support/${someTicket}`, 'patch', { status: 'closed' }],
    ] as const) {
      const res = await page.request[method](path, { data });
      expect(res.status(), path).toBe(403);
      expect(await res.json()).toEqual({ ok: false, code: 'forbidden' });
    }

    // a customer: "not found", both the page and the API
    const customer = await another(browser, testInfo);
    await signUpAs(customer, unique('adm-b-nosy'));
    expect((await customer.goto('/app/admin/support'))?.status()).toBe(404);
    const res = await customer.request.post(`/api/admin/support/${someTicket}/reply`, {
      data: { body: 'x' },
    });
    expect(res.status()).toBe(404);
    // and someone else's ticket isn't theirs either
    const [other] = await sql<{ id: string; subject: string }>(
      `select id, subject from support_tickets where user_id is not null limit 1`,
    );
    if (other) {
      // the site's own 404 (the page streams behind its skeleton, so the status line stays 200)
      await customer.goto(`/app/support/${other.id}`);
      await hydrated(customer);
      await expect(customer.getByRole('heading', { level: 1, name: 'לא מצאנו את העמוד הזה' })).toBeVisible();
      await expect(customer.getByText(other.subject)).toHaveCount(0);
      expect((await customer.request.get(`/api/support/tickets/${other.id}`)).status()).toBe(404);
    }
    await customer.context().close();
  });

  for (const lang of ['he', 'en'] as const)
    test(`the new screens, ${lang}: axe clean, and how they look`, async ({ page, browser }, testInfo) => {
      test.setTimeout(180_000);
      const mobile = isMobile(testInfo);
      await page.setExtraHTTPHeaders({
        'x-forwarded-for': `10.92.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
      });

      // the customer, with a name, a phone and an invitation
      await signUpAs(page, unique(`adm-b-a11y-${lang}-${testInfo.project.name}`));
      await uiLanguage(page, lang);
      const account = await page.request.patch('/api/account', {
        data: { fullName: lang === 'he' ? 'דנה כהן' : 'Dana Cohen', phone: '050-1234567' },
      });
      expect(account.ok()).toBe(true);
      const { id: invitationId } = await createInvitation(page);

      await page.goto('/app/support');
      await hydrated(page);
      await audit(page, `customer-empty-${lang}`);
      await shot(page, `customer-empty-${lang}`);

      await page.goto('/app/support/new');
      await hydrated(page);
      await page.getByTestId('ticket-submit').click();
      await audit(page, `customer-new-errors-${lang}`);

      // a ticket from the assistant (the conversation attached) about the invitation, answered
      const opened = await page.request.post('/api/support/tickets', {
        data: {
          subject:
            lang === 'he' ? 'הסרטון ברקע לא מתנגן בטלפון' : 'The background video doesn’t play on my phone',
          category: 'bug',
          body:
            lang === 'he'
              ? 'בדקתי בשני טלפונים, הסרטון מופיע כתמונה בלבד.'
              : 'I checked on two phones; the video shows as a still picture.',
          invitationId,
          locale: lang,
          source: 'chat',
          chat: [
            { role: 'user', content: lang === 'he' ? 'למה הסרטון לא מתנגן?' : 'Why doesn’t the video play?' },
            {
              role: 'assistant',
              content:
                lang === 'he'
                  ? 'חלק מהטלפונים עוצרים ניגון אוטומטי במצב חיסכון בסוללה.'
                  : 'Some phones stop autoplay in battery saver mode.',
            },
          ],
        },
      });
      expect(opened.status()).toBe(201);
      const { ticket } = (await opened.json()) as { ticket: { id: string } };

      const agent = await another(browser, testInfo);
      await staffMember(agent, 'support', testInfo);
      await uiLanguage(agent, lang);
      const agentApi = (path: string, method: 'post' | 'patch', data: unknown) =>
        agent.request[method](`/api/admin/support/${ticket.id}${path}`, { data });
      expect(
        (
          await agentApi('/reply', 'post', {
            body:
              lang === 'he'
                ? 'תודה! בדקנו: במצב חיסכון בסוללה הטלפון מציג תמונה במקום סרטון. כבו אותו ונסו שוב.'
                : 'Thanks! In battery saver mode the phone shows a picture instead of the video. Turn it off and try again.',
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await agentApi('/note', 'post', { body: lang === 'he' ? 'לבדוק באייפון' : 'Check on an iPhone' })
        ).ok(),
      ).toBe(true);
      expect((await agentApi('', 'patch', { priority: 'high' })).ok()).toBe(true);

      await page.goto('/app/support');
      await hydrated(page);
      await audit(page, `customer-list-${lang}`);
      await shot(page, `customer-list-${lang}`);

      await page.goto(`/app/support/${ticket.id}`);
      await hydrated(page);
      await page.getByTestId('ticket-chat').locator('summary').click();
      await audit(page, `customer-ticket-${lang}`);
      await shot(page, `customer-ticket-${lang}`);
      await page.getByTestId('ticket-close').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page, `customer-close-${lang}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // the assistant's hand-off
      await page.getByTestId('support-launcher').click();
      const chat = page.getByTestId('support-chat');
      const input = chat.getByRole('textbox');
      await input.fill(lang === 'he' ? 'איך מחליפים גופן?' : 'How do I change the font?');
      await input.press('Enter');
      await expect(
        chat
          .getByRole('log')
          .locator('p')
          .filter({ hasText: /שאלה טובה!/ }),
      ).toBeVisible();
      await chat.getByTestId('support-human').click();
      await expect(chat.getByTestId('handoff')).toBeVisible();
      await audit(page, `customer-handoff-${lang}`);
      await shot(page, `customer-handoff-${lang}`);

      // the console
      await agent.goto('/app/admin/support?status=all');
      await hydrated(agent);
      await expect(agent.getByTestId(mobile ? 'inbox-cards' : 'inbox-table')).toBeVisible();
      await audit(agent, `console-inbox-${lang}`);
      await shot(agent, `console-inbox-${lang}`);
      await agent.goto(`/app/admin/support/${ticket.id}`);
      await hydrated(agent);
      await agent.getByTestId('admin-chat').locator('summary').click();
      await audit(agent, `console-ticket-${lang}`);
      await shot(agent, `console-ticket-${lang}`);
      await agent.getByTestId('admin-remove').click();
      await expect(agent.getByRole('dialog')).toBeVisible();
      await agent.getByTestId('admin-remove-confirm').click();
      // the reason is required
      await expect(agent.getByTestId('admin-remove-reason')).toHaveAttribute('aria-invalid', 'true');
      await audit(agent, `console-delete-${lang}`);
      await agent.keyboard.press('Escape');
      await agent.context().close();
    });
});

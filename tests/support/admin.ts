import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { hydrated, sql } from './phase5b';

/**
 * What the admin console's end-to-end specs share (tests/e2e/admin-*.spec.ts): staff members of each
 * role, customers with an invitation, guests' replies, the console in either language, the live
 * connection, an accessibility audit and screenshots (QA_SHOTS=1).
 */

export type Role = 'owner' | 'admin' | 'support' | 'finance' | 'viewer';
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };

export const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** A new account signed in on `page`, with the name it signed up with. */
export async function signUpAs(page: Page, email: string, name?: string) {
  await page.goto('/signup');
  await hydrated(page);
  if (name) await page.fill('input[name=name]', name);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await hydrated(page);
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await hydrated(page);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
}

/** A staff member of `role` signed in on `page`: their email on the staff list first, then sign-up. */
export async function staffMember(page: Page, role: Role, name = `Staff ${role}`): Promise<string> {
  const email = unique(`adm-a-${role}`);
  await sql(`insert into public.admin_staff (email, role) values ($1, $2)`, [email, role]);
  await signUpAs(page, email, name);
  return email;
}

/** The console's (and the app's) UI language for this browser. */
export async function uiLang(page: Page, lang: 'he' | 'en') {
  const url = new URL('/', page.url().startsWith('http') ? page.url() : 'http://127.0.0.1');
  await page.context().addCookies([{ name: 'ui_lang', value: lang, url: url.toString() }]);
}

export async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await hydrated(page);
  return res;
}

/** Reloads the page and waits until it is the hydrated page (a streamed part keeps a hidden copy until then). */
export async function reloaded(page: Page) {
  await page.reload();
  await hydrated(page);
}

/** The console's page follows the system live. */
export async function live(page: Page) {
  await expect(page.getByTestId('admin-live').first()).toHaveAttribute('data-state', 'live', {
    timeout: 20_000,
  });
}

/** A mark a reload would wipe out: the page changed by itself only if it is still there. */
export const mark = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __adminMark?: number }).__adminMark = 1;
  });
export const stillMarked = (page: Page) =>
  page.evaluate(() => (window as unknown as { __adminMark?: number }).__adminMark === 1);

export interface Customer {
  context: BrowserContext;
  page: Page;
  email: string;
  userId: string;
  name: string;
}

/** A customer (a host) in a browser of their own, signed up with `name`. */
export async function customer(browser: Browser, name: string, viewport = PHONE): Promise<Customer> {
  const context = await browser.newContext(viewport);
  const page = await context.newPage();
  const email = unique('adm-a-customer');
  await signUpAs(page, email, name);
  const [row] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [email]);
  return { context, page, email, userId: row!.id, name };
}

/** A wedding the customer creates through the app's API (its hosts' names make its title). */
export async function createInvitation(page: Page, primary: string, secondary: string | null = null) {
  const res = await page.request.post('/api/invitations', {
    data: {
      templateId: 'sahar-bordeaux',
      eventType: 'wedding',
      locales: ['he'],
      defaultLocale: 'he',
      hosts: { primary: { he: primary }, ...(secondary ? { secondary: { he: secondary } } : {}) },
      date: '2027-06-17',
      startTime: '19:30',
      timezone: 'Asia/Jerusalem',
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { id: string; slug: string };
}

/** Published as the database's own publish does (the draft as it is, its first version). */
export async function publish(id: string) {
  await sql(
    `update public.invitations set status = 'published', published = draft, version = 1, published_at = now()
     where id = $1`,
    [id],
  );
  await sql(
    `insert into public.invitation_versions (invitation_id, version, document)
     select id, 1, published from public.invitations where id = $1`,
    [id],
  );
}

/** A guest's reply through the RSVP route: coming with `adults` (and no children), or not coming. */
export async function reply(page: Page, slug: string, adults: number, name = 'אורח') {
  const body =
    adults > 0
      ? {
          attending: true,
          adults: Array.from({ length: adults }, (_, i) => ({
            firstName: `${name} ${i + 1}`,
            lastName: 'כהן',
            phone: i === 0 ? '050-123-4567' : null,
            email: null,
            dietary: [],
            dietaryNotes: null,
          })),
          children: [],
        }
      : { attending: false, contact: { fullName: `${name} כהן`, phone: '050-123-4567', email: null } };
  const res = await page.request.post('/api/invitations/rsvp', {
    data: {
      invitationSlug: slug,
      locale: 'he',
      hp: '',
      renderedAt: Date.now() - 10_000,
      answers: {},
      message: null,
      ...body,
    },
    // each reply its own address: the per-address limit never couples tests
    headers: { 'x-forwarded-for': `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join('.')}` },
  });
  expect(res.status(), await res.text()).toBe(200);
}

/** A number shown on the page (digits only: "1,234" → 1234). */
export const numberIn = async (page: Page, testId: string) =>
  Number(((await page.getByTestId(testId).locator('[data-value]').innerText()) || '').replace(/[^\d]/g, ''));

/** The digits of an element's text ("1,234" → 1234). */
export const digitsOf = async (locator: Locator) => Number((await locator.innerText()).replace(/[^\d]/g, ''));

/**
 * An action through its dialog (`testId`: the dialog's form): its fields (`fill`), the reason it asks
 * for — its button stays off until the reason is long enough — then its one button.
 */
export async function act(
  page: Page,
  testId: string,
  reason: string | null,
  fill?: (form: Locator) => Promise<void>,
) {
  const form = page.getByTestId(testId);
  await expect(form).toBeVisible();
  if (fill) await fill(form);
  const confirm = page.getByTestId(`${testId}-confirm`);
  if (reason !== null) {
    await form.locator('textarea[name=reason]').fill('ab');
    await expect(confirm).toBeDisabled();
    await form.locator('textarea[name=reason]').fill(reason);
  }
  await expect(confirm).toBeEnabled();
  await confirm.click();
}

/** A toast says it's done (and the dialog closed). */
export async function done(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

/**
 * A control that is off says why: the wrapper that stands in for it takes the keyboard's focus, and
 * the bubble tells the reason.
 */
export async function offBecause(page: Page, control: Locator, why: string) {
  await expect(control).toBeDisabled();
  const stand = control.locator('xpath=ancestor::*[@data-disabled-hint][1]');
  // on screen first: a hint closes when the page (or its table) scrolls under it, and focus scrolls
  await stand.scrollIntoViewIfNeeded();
  await expect(async () => {
    await stand.blur();
    await stand.focus();
    await expect(page.getByRole('tooltip')).toContainText(why, { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
}

/** A row (desktop: the table) or a card (phones) of a list, by its `data-*` key. */
export const listed = (page: Page, attr: string, value: string) =>
  page.locator(`tr[${attr}="${value}"]:visible, a[${attr}="${value}"]:visible`);

/** Opens what a list's row (its first link) or card is about. */
export const openListed = (page: Page, attr: string, value: string) =>
  page.locator(`tr[${attr}="${value}"]:visible a, a[${attr}="${value}"]:visible`).first().click();

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * WCAG 2.1 AA on what is on screen: any violation fails (the console has no accepted ones). `within`:
 * only that part (an open dialog: the page behind it is audited on its own).
 */
export async function audit(page: Page, key: string, within?: string) {
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      null,
      { timeout: 4_000 },
    )
    .catch(() => undefined);
  let builder = new AxeBuilder({ page }).options({ resultTypes: ['violations'] }).withTags(TAGS);
  if (within) builder = builder.include(within);
  const results = await builder.analyze();
  const found = results.violations.map((v) => ({
    id: v.id,
    help: v.help,
    targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')),
  }));
  expect(found, `accessibility violations on ${key} (${test.info().project.name})`).toEqual([]);
}

const SHOTS = process.env.QA_SHOTS ? 'tests/.artifacts/adm-a-shots' : null;

/** A screenshot to look at (QA_SHOTS=1): tests/.artifacts/adm-a-shots/adm-a-<phone|desktop>-<name>.png */
export async function shot(page: Page, name: string, fullPage = false) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  await page.screenshot({ path: `${SHOTS}/adm-a-${phone ? 'phone' : 'desktop'}-${name}.png`, fullPage });
}

/** The page never scrolls sideways (tables scroll inside their own box). */
export async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'the page scrolls sideways').toBeLessThanOrEqual(1);
}

export { hydrated, sql };

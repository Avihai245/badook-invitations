import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';
import { stubExternalMedia } from '../support/external';
import { TEMPLATE_IDS } from '../../src/features/invitations/templates/registry';
import { GUIDE_TEXT } from '../../src/lib/i18n/event-day-guide';

// Seven languages: a guest reads the invitation in their own language — the personal link, the cover,
// the RSVP — in Hebrew, English and Arabic (right to left, digits never mirrored); the language menu
// across all seven; the language picked from the browser without a reload; the host's machine
// translation that waits for review; WhatsApp in each guest's language; the event day's table guide
// and table number in the guest's language; and the stress test: every design in Russian and Arabic
// with every text 40% longer, on a phone and a desktop, with no horizontal scroll and no clipped text.

const LOCAL = !process.env.PW_BASE_URL;
const WHATSAPP = `http://127.0.0.1:${Number(process.env.PW_WHATSAPP_PORT || 54340)}`;
const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const DB_URL = Object.assign(new URL(admin), {
  pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}`,
}).toString();
const NOW = '2026-09-23T10:00:00Z';
const ALL = ['he', 'en', 'ru', 'ar', 'fr', 'es', 'am'] as const;
type Lang = (typeof ALL)[number];

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

const saved = (page: Page) =>
  expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({ timeout: 15_000 });

async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

function collectErrors(page: Page): string[] {
  void stubExternalMedia(page);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function signUp(
  page: Page,
  email = `i18n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
) {
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

/** The hosts' names as each language writes them. */
const NAMES: Record<Lang, { primary: string; secondary: string }> = {
  he: { primary: 'נועה', secondary: 'איתי' },
  en: { primary: 'Noa', secondary: 'Itay' },
  ru: { primary: 'Ноа', secondary: 'Итай' },
  ar: { primary: 'نوعا', secondary: 'إيتاي' },
  fr: { primary: 'Noa', secondary: 'Itay' },
  es: { primary: 'Noa', secondary: 'Itay' },
  am: { primary: 'ኖዓ', secondary: 'ኢታይ' },
};
/** What the host writes for the place (name and address) in each language. */
const PLACE: Record<Lang, string> = {
  he: 'אחוזת הגפן, זכרון יעקב',
  en: 'Ahuzat HaGefen, Zikhron Yaakov',
  ru: 'Ахузат ха-Гефен, Зихрон-Яаков',
  ar: 'أحوزات هجيفن، زخرون يعقوب',
  fr: 'Ahuzat HaGefen, Zikhron Yaakov',
  es: 'Ahuzat HaGefen, Zikhron Yaakov',
  am: 'አሑዛት ሃጌፈን፣ ዚክሮን ያዕቆብ',
};

async function createInvitation(page: Page, locales: readonly Lang[], defaultLocale: Lang = locales[0]!) {
  const pick = (k: 'primary' | 'secondary') => Object.fromEntries(locales.map((l) => [l, NAMES[l][k]]));
  return page.evaluate(
    async (body) => {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, ...((await res.json()) as { id: string; slug: string }) };
    },
    {
      templateId: 'sahar-bordeaux',
      eventType: 'wedding',
      locales,
      defaultLocale,
      hosts: { primary: pick('primary'), secondary: pick('secondary') },
      date: '2027-06-17',
      startTime: '19:30',
      timezone: 'Asia/Jerusalem',
    },
  );
}

/** Sets `value` at a dotted path of a JSON document. */
function setPath(root: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  let node: Record<string, unknown> = root;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (next === null || typeof next !== 'object') node[part] = {};
    node = node[part] as Record<string, unknown>;
  }
  node[parts.at(-1)!] = value;
}

/**
 * Publishes through the API; what the publish check says is missing (the place, in each language) is
 * written into the draft first — as the host would in the editor.
 */
async function publishFilled(page: Page, id: string): Promise<string> {
  for (let round = 0; round < 4; round++) {
    const res = await page.evaluate(async (invitationId) => {
      const r = await fetch(`/api/invitations/${invitationId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      return {
        status: r.status,
        body: (await r.json()) as { slug?: string; issues?: { path: string; code: string }[] },
      };
    }, id);
    if (res.status === 200) return res.body.slug!;
    expect(res.status, JSON.stringify(res.body)).toBe(422);
    const [row] = await query<{ draft: Record<string, unknown>; updated: string }>(
      `select draft, updated_at::text as updated from invitations where id = $1`,
      [id],
    );
    for (const issue of res.body.issues ?? []) {
      if (issue.code !== 'missing_translation' && issue.code !== 'required') continue;
      const locale = issue.path.split('.').at(-1) as Lang;
      setPath(row!.draft, issue.path, PLACE[locale] ?? PLACE.en);
    }
    const saved = await page.evaluate(
      async ({ invitationId, draft, updatedAt }) =>
        (
          await fetch(`/api/invitations/${invitationId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ draft, updatedAt }),
          })
        ).status,
      { invitationId: id, draft: row!.draft, updatedAt: row!.updated },
    );
    expect(saved).toBe(200);
  }
  throw new Error('could not publish');
}

interface ApiGuest {
  id: string;
  name: string;
  token: string;
  language: string | null;
  response: { attending: boolean } | null;
}
const listGuests = (page: Page, id: string) =>
  page.evaluate(async (invitationId) => {
    const res = await fetch(`/api/invitations/${invitationId}/guests`);
    return ((await res.json()) as { guests: ApiGuest[] }).guests;
  }, id);

/**
 * The digits of `text` inside `selector` read left to right on screen, as numbers do in every language
 * (Hebrew and Arabic included): the first digit's box is left of the last one's.
 */
async function digitsLeftToRight(page: Page, selector: string, text: string): Promise<boolean> {
  return page.evaluate(
    ({ selector, text }) => {
      const root = document.querySelector(selector);
      if (!root) return false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent?.indexOf(text) ?? -1;
        if (at < 0) continue;
        const box = (i: number) => {
          const r = document.createRange();
          r.setStart(node!, i);
          r.setEnd(node!, i + 1);
          return r.getBoundingClientRect();
        };
        return box(at).left < box(at + text.length - 1).left;
      }
      return false;
    },
    { selector, text },
  );
}

/** Every countdown number's digits (a box each) run left to right on screen: 23 hours never read 32. */
async function countdownLeftToRight(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const numbers = [...document.querySelectorAll('.cd-num')];
    return (
      numbers.length > 0 &&
      numbers.every((n) => {
        const left = [...n.querySelectorAll(':scope > .cd-d')].map((d) => d.getBoundingClientRect().left);
        return left.length > 1 && left.every((x, i) => i === 0 || x > left[i - 1]!);
      })
    );
  });
}

/** Text clipped by its own box (overflow hidden / ellipsis / line clamp), or sticking out of the page. */
async function clippedOrOverflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const width = document.documentElement.clientWidth;
    // inside a box that scrolls sideways on purpose (a horizontal timeline), text may run past the page
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
      }
      return false;
    };
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
    for (const el of document.querySelectorAll('main *, .fab, .lang-menu')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      // decorative art (a scene's oversized numeral…) bleeds past its frame on purpose
      if (!own || el.closest('[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      // screen-reader-only text is a 1px box on purpose
      if (rect.width <= 1 || rect.height <= 1) continue;
      const clipsX = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis';
      const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
      const clamp = cs.getPropertyValue('-webkit-line-clamp');
      if (clipsX && el.scrollWidth > el.clientWidth + 1) out.push(`clipped sideways: ${describe(el)}`);
      if ((clipsY || (clamp && clamp !== 'none')) && el.scrollHeight > el.clientHeight + 1)
        out.push(`clipped: ${describe(el)}`);
      if (!inScroller(el) && (rect.right > width + 1 || rect.left < -1))
        out.push(
          `outside the page: ${describe(el)} (${Math.round(rect.left)}–${Math.round(rect.right)} of ${width})`,
        );
    }
    return out;
  });
}

test.describe('seven languages', () => {
  test('a guest reads it in their language: personal link → cover → RSVP (Hebrew, English, Arabic)', async ({
    page,
    context,
  }) => {
    test.skip(!LOCAL, 'reads the database');
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = collectErrors(page);
    await signUp(page);
    const created = await createInvitation(page, ['he', 'en', 'ar'], 'he');
    expect(created.status).toBe(201);
    const slug = await publishFilled(page, created.id);
    const add = await page.evaluate(
      async ({ invitationId, guests }) =>
        (
          await fetch(`/api/invitations/${invitationId}/guests`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ guests }),
          })
        ).status,
      {
        invitationId: created.id,
        guests: [
          { name: 'דנה לוי', phone: '050-4441001' },
          { name: 'Emma Stone', phone: '050-4441002', language: 'en' },
          { name: 'سمير حداد', phone: '050-4441003', language: 'ar' },
        ],
      },
    );
    expect(add).toBe(200);
    const guests = await listGuests(page, created.id);
    expect(guests.map((g) => [g.name, g.language])).toEqual([
      ['דנה לוי', null],
      ['Emma Stone', 'en'],
      ['سمير حداد', 'ar'],
    ]);

    const expectations = [
      { guest: 'דנה לוי', lang: 'he', dir: 'rtl', first: 'דנה', success: /תודה|נתראה|שמחים/ },
      { guest: 'Emma Stone', lang: 'en', dir: 'ltr', first: 'Emma', success: /thank|see you|can’t wait/i },
      { guest: 'سمير حداد', lang: 'ar', dir: 'rtl', first: 'سمير', success: /شكر|نراكم|بانتظار/ },
    ] as const;
    for (const x of expectations) {
      const token = guests.find((g) => g.name === x.guest)!.token;
      const guest = await context.newPage();
      await guest.emulateMedia({ reducedMotion: 'reduce' });
      await guest.setExtraHTTPHeaders({
        'x-forwarded-for': `10.7.${Math.floor(Math.random() * 250)}.${x.lang.length}`,
      });
      const guestErrors = collectErrors(guest);
      // an older personal link without the language: the page opens in its default, then switches to
      // the guest's own (no reload) once the link is read
      await open(guest, `/i/${slug}?g=${token}`);
      await expect(guest.locator('html')).toHaveAttribute('lang', x.lang, { timeout: 10_000 });
      await expect(guest.locator('html')).toHaveAttribute('dir', x.dir);
      // the cover speaks the guest's language, then opens
      const cover = guest.locator('.cover');
      await expect(cover).toBeVisible();
      await expect(cover.locator(`.l10n > [data-l~="${x.lang}"]`).first()).toBeVisible();
      await guest.locator('.cover-tap').click();
      await expect(guest.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
      await expect(guest.locator('.hero .names')).toContainText(NAMES[x.lang].primary);
      // numbers read left to right on screen in every direction — the countdown's too, whose digits
      // are boxes of their own (they roll)
      expect(await digitsLeftToRight(guest, 'main', '2027')).toBe(true);
      expect(await countdownLeftToRight(guest)).toBe(true);
      // RSVP in the guest's language, their name already in the form
      const form = guest.locator('.form');
      await form.scrollIntoViewIfNeeded();
      await form.locator('.opt').first().click();
      await expect(form.locator('[id$="-a0.firstName"]')).toHaveValue(x.first);
      // labels start on the reading side: right in Hebrew and Arabic, left in English
      const [label, box] = await Promise.all([
        form.locator('label').first().boundingBox(),
        form.boundingBox(),
      ]);
      if (x.dir === 'rtl')
        expect(box!.x + box!.width - (label!.x + label!.width)).toBeLessThan(box!.width / 2);
      else expect(label!.x - box!.x).toBeLessThan(box!.width / 2);
      await form.locator('button.btn-primary').click();
      await expect(guest.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
      await expect(guest.locator('.success[role="status"]')).toContainText(x.success);
      const overflow = await guest.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      expect(guestErrors).toEqual([]);
      await guest.close();
    }
    // each reply is its guest's, in the language they answered in
    const replies = await query<{ primary_name: string; locale: string }>(
      `select r.primary_name, r.locale from rsvp_responses r join invitations i on i.id = r.invitation_id
       where i.id = $1 order by r.created_at`,
      [created.id],
    );
    expect(replies.map((r) => r.locale)).toEqual(['he', 'en', 'ar']);
    expect((await listGuests(page, created.id)).every((g) => g.response?.attending)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the language menu switches between all seven in place; the choice holds; the browser’s language is picked', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(!LOCAL, 'reads the database');
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = collectErrors(page);
    await signUp(page);
    const created = await createInvitation(page, ALL, 'he');
    expect(created.status).toBe(201);
    const slug = await publishFilled(page, created.id);

    await open(page, `/i/${slug}?open=1`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    const menu = page.locator('.lang-menu');
    for (const lang of ['en', 'ru', 'ar', 'fr', 'es', 'am', 'he'] as const) {
      await menu.locator('summary').click();
      const before = page.url();
      await menu.locator(`a[hreflang="${lang}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page).toHaveURL(new RegExp(`lang=${lang}`));
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr',
      );
      await expect(page.locator('.hero .names')).toContainText(NAMES[lang].primary);
      // in place: the same document (no navigation), the address says the language
      expect(new URL(page.url()).pathname).toBe(new URL(before).pathname);
      expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, lang).toBe(0);
    }
    // the guest's choice holds for the visit
    await menu.locator('summary').click();
    await menu.locator('a[hreflang="ru"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await open(page, `/i/${slug}?open=1`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // a new visitor whose phone speaks Arabic, or French, gets that language without a reload
    for (const [locale, lang] of [
      ['ar-IL', 'ar'],
      ['fr-FR', 'fr'],
      ['de-DE', 'he'],
    ] as const) {
      const ctx = await browser.newContext({ ...testInfo.project.use, locale });
      const visitor = await ctx.newPage();
      await open(visitor, `/i/${slug}`);
      await expect(visitor.locator('html')).toHaveAttribute('lang', lang);
      // the cover shows its text in that language from the start — no reload on the way
      await expect(visitor.locator(`.cover .l10n > [data-l~="${lang}"]`).first()).toBeVisible();
      expect(
        await visitor.evaluate(() =>
          performance.getEntriesByType('navigation').map((e) => (e as PerformanceNavigationTiming).type),
        ),
      ).toEqual(['navigate']);
      await ctx.close();
    }
    expect(errors).toEqual([]);
  });

  test('WhatsApp writes to each guest in their language — the invitation’s when Meta has none', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!LOCAL, 'reads the database');
    test.setTimeout(180_000);
    // one of INVITES_ADMIN_EMAILS: sends without buying credits
    await signUp(page, `i18n-admin-${testInfo.project.name}@example.com`);
    const created = await createInvitation(page, ['he', 'en', 'ar'], 'he');
    const slug = await publishFilled(page, created.id);
    const suffix = testInfo.project.name === 'desktop' ? '5' : '6';
    const phone = (n: number) => `050-88${suffix}000${n}`;
    const e164 = (n: number) => `972${phone(n).replace(/\D/g, '').slice(1)}`;
    await page.evaluate(
      async ({ invitationId, guests }) =>
        fetch(`/api/invitations/${invitationId}/guests`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ guests }),
        }),
      {
        invitationId: created.id,
        guests: [
          { name: 'דנה לוי', phone: phone(1) },
          { name: 'Emma Stone', phone: phone(2), language: 'en' },
          { name: 'سمير حداد', phone: phone(3), language: 'ar' },
        ],
      },
    );
    await open(page, `/app/invitations/${created.id}/guests`);
    // the language column: changed in place
    const emma = page.locator('[data-guest-row]:visible').filter({ hasText: 'Emma Stone' });
    await expect(emma.locator('select[data-guest-language]')).toHaveValue('en');

    await page.getByRole('button', { name: 'שליחה בוואטסאפ לכל המוזמנים' }).click();
    const dialog = page.getByRole('dialog');
    // how many go out in each language, and each message as it will look
    const languages = dialog.getByTestId('whatsapp-languages');
    await expect(languages).toContainText('עברית: הודעה אחת');
    await expect(languages).toContainText('English: הודעה אחת');
    await expect(languages).toContainText('العربية: הודעה אחת');
    await dialog.getByRole('radio', { name: 'English' }).click();
    await expect(dialog.getByTestId('whatsapp-preview')).toContainText('invite you to the wedding');
    await dialog.getByRole('checkbox').last().check();
    await dialog.getByRole('button', { name: 'שליחה ל-3 מוזמנים' }).click();
    await expect(dialog.getByTestId('whatsapp-done')).toBeVisible({ timeout: 60_000 });

    const sentTo = async (n: number) =>
      (await (await request.get(`${WHATSAPP}/__sent?to=${e164(n)}`)).json()) as {
        language: string;
        params: string[];
        button: string;
      }[];
    const guests = await listGuests(page, created.id);
    const token = (name: string) => guests.find((g) => g.name === name)!.token;
    const [dana] = await sentTo(1);
    expect(dana).toMatchObject({ language: 'he', button: `${slug}?g=${token('דנה לוי')}` });
    const [emmaMessage] = await sentTo(2);
    expect(emmaMessage).toMatchObject({ language: 'en', button: `${slug}?g=${token('Emma Stone')}&lang=en` });
    expect(emmaMessage!.params[2]).toBe('to the wedding');
    // Meta hasn't approved the Arabic template here (the stand-in says 132001): the invitation's Hebrew
    const [samir] = await sentTo(3);
    expect(samir).toMatchObject({ language: 'he', button: `${slug}?g=${token('سمير حداد')}` });
  });

  test('the event day speaks the guest’s language: their table guide, and their table number on WhatsApp', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!LOCAL, 'reads the database');
    test.skip(testInfo.project.name !== 'mobile', 'one run, on the guest’s phone');
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    const email = `i18n-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await signUp(page, email);
    // a plan with the table guide, and credits for the table numbers
    await query(
      `insert into accounts (user_id, plan, message_credits) select id, 'business', 10 from auth.users where email = $1
       on conflict (user_id) do update set plan = excluded.plan, message_credits = excluded.message_credits`,
      [email],
    );
    const created = await createInvitation(page, ['he', 'en', 'ru', 'ar'], 'he');
    const slug = await publishFilled(page, created.id);
    const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    const families = [
      { name: 'משפחת כהן', language: null, table: 12 },
      { name: 'Семья Ивановых', language: 'ru', table: 12 },
      { name: 'عائلة حداد', language: 'ar', table: 3 },
    ].map((f, i) => ({ ...f, phone: `+9725${suffix}${i}2`, token: `i18nday${suffix}${i}abcdefghij` }));
    for (const f of families) {
      const [g] = await query<{ id: string }>(
        `insert into invitation_guests (invitation_id, name, party_size, phone, token, preferred_language)
         values ($1, $2, 2, $3, $4, $5) returning id`,
        [created.id, f.name, f.phone, f.token, f.language],
      );
      await query(
        `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, guest_id)
         values ($1, true, 'he', $2, 2, 0, $3, $4)`,
        [created.id, f.name, `h-${Math.random()}`, g!.id],
      );
    }
    // the tables, and who sits where: the seating screen's own save
    const seated = await page.evaluate(
      async ({ id, seats }) => {
        const state = (
          (await (await fetch(`/api/invitations/${id}/seating`)).json()) as {
            state: {
              version: number;
              plan: Record<string, unknown> & { layout: Record<string, unknown> };
              units: { id: string; name: string }[];
            };
          }
        ).state;
        const table = (number: number, x: number) => ({
          id: crypto.randomUUID(),
          number,
          label: null,
          shape: 'round',
          capacity: 10,
          x,
          y: 4,
          w: 1.8,
          h: 1.8,
          rotation: 0,
          zones: [],
          locked: false,
        });
        const tables = [table(12, 6), table(3, 12)];
        const ids = Object.fromEntries(tables.map((t) => [t.number, t.id]));
        const assignments: Record<string, { tableId: string; source: 'host' }> = {};
        for (const s of seats) {
          const unit = state.units.find((u) => u.name === s.name)!;
          assignments[unit.id] = { tableId: ids[s.table]!, source: 'host' };
        }
        const entrance = { id: crypto.randomUUID(), kind: 'entrance', x: 2, y: 11, w: 2, h: 0.6 };
        const plan = {
          ...state.plan,
          tables,
          assignments,
          layout: { ...state.plan.layout, landmarks: [{ ...entrance, rotation: 0, label: null }] },
        };
        const res = await fetch(`/api/invitations/${id}/seating`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ version: state.version, plan }),
        });
        return { status: res.status, units: state.units.map((u) => u.id) };
      },
      { id: created.id, seats: families },
    );
    expect(seated.status).toBe(200);

    // the guide opens in the guest's own language — Russian left to right, Arabic right to left
    const [cohen, ivanov, haddad] = families;
    await page.goto(`/e/${slug}/table?g=${ivanov!.token}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('guide-table')).toContainText(GUIDE_TEXT.ru.guide.yourTable);
    await expect(page.getByTestId('guide-table-number')).toHaveText('12');
    // their name kept whole in any script
    await expect(page.getByText('Здравствуйте, Семья Ивановых')).toBeVisible();
    await expect(page.locator('bdi', { hasText: 'Семья Ивановых' })).toHaveCount(1);
    await page.goto(`/e/${slug}/table?g=${haddad!.token}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('guide-table')).toContainText(GUIDE_TEXT.ar.guide.yourTable);
    await expect(page.getByTestId('guide-table-number')).toHaveText('3');
    expect(await digitsLeftToRight(page, '[data-testid="guide-table"]', '3')).toBe(true);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    // any of the invitation's languages from its menu; the address keeps the choice
    await page.getByTestId('guide-language').selectOption('ru');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByTestId('guide-table')).toContainText(GUIDE_TEXT.ru.guide.yourTable);
    await expect(page).toHaveURL(/lang=ru/);
    // no language of their own: the invitation's
    await page.goto(`/e/${slug}/table?g=${cohen!.token}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');

    // the table number on WhatsApp: in the guest's language when its template is approved, else the
    // invitation's (the stand-in refuses Arabic); the button opens the guide in their language
    const sent = await page.evaluate(
      async ({ id, unitIds }) => {
        const res = await fetch(`/api/invitations/${id}/seating/notices`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'send', unitIds }),
        });
        return res.status;
      },
      { id: created.id, unitIds: seated.units },
    );
    expect(sent).toBe(200);
    const sentTo = async (phone: string) =>
      (await (await request.get(`${WHATSAPP}/__sent?to=${phone.replace(/^\+/, '')}`)).json()) as {
        template: string;
        language: string;
        params: string[];
        button: string;
      }[];
    await expect.poll(async () => (await sentTo(ivanov!.phone)).length, { timeout: 20_000 }).toBe(1);
    const [ru] = await sentTo(ivanov!.phone);
    expect(ru).toMatchObject({
      template: 'badook_table',
      language: 'ru',
      params: ['Семья Ивановых', `${NAMES.ru.primary} & ${NAMES.ru.secondary}`, '12'],
      button: `${slug}/table?g=${ivanov!.token}&lang=ru`,
    });
    await expect.poll(async () => (await sentTo(haddad!.phone)).length, { timeout: 20_000 }).toBe(1);
    const [ar] = await sentTo(haddad!.phone);
    expect(ar).toMatchObject({
      template: 'badook_table',
      language: 'he',
      params: ['عائلة حداد', `${NAMES.he.primary} & ${NAMES.he.secondary}`, '3'],
      button: `${slug}/table?g=${haddad!.token}`,
    });
    await expect.poll(async () => (await sentTo(cohen!.phone)).length, { timeout: 20_000 }).toBe(1);
    expect((await sentTo(cohen!.phone))[0]).toMatchObject({ language: 'he' });
    expect(errors).toEqual([]);
  });

  test('the host adds English, translates it automatically, reviews — publishing waits for the review', async ({
    page,
  }, testInfo) => {
    test.skip(!LOCAL, 'reads the database');
    test.skip(testInfo.project.name !== 'desktop', 'the editor flow, once');
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = collectErrors(page);
    // an admin account (INVITES_ADMIN_EMAILS): the automatic translation is in its plan
    await signUp(page, 'i18n-translate-desktop@example.com');
    const created = await createInvitation(page, ['he'], 'he');
    await publishFilled(page, created.id);

    await open(page, `/app/invitations/${created.id}/edit`);
    await page.getByRole('tab', { name: 'הגדרות' }).click();
    await page.getByRole('button', { name: 'שפות', exact: true }).click();
    await page.getByRole('button', { name: 'הוספת אנגלית' }).click();
    const english = page.locator('[data-testid="invitation-languages"] [data-language="en"]');
    await expect(english).toBeVisible();
    await english.getByRole('button', { name: 'תרגום לאנגלית' }).click();
    await expect(page.getByText(/טקסטים תורגמו לאנגלית|טקסט אחד תורגם לאנגלית/).first()).toBeVisible({
      timeout: 30_000,
    });

    // the review: the machine's English next to the Hebrew; the names are the host's to write
    await english.getByRole('button', { name: 'בדיקת התרגום' }).click();
    const review = page.getByTestId('translation-review');
    await expect(review).toBeVisible();
    const values = await review
      .locator('textarea')
      .evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value));
    expect(values.some((v) => v.startsWith('[en] '))).toBe(true);
    const copy = review.getByRole('button', { name: 'העתקה כמו שהוא' });
    for (let i = 0; (await copy.count()) && i < 10; i++) await copy.first().click();
    await page
      .getByRole('dialog', { name: 'התרגום לאנגלית' })
      .getByRole('button', { name: 'סגירה' })
      .first()
      .click();
    await saved(page);

    // publishing waits for the review: the server says so, and so does the dialog
    const refused = await page.evaluate(async (invitationId) => {
      const r = await fetch(`/api/invitations/${invitationId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      return { status: r.status, body: (await r.json()) as { code: string; locales?: string[] } };
    }, created.id);
    expect(refused).toMatchObject({
      status: 422,
      body: { code: 'translations_unreviewed', locales: ['en'] },
    });
    await page.getByRole('button', { name: 'פרסום השינויים' }).click();
    let publish = page.getByRole('dialog');
    await expect(publish.getByTestId('publish-translations')).toContainText('באנגלית');
    await expect(publish.getByRole('button', { name: 'פרסום', exact: true })).toBeDisabled();
    await publish.getByRole('button', { name: 'לבדיקה' }).click();
    await expect(review).toBeVisible();
    await page.getByTestId('approve-all').click();
    await expect(page.getByText(/תרגומים אושרו|התרגום אושר/).first()).toBeVisible({ timeout: 15_000 });
    await expect(review.getByText('אין מה לבדוק באנגלית.')).toBeVisible();
    await page
      .getByRole('dialog', { name: 'התרגום לאנגלית' })
      .getByRole('button', { name: 'סגירה' })
      .first()
      .click();

    const rows = await query<{ status: string }>(
      `select status from translations where invitation_id = $1 and deleted_at is null`,
      [created.id],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === 'approved')).toBe(true);
    // approved: it publishes
    await page.getByRole('button', { name: 'פרסום השינויים' }).click();
    publish = page.getByRole('dialog');
    await publish.getByRole('button', { name: 'פרסום', exact: true }).click();
    await expect(publish.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('every design holds 40% longer text', () => {
  for (const id of TEMPLATE_IDS) {
    for (const lang of ['ru', 'ar'] as const) {
      test(`${id} · ${lang}`, async ({ page }) => {
        const errors = collectErrors(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`/dev/invitations/render/${id}/${lang}/longer?open=1&now=${NOW}`);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
        await expect(page.locator('.hero .names')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
        expect(await clippedOrOverflowing(page)).toEqual([]);
        // the cover too: names and hint in the longer texts
        await page.goto(`/dev/invitations/render/${id}/${lang}/longer?now=${NOW}`);
        await page.evaluate(() => document.fonts.ready);
        const cover = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          return [...document.querySelectorAll('.cover *')]
            .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.right > width + 1 || r.left < -1);
            })
            .map((el) => (el.textContent ?? '').trim().slice(0, 40));
        });
        expect(cover).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  }
});

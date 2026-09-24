import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';
import { demoInvitations } from '../../scripts/seed';

// P1: the public page /i/[slug], RSVP into the database, ICS — against the local stack started by
// playwright.config.ts (fresh `badook_e2e` database with the seed). With PW_BASE_URL (a deployment)
// the database checks are skipped.

const LOCAL = !process.env.PW_BASE_URL;
const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const DB_URL = Object.assign(new URL(admin), {
  pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}`,
}).toString();

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** Navigates and waits until React has hydrated — before that, controls are plain HTML. */
async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

/** Each test gets its own client address, so the per-IP RSVP rate limit never couples tests. */
async function asGuest(page: Page) {
  // no reveal animations moving fields around while the test types into them
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join('.')}`,
  });
}

test.describe('public invitations', () => {
  for (const { slug, doc } of demoInvitations()) {
    for (const locale of doc.locales) {
      test(`${slug} · ${locale}`, async ({ page }) => {
        const errors = collectErrors(page);
        const res = await open(page, `/i/${slug}?lang=${locale}&open=1`);
        expect(res?.status()).toBe(200);
        if (errors.length && process.env.PW_DUMP_HYDRATION) {
          const { writeFileSync } = await import('node:fs');
          const tag = `${slug}-${locale}-${test.info().project.name}`;
          writeFileSync(`test-results/server-${tag}.html`, (await res?.text()) ?? '');
          writeFileSync(`test-results/client-${tag}.html`, await page.content());
        }
        expect(errors).toEqual([]);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
        await expect(page.locator('.hero .names')).toBeVisible();
        await expect(page.locator('.cover')).toHaveCount(0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }

  test('without ?lang the default locale; noindex; unknown slugs 404', async ({ page, request }) => {
    await page.goto('/i/noa-and-itay');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect((await request.get('/i/no-such-invitation')).status()).toBe(404);
    // a guest on such a link gets a page that says so, in both languages (the link's first)
    expect((await page.goto('/i/no-such-invitation?lang=en'))?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { name: 'This invitation isn’t available right now' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ההזמנה לא זמינה כרגע' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    // an English-only invitation asked for Hebrew falls back to English
    await page.goto('/i/mayas-baby-shower?lang=he');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('a hidden invitation is hidden from search engines the way crawlers see it', async ({ request }) => {
    // robots.txt lets crawlers fetch the invitation — otherwise they could never read its noindex
    const robotsTxt = await (await request.get('/robots.txt')).text();
    expect(robotsTxt).toMatch(/^User-Agent: \*$/m);
    expect(robotsTxt).toMatch(/^Allow: \/$/m);
    expect(robotsTxt).toMatch(/^Disallow: \/api\/$/m);
    expect(robotsTxt).not.toMatch(/^Disallow: \/i\//m);
    // the server-rendered <head> (no JavaScript), for Googlebot and Bingbot alike
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ]) {
      for (const path of ['/i/noa-and-itay', '/i/noa-and-itay?lang=en']) {
        const res = await request.get(path, { headers: { 'user-agent': ua } });
        expect(res.status()).toBe(200);
        const head = (await res.text()).split('</head>')[0];
        expect(head).toContain('<meta name="robots" content="noindex, nofollow, noarchive, noimageindex"/>');
        expect(head).toContain(
          '<meta name="googlebot" content="noindex, nofollow, noarchive, noimageindex"/>',
        );
      }
    }
    // its link-preview image and calendar file too
    const og = await request.get('/i/noa-and-itay/opengraph-image?lang=he');
    expect(og.headers()['x-robots-tag']).toBe('noindex');
    const ics = await request.get('/i/noa-and-itay/event.ics?venue=venue-main');
    expect(ics.headers()['x-robots-tag']).toBe('noindex, nofollow');
  });

  test('an uploaded hero file that may be missing keeps the placeholder art under it', async ({ page }) => {
    // The baby shower fixture points at uploads (upload:hero-watercolor.*) that aren't in the bucket:
    // the video stays transparent when they fail, so the art and its scrim must be drawn beneath it.
    await open(page, '/i/mayas-baby-shower?open=1');
    const media = page.locator('.hero-media');
    await expect(media.locator('video')).toHaveAttribute('src', /\/invitation-media\/hero-watercolor\.mp4$/);
    await expect(media.locator('svg.hills')).toHaveCount(1);
    await expect(media.locator('.scrim')).toHaveCount(1);
    expect(await media.evaluate((m) => m.lastElementChild?.localName)).toBe('video');
  });

  test('the cover opens; ?open=1 skips it before the first paint; the language pill keeps it skipped', async ({
    page,
  }) => {
    await open(page, '/i/noa-and-itay');
    await expect(page.locator('body')).toHaveClass(/locked/);
    await page.locator('.cover > button[aria-label]').click();
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('body')).not.toHaveClass(/locked/);

    await page.goto('/i/noa-and-itay?open=1');
    // hidden before the first paint (the node itself goes once hydrated)
    await expect(page.locator('.cover')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-opened', '1');
    await expect(page.locator('body')).not.toHaveClass(/locked/);
    const pill = page.locator('a[href*="lang=en"]').first();
    await expect(pill).toHaveAttribute('href', '/i/noa-and-itay?lang=en&open=1');
  });

  test('ICS download: one venue, local time as UTC, CRLF', async ({ request, page }) => {
    const res = await request.get('/i/noa-and-itay/event.ics?venue=venue-main&lang=en');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
    expect(res.headers()['content-disposition']).toContain('noa-and-itay-venue-main.ics');
    const body = await res.text();
    expect(body).toContain('\r\nDTSTART:20270617T163000Z\r\n');
    expect(body).toContain('\r\nDTEND:20270617T220000Z\r\n');
    expect(body).toMatch(/^BEGIN:VCALENDAR\r\n[\s\S]*END:VCALENDAR\r\n$/);
    expect((await request.get('/i/noa-and-itay/event.ics?venue=nope')).status()).toBe(404);
    await page.goto('/i/noa-and-itay?lang=en&open=1');
    await expect(
      page.locator('a[href^="/i/noa-and-itay/event.ics?venue=venue-main&lang=en"]').first(),
    ).toBeAttached();
  });
});

test.describe('RSVP', () => {
  test.skip(!LOCAL, 'checks rows in the local database');

  test('yes with 2 adults + 1 child lands as 1 response + 3 attendees; editing replaces it', async ({
    page,
  }, testInfo) => {
    await asGuest(page);
    const last = `E2e${testInfo.project.name}${randomUUID().slice(0, 6)}`;
    await open(page, '/i/noa-and-itay?open=1');
    const form = page.locator('.form');
    await form.locator('.opt').first().click();
    await form.locator('.srow').nth(0).locator('.stepper button').last().click();
    await form.locator('.srow').nth(1).locator('.stepper button').last().click();
    await form.locator('[id$="-a0.firstName"]').fill('דנה');
    await form.locator('[id$="-a0.lastName"]').fill(last);
    await form.locator('[id$="-a0.phone"]').fill('050-123-4567');
    await form.locator('[id$="-a1.firstName"]').fill('תום');
    await form.locator('[id$="-a1.lastName"]').fill(last);
    await form.locator('[id$="-c0.fullName"]').fill('נועם');
    const vegetarian = form.locator('label.chip', {
      has: page.locator('input[data-diet="a0"][value="vegetarian"]'),
    });
    await vegetarian.click();
    await expect(vegetarian.locator('input')).toBeChecked();
    await form.locator('button.btn-primary').click();
    await expect(page.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });

    const rows = await query<{ id: string; adults_count: number; children_count: number; attendees: number }>(
      `select r.id, r.adults_count, r.children_count, (select count(*)::int from rsvp_attendees a where a.response_id = r.id) attendees
         from rsvp_responses r join invitations i on i.id = r.invitation_id
        where i.slug = 'noa-and-itay' and r.primary_name = $1`,
      [`דנה ${last}`],
    );
    expect(rows).toEqual([{ id: expect.any(String), adults_count: 2, children_count: 1, attendees: 3 }]);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rsvp:noa-and-itay') ?? 'null'));
    expect(stored).toMatchObject({ responseId: rows[0]!.id, editToken: expect.any(String) });

    // reload → "you already replied — edit" → prefilled → one adult, no children → replaced in place
    await page.reload();
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await page.locator('.replied button').click();
    await expect(form.locator('[id$="-a0.lastName"]')).toHaveValue(last);
    await form.locator('.srow').nth(0).locator('.stepper button').first().click();
    await form.locator('.srow').nth(1).locator('.stepper button').first().click();
    await form.locator('button.btn-primary').click();
    await expect(page.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
    const after = await query<{ id: string; attendees: number }>(
      `select r.id, (select count(*)::int from rsvp_attendees a where a.response_id = r.id) attendees
         from rsvp_responses r where r.primary_name = $1`,
      [`דנה ${last}`],
    );
    expect(after).toEqual([{ id: rows[0]!.id, attendees: 1 }]);
  });

  test('the host’s form options: one full-name field, no email, no message — stored that way', async ({
    page,
  }, testInfo) => {
    await asGuest(page);
    // a copy of noa-and-itay with those options under its own slug (a fresh page, never cached)
    const slug = `options-${testInfo.project.name}-${randomUUID().slice(0, 6)}`;
    await query(
      `insert into invitations (owner_id, template_id, slug, status, event_type, draft, published, published_at)
       select owner_id, template_id, $1, 'published', event_type, draft,
         jsonb_set(jsonb_set(published, '{share,slug}', to_jsonb($1::text)), '{sections}', (
           select jsonb_agg(case when s->>'type' = 'rsvp'
             then jsonb_set(s, '{data}', (s->'data') || '{"nameFormat":"full","askEmail":false,"askMessage":false}')
             else s end order by i)
           from jsonb_array_elements(published->'sections') with ordinality as t(s, i))),
         now()
       from invitations where slug = 'noa-and-itay'`,
      [slug],
    );
    const name = `דנה ${randomUUID().slice(0, 6)}`;
    await open(page, `/i/${slug}?open=1`);
    const form = page.locator('.form');
    await form.locator('.opt').first().click();
    await expect(form.locator('[id$="-a0.firstName"]')).toHaveCount(0);
    await expect(form.locator('[id$="-a0.email"]')).toHaveCount(0);
    await expect(form.locator('textarea')).toHaveCount(0);
    await form.locator('button.btn-primary').click();
    await expect(form.locator('[id$="-a0.fullName"]')).toHaveAttribute('aria-invalid', 'true');
    await form.locator('[id$="-a0.fullName"]').fill(name);
    await form.locator('[id$="-a0.phone"]').fill('050-123-4567');
    await form.locator('button.btn-primary').click();
    await expect(page.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
    const rows = await query(
      `select r.primary_name, r.email, r.message, a.first_name, a.last_name, a.full_name
         from rsvp_responses r join invitations i on i.id = r.invitation_id
         join rsvp_attendees a on a.response_id = r.id
        where i.slug = $1`,
      [slug],
    );
    expect(rows).toEqual([
      { primary_name: name, email: null, message: null, first_name: null, last_name: null, full_name: name },
    ]);
  });

  test('decline needs a name and a phone or email, then stores a reply without attendees', async ({
    page,
  }, testInfo) => {
    await asGuest(page);
    const name = `Decline ${testInfo.project.name} ${randomUUID().slice(0, 6)}`;
    await open(page, '/i/mayas-baby-shower?open=1');
    const form = page.locator('.form');
    await form.locator('.opt').nth(1).click();
    await form.locator('[id$="-d.fullName"]').fill(name);
    await form.locator('button.btn-primary').click();
    await expect(form.locator('.msg[role="alert"]').first()).toBeVisible();
    await form.locator('[id$="-d.email"]').fill('dana@example.com');
    await form.locator('button.btn-primary').click();
    await expect(page.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
    const rows = await query(
      `select attending, adults_count, email, (select count(*)::int from rsvp_attendees a where a.response_id = r.id) attendees
         from rsvp_responses r where primary_name = $1`,
      [name],
    );
    expect(rows).toEqual([{ attending: false, adults_count: 0, email: 'dana@example.com', attendees: 0 }]);
  });
});

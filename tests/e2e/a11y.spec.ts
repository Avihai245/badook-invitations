import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';
import { stubExternalMedia } from '../support/external';

// WCAG 2.1 AA on the guest's path (Phase 5C): an automated audit (axe-core) of what guests and family
// open — the cover and the sections of several designs (photographic, drawn, dark, Lumière), the RSVP
// form's errors and its thank-you, a save-the-date, the table guide, the entrance station, the live
// gallery's upload page and the family's review page — on a phone and a desktop (the two projects),
// in Hebrew and English. Violations known and accepted are listed in a11y-baseline.json (with the
// reason); anything else fails. AXE_REPORT=1 keeps every page's findings in tests/.artifacts/axe.

const LOCAL = !process.env.PW_BASE_URL;
test.skip(!LOCAL, 'sets plans and seats guests in the local stack');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BASELINE = JSON.parse(readFileSync('tests/e2e/a11y-baseline.json', 'utf8')) as {
  rules: Record<string, { pages: string[]; reason: string }>;
};
const REPORT = process.env.AXE_REPORT ? 'tests/.artifacts/axe' : null;

const admin = new URL(
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
);
const DB_URL = Object.assign(new URL(admin), {
  pathname: `/${process.env.PW_DB_NAME || 'badook_e2e'}`,
}).toString();

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

/** Each test its own address: the per-address limits never couple them. */
async function asGuest(page: Page) {
  await stubExternalMedia(page);
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join('.')}`,
  });
}

/** Everything that comes in as the guest scrolls: scrolled through once, then back to the top. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await settle(page);
}

const settle = (page: Page) =>
  page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      null,
      { timeout: 4_000 },
    )
    .catch(() => undefined);

interface Finding {
  id: string;
  impact: string | null;
  help: string;
  targets: string[];
}

/** The audit of what is on screen now: fails on any violation the baseline doesn't list for `key`. */
async function audit(page: Page, key: string, exclude: string[] = []) {
  await settle(page);
  // violations only: the passes and the incomplete ones aren't collected (much faster)
  let builder = new AxeBuilder({ page }).withTags(TAGS).options({ resultTypes: ['violations'] });
  for (const selector of exclude) builder = builder.exclude(selector);
  const results = await builder.analyze();
  const findings: Finding[] = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    targets: v.nodes.slice(0, 10).map((n) => n.target.join(' ')),
  }));
  const project = test.info().project.name;
  if (REPORT) {
    mkdirSync(REPORT, { recursive: true });
    writeFileSync(`${REPORT}/${project}-${key}.json`, JSON.stringify(findings, null, 2));
  }
  const fresh = findings.filter((f) => {
    const accepted = BASELINE.rules[f.id];
    return !accepted || !accepted.pages.some((p) => p === '*' || key.startsWith(p));
  });
  expect(fresh, `accessibility violations on ${key} (${project})`).toEqual([]);
}

// ─── the invitation: several designs, both languages ─────────────────────────────────────────────

const DESIGNS = [
  { slug: 'noa-and-itay', name: 'sahar' },
  { slug: 'demo-lumiere', name: 'lumiere' },
  { slug: 'demo-kalanit', name: 'kalanit' },
  { slug: 'demo-midnight-bloom', name: 'midnight' },
  { slug: 'demo-caesarea-shore', name: 'caesarea' },
];

test.describe('the invitation', () => {
  for (const d of DESIGNS)
    for (const lang of ['he', 'en'] as const)
      test(`${d.name} · ${lang}: the cover, then the sections`, async ({ page }) => {
        test.setTimeout(90_000);
        await asGuest(page);
        await open(page, `/i/${d.slug}?lang=${lang}`);
        const cover = page.locator('.cover');
        if (await cover.count()) {
          await audit(page, `invitation-cover-${d.name}-${lang}`);
          await page.locator('.cover > button[aria-label]').click();
          await expect(cover).toHaveCount(0, { timeout: 10_000 });
        }
        await scrollThrough(page);
        await audit(page, `invitation-sections-${d.name}-${lang}`);
      });

  test('a save-the-date', async ({ page }) => {
    await asGuest(page);
    await open(page, '/i/noa-and-itay-save-the-date');
    if (await page.locator('.cover').count()) {
      await audit(page, 'savethedate-cover');
      await page.locator('.cover > button[aria-label]').click();
      await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    }
    await scrollThrough(page);
    await audit(page, 'savethedate-sections');
  });

  for (const lang of ['he', 'en'] as const)
    test(`the RSVP form: its errors, then its thank-you · ${lang}`, async ({ page }) => {
      await asGuest(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, `/i/noa-and-itay?lang=${lang}&open=1`);
      const form = page.locator('.form');
      await form.scrollIntoViewIfNeeded();
      await form.locator('.opt').first().click();
      await form.locator('button.btn-primary').click();
      await expect(form.locator('[aria-invalid="true"]').first()).toBeVisible();
      // the first error has the focus; each stepper is named by its question
      await expect(form.locator('[id$="-a0.firstName"]')).toBeFocused();
      await expect(
        form.getByRole('group', { name: lang === 'he' ? 'כמה מבוגרים?' : 'How many adults?' }),
      ).toBeVisible();
      await audit(page, `rsvp-errors-${lang}`);
      const last = `A11y${randomUUID().slice(0, 6)}`;
      await form.locator('[id$="-a0.firstName"]').fill(lang === 'he' ? 'דנה' : 'Dana');
      await form.locator('[id$="-a0.lastName"]').fill(last);
      await form.locator('[id$="-a0.phone"]').fill('050-123-4567');
      await form.locator('button.btn-primary').click();
      await expect(page.locator('.success[role="status"]')).toBeVisible({ timeout: 10_000 });
      await audit(page, `rsvp-success-${lang}`);
    });
});

// ─── the manual pass, kept: the keyboard under the cover, "pause the animations" ──────────────────

/** Endless animations running now (a drawn scene's loop, the particles, the scroll cue). */
const looping = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length,
  );

test.describe('by hand', () => {
  test('the cover holds the keyboard until it opens; the animations can be paused', async ({ page }) => {
    await asGuest(page);
    await open(page, '/i/demo-midnight-bloom?lang=he');
    // while the cover is up, the keyboard stays on it (nothing hidden under it takes the focus)
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() => !document.activeElement?.closest('main, .fab')),
        `tab ${i + 1} stays on the cover`,
      ).toBe(true);
    }
    await page.locator('.cover > button[aria-label]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('main')).not.toHaveAttribute('inert');
    // the page's own loops (the drawn scene) stop, and start again
    const pause = page.getByRole('button', { name: 'עצירת האנימציות' });
    await expect(pause).toBeVisible();
    await expect.poll(() => looping(page)).toBeGreaterThan(0);
    await pause.click();
    await expect.poll(() => looping(page)).toBe(0);
    await expect(page.locator('html')).toHaveAttribute('data-still', '1');
    await page.getByRole('button', { name: 'הפעלת האנימציות' }).click();
    await expect.poll(() => looping(page)).toBeGreaterThan(0);
    await audit(page, 'motion-pause');
    // nothing to pause for a guest who asked for less motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/i/demo-midnight-bloom?lang=en&open=1');
    await expect(page.getByTestId('motion-pause')).toHaveCount(0);
  });
});

// ─── the event day and the live gallery ──────────────────────────────────────────────────────────

type Plan = 'free' | 'pro' | 'business';
async function host(page: Page, prefix: string, plan: Plan) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await sql(
    `insert into accounts (user_id, plan, plan_status, plan_renews_at)
       select id, $2, 'active', now() + interval '30 days' from auth.users where email = $1
     on conflict (user_id) do update
       set plan = excluded.plan, plan_status = 'active', plan_renews_at = excluded.plan_renews_at`,
    [email, plan],
  );
  const inv = await page.evaluate(async () => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he', 'en'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return (await res.json()) as { id: string; slug: string };
  });
  return { email, ...inv };
}

test.describe('the event day', () => {
  test('the table guide and the entrance station', async ({ page, browser }) => {
    test.setTimeout(120_000);
    const ev = await host(page, 'a11y-day', 'business');
    const token = `a11y${randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const [g] = await sql<{ id: string }>(
      `insert into invitation_guests (invitation_id, name, party_size, phone, token)
       values ($1, 'משפחת כהן', 3, $2, $3) returning id`,
      [ev.id, `+9725${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`, token],
    );
    await sql(
      `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash, guest_id)
       values ($1, true, 'he', 'משפחת כהן', 3, 0, $2, $3)`,
      [ev.id, `h-${Math.random()}`, g!.id],
    );
    await sql(
      `update invitations set status = 'published', published = draft, published_at = now() where id = $1`,
      [ev.id],
    );
    const seated = await page.evaluate(async (id) => {
      const state = (
        (await (await fetch(`/api/invitations/${id}/seating`)).json()) as {
          state: {
            version: number;
            plan: Record<string, unknown> & { layout: Record<string, unknown> };
            units: { id: string; name: string }[];
          };
        }
      ).state;
      const table = {
        id: crypto.randomUUID(),
        number: 12,
        label: null,
        shape: 'round',
        capacity: 10,
        x: 6,
        y: 4,
        w: 1.8,
        h: 1.8,
        rotation: 0,
        zones: [],
        locked: false,
      };
      const unit = state.units[0]!;
      const plan = {
        ...state.plan,
        tables: [table],
        assignments: { [unit.id]: { tableId: table.id, source: 'host' } },
        layout: {
          ...state.plan.layout,
          landmarks: [
            {
              id: crypto.randomUUID(),
              kind: 'entrance',
              x: 2,
              y: 11,
              w: 2,
              h: 0.6,
              rotation: 0,
              label: null,
            },
          ],
        },
      };
      const res = await fetch(`/api/invitations/${id}/seating`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: state.version, plan }),
      });
      return res.status;
    }, ev.id);
    expect(seated).toBe(200);
    await open(page, `/app/invitations/${ev.id}/live`);
    const stationUrl = await page.getByTestId('station-link').inputValue();

    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    const guest = await context.newPage();
    await asGuest(guest);
    for (const lang of ['he', 'en'] as const) {
      await guest.goto(`/e/${ev.slug}/table?g=${token}&lang=${lang}`);
      await expect(guest.getByTestId('guide-table-number')).toHaveText('12');
      await audit(guest, `table-guide-${lang}`);
      await guest.goto(`${stationUrl}&lang=${lang}`);
      await expect(guest.getByTestId('station')).toBeVisible();
      await audit(guest, `station-${lang}`);
    }
    await context.close();
  });
});

test.describe('the live gallery', () => {
  test('the guests’ upload page', async ({ page, browser }) => {
    test.setTimeout(90_000);
    const ev = await host(page, 'a11y-gallery', 'business');
    await open(page, `/app/invitations/${ev.id}/gallery`);
    await page.getByTestId('gallery-start').getByRole('button', { name: 'הפעלת הגלריה' }).click();
    await expect(page.getByTestId('gallery-screen')).toBeVisible();
    const link = await page.getByTestId('gallery-upload-link').inputValue();
    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    const guest = await context.newPage();
    await asGuest(guest);
    for (const lang of ['he', 'en'] as const) {
      await guest.goto(`${link}&lang=${lang}`);
      // the queue is ready (IndexedDB opened, the uploader started)
      await expect(guest.getByTestId('gallery-files')).toBeAttached();
      await audit(guest, `gallery-upload-${lang}`);
    }
    await context.close();
  });
});

// ─── the family's review link ────────────────────────────────────────────────────────────────────

test.describe('the draft review', () => {
  test('the review page with a comment, its thread and the list', async ({ page, browser }) => {
    test.setTimeout(90_000);
    const ev = await host(page, 'a11y-review', 'free');
    const made = await page.evaluate(async (id) => {
      const res = await fetch(`/api/invitations/${id}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expiresInDays: null }),
      });
      return (await res.json()) as { link: { url: string } };
    }, ev.id);
    const url = new URL(made.link.url);
    const context = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
    const guest = await context.newPage();
    await asGuest(guest);
    for (const lang of ['he', 'en'] as const) {
      await guest.goto(`${url.pathname}/${lang}`);
      await expect(guest.getByTestId('review-banner')).toBeVisible();
      if (await guest.locator('.cover').count()) {
        await audit(guest, `review-cover-${lang}`);
        await guest.locator('.cover > button[aria-label]').click();
        await expect(guest.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
      }
      await scrollThrough(guest);
      await audit(guest, `review-page-${lang}`);
      // a comment on a spot (the keyboard's way: a part from the form's list)
      await guest
        .getByTestId('review-ui')
        .getByRole('button', { name: lang === 'he' ? 'הוספת הערה' : 'Add a comment' })
        .click();
      await guest.locator('.rv-hint .rv-link').click();
      const compose = guest.getByTestId('review-compose');
      await expect(compose).toBeVisible();
      await audit(guest, `review-compose-${lang}`);
      await compose
        .getByLabel(lang === 'he' ? 'השם שלכם' : 'Your name')
        .fill(lang === 'he' ? 'דודה רותי' : 'Aunt Ruth');
      await compose
        .getByLabel(lang === 'he' ? 'ההערה' : 'Comment')
        .fill(lang === 'he' ? 'השמות יותר גדולים' : 'Bigger names');
      await compose.getByRole('button', { name: lang === 'he' ? 'שליחת ההערה' : 'Send the comment' }).click();
      const thread = guest.getByTestId('review-thread');
      await expect(thread).toBeVisible();
      await audit(guest, `review-thread-${lang}`);
      await guest.keyboard.press('Escape');
      // a comment's sheet closed without sending: the focus is back on "add a comment"
      await guest.getByRole('button', { name: lang === 'he' ? 'הוספת הערה' : 'Add a comment' }).click();
      await guest.locator('.rv-hint .rv-link').click();
      await expect(compose).toBeVisible();
      await guest.keyboard.press('Escape');
      await expect(compose).toBeHidden();
      await expect(
        guest.getByRole('button', { name: lang === 'he' ? 'הוספת הערה' : 'Add a comment' }),
      ).toBeFocused();
      await guest.getByTestId('review-list-button').click();
      await expect(guest.getByTestId('review-list')).toBeVisible();
      await audit(guest, `review-list-${lang}`);
      await guest.keyboard.press('Escape');
    }
    await context.close();
  });
});

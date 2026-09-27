import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { Client } from 'pg';
import { stubExternalMedia } from '../support/external';

// The studio (Phase 5C) end to end, on the local stack: "design it for me" with the AI stand-in and
// without it (applied, then undone; and from the gallery's wizard to a new invitation); the family's
// review link (a comment pinned on the draft reaches the host live, who answers and marks it handled);
// an autosaved version restored; the invitation read aloud (the text-to-speech stand-in's audio, and
// the device's own voice when there is none); a video's captions; and each feature switched off —
// gone from the screens, refused by the APIs. QA_SHOTS=1 keeps screenshots in tests/.artifacts/studio.

const LOCAL = !process.env.PW_BASE_URL;
test.skip(!LOCAL, 'sets plans and reads rows of the local stack');

const SHOTS = process.env.QA_SHOTS ? 'tests/.artifacts/studio' : null;
const MOCKS = `http://127.0.0.1:${process.env.PW_WHATSAPP_PORT || 54340}`;
const TTS = `http://127.0.0.1:${process.env.PW_TTS_PORT || 55041}`;
const STORAGE = process.env.SHIM_STORAGE_DIR ?? 'tests/.artifacts/storage';
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

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  await page.screenshot({ path: `${SHOTS}/${phone ? 'phone' : 'desktop'}-${name}.png` });
}

const phoneOf = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

type Plan = 'free' | 'pro' | 'business';

/** A signed-in host on `plan` with a published-ready wedding (Hebrew + English, its venue filled in). */
async function host(page: Page, prefix: string, plan: Plan, templateId = 'sahar-bordeaux') {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  if (plan !== 'free')
    await sql(
      `insert into accounts (user_id, plan, plan_status, plan_renews_at)
         select id, $2, 'active', now() + interval '30 days' from auth.users where email = $1
       on conflict (user_id) do update
         set plan = excluded.plan, plan_status = 'active', plan_renews_at = excluded.plan_renews_at`,
      [email, plan],
    );
  const id = await page.evaluate(async (templateId) => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId,
        eventType: 'wedding',
        locales: ['he', 'en'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return ((await res.json()) as { id: string }).id;
  }, templateId);
  await editDraft(page, id, (d) => {
    type Venue = { name: Record<string, string>; address: Record<string, string> };
    const venues = (d.sections as { type: string; data: { items: Venue[] } }[]).find(
      (s) => s.type === 'venues',
    );
    venues!.data.items[0]!.name = { he: 'אחוזת הגפן', en: 'Ahuzat HaGefen' };
    venues!.data.items[0]!.address = {
      he: 'דרך הכרמים 12, זכרון יעקב',
      en: "12 Derech HaKramim, Zikhron Ya'akov",
    };
  });
  return { email, id };
}

/** Changes the stored draft (GET it, change it, PATCH it back). */
async function editDraft(page: Page, id: string, change: (d: Record<string, unknown>) => void) {
  const got = await api(page, `/api/invitations/${id}`);
  expect(got.status).toBe(200);
  const draft = got.body!.draft as Record<string, unknown>;
  change(draft);
  const saved = await api(page, `/api/invitations/${id}`, 'PATCH', { draft, updatedAt: got.body!.updatedAt });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
}

/** In the host's page: an API call as the signed-in host. */
const api = (page: Page, url: string, method = 'GET', body?: unknown) =>
  page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: res.status,
        body: (await res.json().catch(() => null)) as Record<string, unknown> | null,
      };
    },
    { url, method, body },
  );

const saved = (page: Page) =>
  expect(page.locator('[role=status]', { hasText: 'כל השינויים נשמרו' }).first()).toBeAttached({
    timeout: 20_000,
  });

/** The editor's design tab → a panel (on a phone: the design sheet). */
async function designPanel(page: Page, name: string) {
  if (phoneOf(page)) {
    await page.getByRole('navigation', { name: 'מצב העורך' }).getByRole('button', { name: 'עיצוב' }).click();
    await page.getByRole('dialog', { name: 'כל הסקשנים' }).getByRole('button', { name }).click();
  } else {
    await page.getByRole('tab', { name: 'עיצוב' }).click();
    await page.getByRole('button', { name, exact: true }).click();
  }
}

const PHOTOS = ['couple', 'sunset', 'venue'].map((n) => `tests/fixtures/media/cine-${n}.jpg`);

// ─── design it for me ────────────────────────────────────────────────────────────────────────────

test.describe('design it for me', () => {
  test('three concepts from the AI, live side by side (swiped on a phone); one applied, then undone', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const { id } = await host(page, 'studio-ai', 'business');
    await open(page, `/app/invitations/${id}/edit`);
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    await expect(frame.locator('h1.names')).toContainText('נועה', { timeout: 30_000 });
    await designPanel(page, 'עצבו לי');
    const panel = page.getByTestId('studio-panel');
    await expect(panel).toBeVisible();
    await panel.getByTestId('studio-file').setInputFiles(PHOTOS);
    await expect(panel.getByText('3 מתוך 3–5 תמונות')).toBeVisible({ timeout: 20_000 });
    await panel.getByTestId('studio-mood').fill('ים ושקיעה');
    await panel.getByTestId('studio-create').click();
    const concepts = page.getByTestId('studio-concepts');
    await expect(concepts).toBeVisible({ timeout: 45_000 });
    await expect(concepts).toHaveAttribute('data-source', 'ai');
    const cards = concepts.getByTestId('studio-concept');
    await expect(cards).toHaveCount(3);
    // the stand-in saw the photos (small JPEGs made on the device) and the mood — this test's own
    // request, found by its mood (the tests running alongside ask the stand-in too)
    const asked = (await (await page.request.get(`${MOCKS}/__ai/art`)).json()) as {
      images: number;
      mediaTypes: string[];
      bytes: number[];
      mood: string;
    }[];
    const last = asked.findLast((a) => a.mood === 'ים ושקיעה');
    expect(last, 'the request with this mood').toBeTruthy();
    expect(last!.images).toBe(3);
    expect(last!.mediaTypes).toEqual(['image/jpeg', 'image/jpeg', 'image/jpeg']);
    for (const b of last!.bytes) expect(b).toBeLessThan(360 * 1024);
    // each concept live in its own phone, on its own design
    const templates = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-template')));
    expect(new Set(templates).size).toBe(3);
    for (let i = 0; i < 3; i++)
      await expect(
        page.frameLocator(`iframe[title^="תצוגה חיה של עיצוב ${i + 1}"]`).locator('h1.names'),
      ).toContainText('נועה', { timeout: 30_000 });
    if (phoneOf(page)) {
      // one at a time: the arrows (or a swipe) move between them
      await expect(page.getByText('עיצוב 1 מתוך 3')).toBeVisible();
      await page.getByRole('button', { name: 'העיצוב הבא' }).click();
      await expect(page.getByText('עיצוב 2 מתוך 3')).toBeVisible();
    } else {
      const boxes = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
      expect(Math.abs(boxes[0]! - boxes[2]!)).toBeLessThan(2); // side by side
    }
    await shot(page, 'art-concepts');

    // one is applied as one step: the design, its palette and the photos
    const chosen = templates[1]!;
    await cards.nth(1).getByTestId('studio-use').click();
    await expect(page.getByText('העיצוב הוחל').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`iframe[src*="/app/preview-frame/${chosen}"]`)).toHaveCount(1);
    await saved(page);
    const stored = await api(page, `/api/invitations/${id}`);
    expect(stored.body!.templateId).toBe(chosen);
    const hero = (
      stored.body!.draft as { sections: { type: string; data: { media: { src: string } } }[] }
    ).sections.find((s) => s.type === 'hero')!;
    expect(hero.data.media.src).toMatch(/^upload:/);
    // the draft as it was is in the history, before the concept
    const history = await api(page, `/api/invitations/${id}/history`);
    expect((history.body!.entries as { reason: string }[]).map((e) => e.reason)).toContain('concept');

    // undo (one step): back to the design it had
    await page.locator('header').getByRole('button', { name: 'ביטול', exact: true }).click();
    await expect(page.locator('iframe[src*="/app/preview-frame/sahar-bordeaux"]')).toHaveCount(1);
    await saved(page);
    expect((await api(page, `/api/invitations/${id}`)).body!.templateId).toBe('sahar-bordeaux');
    expect(errors).toEqual([]);
  });

  test('without the AI (it fails): the concepts are composed from the photos, and say so', async ({
    page,
  }) => {
    test.skip(phoneOf(page), 'one run');
    test.setTimeout(120_000);
    const { id } = await host(page, 'studio-noai', 'business');
    await open(page, `/app/invitations/${id}/edit`);
    await designPanel(page, 'עצבו לי');
    const panel = page.getByTestId('studio-panel');
    await panel.getByTestId('studio-file').setInputFiles(PHOTOS);
    await expect(panel.getByText('3 מתוך 3–5 תמונות')).toBeVisible({ timeout: 20_000 });
    await panel.getByTestId('studio-mood').fill('crash');
    await panel.getByTestId('studio-create').click();
    const concepts = page.getByTestId('studio-concepts');
    await expect(concepts).toBeVisible({ timeout: 60_000 });
    await expect(concepts).toHaveAttribute('data-source', 'composer');
    await expect(concepts.getByText('הבינה המלאכותית לא ענתה הפעם')).toBeVisible();
    await expect(concepts.getByTestId('studio-concept')).toHaveCount(3);
    // three more: other designs
    const first = await concepts
      .getByTestId('studio-concept')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-template')));
    await page.getByTestId('studio-again').click();
    await expect
      .poll(
        async () =>
          concepts
            .getByTestId('studio-concept')
            .evaluateAll((els) => els.map((el) => el.getAttribute('data-template'))),
        // the AI is asked again first (and fails again), then the composer answers
        { timeout: 60_000 },
      )
      .not.toEqual(first);
    await concepts.getByTestId('studio-use').first().click();
    await expect(page.getByText('העיצוב הוחל').first()).toBeVisible({ timeout: 30_000 });
  });

  test('from the gallery: the wizard makes the invitation on the chosen design', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await host(page, 'studio-wizard', 'business');
    await open(page, '/app/invitations/new');
    await page.getByTestId('studio-start').click();
    const wizard = page.getByRole('dialog');
    await wizard.getByRole('radio', { name: 'חתונה' }).click();
    await wizard.getByRole('button', { name: 'המשך' }).click();
    await wizard.getByLabel('שם 1').fill('שירה');
    await wizard.getByLabel('שם 2').fill('עומר');
    await wizard.getByLabel('תאריך').fill('2027-09-02');
    await wizard.getByLabel('שעה').fill('19:00');
    await wizard.getByRole('button', { name: 'המשך' }).click();
    // the languages: Hebrew is chosen already (the host's own), one of the seven
    await expect(wizard.getByRole('checkbox', { name: 'עברית', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await wizard.getByRole('button', { name: 'המשך' }).click();
    await wizard.getByTestId('studio-file').setInputFiles(PHOTOS);
    await expect(wizard.getByText('3 מתוך 3–5 תמונות')).toBeVisible({ timeout: 20_000 });
    await wizard.getByTestId('studio-create').click();
    const concepts = page.getByTestId('studio-concepts');
    await expect(concepts).toBeVisible({ timeout: 45_000 });
    await shot(page, 'wizard-concepts');
    const chosen = await concepts.getByTestId('studio-concept').first().getAttribute('data-template');
    await concepts.getByTestId('studio-use').first().click();
    await page.waitForURL(/\/app\/invitations\/[0-9a-f-]+\/edit$/, { timeout: 60_000 });
    await expect(page.locator(`iframe[src*="/app/preview-frame/${chosen}"]`)).toHaveCount(1, {
      timeout: 30_000,
    });
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    await expect(frame.locator('h1.names')).toContainText('שירה', { timeout: 30_000 });
    expect(errors).toEqual([]);
  });
});

// ─── the family's review ─────────────────────────────────────────────────────────────────────────

/** The family's page (`hydrated`: wait for React — a link that is gone is a plain page without it). */
async function familyPage(browser: Browser, url: string, hydrated = true) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await stubExternalMedia(page);
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join('.')}`,
  });
  if (hydrated) await open(page, url);
  else await page.goto(url);
  return page;
}

test.describe('the family’s review link', () => {
  test('a comment pinned on the draft reaches the host live, who answers and marks it handled', async ({
    page,
    browser,
  }) => {
    test.skip(phoneOf(page), 'one run: the host at a desk, the family on a phone');
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const { id } = await host(page, 'studio-review', 'free');
    await open(page, `/app/invitations/${id}/edit`);
    await page.getByTestId('review-button').click();
    const drawer = page.getByTestId('review-drawer');
    await expect(drawer).toBeVisible();
    await drawer.getByTestId('review-create').click();
    const url = await drawer.getByTestId('review-url').inputValue();
    expect(url).toMatch(/\/review\/[A-Za-z0-9_-]{24}$/);
    await shot(page, 'review-host-link');

    // the family: the draft, marked, with no RSVP sent
    const family = await familyPage(browser, url);
    const familyErrors = collectErrors(family);
    await expect(family.getByTestId('review-banner')).toBeVisible();
    await expect(family.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    if (await family.locator('.cover').count()) {
      await family.locator('.cover > button.cover-tap').click();
      await expect(family.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    }
    // tap a spot on the names
    await family.getByRole('button', { name: 'הוספת הערה' }).click();
    await family.locator('h1.names').click();
    const compose = family.getByTestId('review-compose');
    await expect(compose).toBeVisible();
    await compose.getByLabel('השם שלכם').fill('דודה רותי');
    await compose.getByLabel('ההערה').fill('אפשר שהשמות יהיו גדולים יותר?');
    await compose.getByRole('button', { name: 'שליחת ההערה' }).click();
    await expect(family.getByTestId('review-thread')).toBeVisible();
    await expect(family.locator('.review-pin[data-pin="1"]')).toBeVisible();
    await shot(family, 'review-family-thread');

    // the host: live in the drawer, on the button, next to the section and on the preview
    const card = drawer.getByTestId('review-comment');
    await expect(card).toHaveCount(1, { timeout: 20_000 });
    await expect(card).toContainText('דודה רותי');
    await expect(page.getByTestId('review-button')).toContainText('1');
    await card.getByPlaceholder('כתבו תשובה…').fill('בטח! מגדילים');
    await card.getByRole('button', { name: 'שליחה' }).click();
    await expect(card).toContainText('בטח! מגדילים');
    // the family sees the answer without reloading
    await expect(family.getByTestId('review-thread')).toContainText('בטח! מגדילים', { timeout: 20_000 });
    await card.getByRole('button', { name: 'סימון כטופלה' }).click();
    await drawer.getByRole('radio', { name: 'טופלו' }).click();
    await expect(drawer.getByTestId('review-comment')).toHaveAttribute('data-status', 'handled');
    await expect(family.getByTestId('review-thread')).toContainText('טופלה', { timeout: 20_000 });
    // reopened: open again everywhere
    await drawer.getByTestId('review-comment').getByRole('button', { name: 'פתיחה מחדש' }).click();
    await drawer.getByRole('radio', { name: 'פתוחות' }).click();
    await expect(drawer.getByTestId('review-comment')).toHaveAttribute('data-status', 'open');
    await shot(page, 'review-host-drawer');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('rail-comments').first()).toHaveText(/1/);
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    const pin = frame.locator('.review-pin[data-pin="1"]');
    await expect(pin).toBeVisible();
    await shot(page, 'review-host-pins');
    await pin.click();
    await expect(page.getByTestId('review-drawer')).toBeVisible();

    // the host edits: the family's page shows the new draft by itself
    await page.keyboard.press('Escape');
    await editDraftInEditor(page);
    await expect(family.locator('.hero .eyebrow')).toContainText('בשעה טובה', { timeout: 30_000 });
    expect(errors).toEqual([]);
    expect(familyErrors).toEqual([]);
    await family.context().close();
  });
});

/** The hero's eyebrow typed in the editor (then saved). */
async function editDraftInEditor(page: Page) {
  const field = page
    .locator(
      '[data-field-path="sections.0.data.eyebrow"] input, [data-field-path="sections.0.data.eyebrow"] textarea',
    )
    .first();
  await field.fill('בשעה טובה');
  await saved(page);
}

// ─── every save recoverable ──────────────────────────────────────────────────────────────────────

test.describe('versions and saves', () => {
  test('an autosaved version is restored into the draft (and the restore can be undone)', async ({
    page,
  }) => {
    test.skip(phoneOf(page), 'one run');
    test.setTimeout(120_000);
    const { id } = await host(page, 'studio-versions', 'free');
    const original = await api(page, `/api/invitations/${id}`);
    const eyebrow = (original.body!.draft as { sections: { data: { eyebrow?: { he?: string } } }[] })
      .sections[0]!.data.eyebrow?.he;
    await open(page, `/app/invitations/${id}/edit`);
    await editDraftInEditor(page);
    await page.getByRole('button', { name: 'גרסאות', exact: true }).click();
    const list = page.getByTestId('history-list');
    await page.getByRole('radio', { name: 'שמירות' }).click();
    const entry = list.getByTestId('history-entry').first();
    await expect(entry).toHaveAttribute('data-kind', 'save');
    await entry.getByRole('button', { name: 'מה ישתנה בשחזור' }).click();
    await expect(entry.getByTestId('history-changes')).toContainText('המסך הראשי');
    await shot(page, 'versions-drawer');
    await entry.getByRole('button', { name: 'שחזור' }).click();
    await page.getByRole('dialog').last().getByRole('button', { name: 'שחזור' }).click();
    await expect(page.getByText('שוחזר: שמירה אוטומטית', { exact: true })).toBeVisible({ timeout: 20_000 });
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    if (eyebrow) await expect(frame.locator('.hero .eyebrow')).toContainText(eyebrow);
    await saved(page);
    // undone: the edit is back
    await page.locator('header').getByRole('button', { name: 'ביטול', exact: true }).click();
    await expect(frame.locator('.hero .eyebrow')).toContainText('בשעה טובה');
  });
});

// ─── read aloud, captions ────────────────────────────────────────────────────────────────────────

async function publish(page: Page, id: string) {
  const res = await api(page, `/api/invitations/${id}/publish`, 'POST', {});
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body!.slug as string;
}

test.describe('the invitation read aloud', () => {
  test('the audio made at publish plays from “listen”, and stops the music', async ({ page }) => {
    test.setTimeout(120_000);
    const { id } = await host(page, 'studio-voice', 'pro');
    const slug = await publish(page, id);
    // the stand-in read each language, in its voice (one after the other, in the background)
    type Heard = { voice: string; lang: string; format: string; text: string }[];
    const tts = async () => (await (await page.request.get(`${TTS}/__tts`)).json()) as Heard;
    await expect
      .poll(
        async () => {
          const list = await tts();
          return ['he-IL-HilaNeural', 'en-US-JennyNeural'].every((v) => list.some((r) => r.voice === v));
        },
        { timeout: 60_000 },
      )
      .toBe(true);
    const heard = await tts();
    const he = heard.find((r) => r.text.includes('נועה'))!;
    expect(he).toMatchObject({
      voice: 'he-IL-HilaNeural',
      lang: 'he-IL',
      format: 'audio-24khz-48kbitrate-mono-mp3',
    });
    expect(heard.some((r) => r.voice === 'en-US-JennyNeural' && r.text.includes('Noa'))).toBe(true);
    const guest = await page.context().newPage();
    await stubExternalMedia(guest);
    await expect
      .poll(
        async () => {
          await open(guest, `/i/${slug}?lang=he&open=1`);
          return guest
            .getByTestId('listen')
            .getAttribute('data-source')
            .catch(() => null);
        },
        { timeout: 60_000, intervals: [2_000] },
      )
      .toBe('audio');
    const listen = guest.getByTestId('listen');
    await expect(listen).toHaveAccessibleName('האזנה להזמנה');
    await listen.click();
    await expect(listen).toHaveAttribute('aria-pressed', 'true');
    await expect(listen).toHaveAccessibleName('עצירת ההקראה');
    expect(await guest.locator('.fab-listen-slot audio').evaluate((a: HTMLAudioElement) => !a.paused)).toBe(
      true,
    );
    await shot(guest, 'voice-listen');
    await listen.click();
    await expect(listen).toHaveAttribute('aria-pressed', 'false');
    // nothing about the guest is kept
    expect(
      await guest.evaluate(() => Object.keys(localStorage).filter((k) => /voice|listen/i.test(k))),
    ).toEqual([]);
  });

  test('without audio for these words: the device’s own voice, when it has one', async ({
    page,
    browser,
  }) => {
    test.skip(phoneOf(page), 'one run');
    test.setTimeout(120_000);
    const { id } = await host(page, 'studio-voice-device', 'pro');
    // the stand-in refuses these words
    await editDraft(page, id, (d) => {
      const hero = (d.sections as { type: string; data: { eyebrow: Record<string, string> } }[]).find(
        (s) => s.type === 'hero',
      )!;
      hero.data.eyebrow = { he: 'tts-fail שמחים', en: 'tts-fail Happy' };
    });
    const slug = await publish(page, id);
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const spoken: string[] = [];
      (window as unknown as { __spoken: string[] }).__spoken = spoken;
      const synth = {
        getVoices: () => [
          { lang: 'he-IL', name: 'Test Hebrew', voiceURI: 'test-he', default: true, localService: true },
        ],
        speak: (u: { text: string; onend?: () => void }) => {
          spoken.push(u.text);
          setTimeout(() => u.onend?.(), 300);
        },
        cancel: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
        text: string;
        lang = '';
        voice: unknown = null;
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      };
    });
    const guest = await context.newPage();
    await stubExternalMedia(guest);
    await open(guest, `/i/${slug}?lang=he&open=1`);
    const listen = guest.getByTestId('listen');
    await expect(listen).toHaveAttribute('data-source', 'device');
    await listen.click();
    await expect
      .poll(() => guest.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(' ')))
      .toContain('נועה');
    // a device without a voice for the language: no button at all
    const bare = await browser.newContext();
    await bare.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          getVoices: () => [],
          speak() {},
          cancel() {},
          addEventListener() {},
          removeEventListener() {},
        },
        configurable: true,
      });
    });
    const other = await bare.newPage();
    await stubExternalMedia(other);
    await open(other, `/i/${slug}?lang=he&open=1`);
    await expect(other.locator('.inv')).toBeVisible();
    await expect(other.getByTestId('listen')).toHaveCount(0);
    await context.close();
    await bare.close();
  });
});

test.describe('captions', () => {
  test('captions typed in the editor show on the guest’s video, in the page’s language', async ({ page }) => {
    test.skip(phoneOf(page), 'one run');
    test.setTimeout(120_000);
    const { id } = await host(page, 'studio-captions', 'free');
    const owner = (
      await sql<{ owner_id: string }>('select owner_id from invitations where id = $1', [id])
    )[0]!.owner_id;
    const path = `${owner}/${id}/loop.webm`;
    const target = `${STORAGE}/invitation-media/${path}`;
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync('tests/fixtures/media/cine-loop.webm', target);
    writeFileSync(`${target}.meta.json`, JSON.stringify({ contentType: 'video/webm' }));
    await editDraft(page, id, (d) => {
      const hero = (d.sections as { type: string; data: Record<string, unknown> }[]).find(
        (s) => s.type === 'hero',
      )!;
      hero.data.media = {
        kind: 'video',
        src: `upload:${path}`,
        poster: null,
        focalPoint: { x: 0.5, y: 0.5 },
      };
    });
    await open(page, `/app/invitations/${id}/edit`);
    const captions = page.getByTestId('captions');
    await expect(captions).toBeVisible({ timeout: 30_000 });
    // "the video has speech": a warning for each language without captions
    await captions.getByText('מדברים בסרטון').click();
    await captions.locator('li[data-locale="he"]').getByRole('button', { name: /הקלדה/ }).click();
    const editor = page.getByTestId('captions-editor');
    await editor.getByLabel('הטקסט 1').fill('שלום לכולם');
    await page.getByTestId('captions-save').click();
    await expect(captions.locator('li[data-locale="he"] [data-testid="captions-state"]')).toHaveText(
      'כתובית אחת',
    );
    // an SRT file for English
    await captions.getByTestId('captions-file-en').setInputFiles({
      name: 'en.srt',
      mimeType: 'application/x-subrip',
      buffer: Buffer.from(
        '1\n00:00:00,000 --> 00:00:03,000\nHello everyone\n\n2\n00:00:03,000 --> 00:00:05,000\nWelcome\n',
      ),
    });
    // the host's screens are in Hebrew: the English track's state reads "2 captions" in Hebrew
    await expect(captions.locator('li[data-locale="en"] [data-testid="captions-state"]')).toHaveText(
      '2 כתוביות',
    );
    await saved(page);
    const slug = await publish(page, id);
    const guest = await page.context().newPage();
    for (const [lang, words] of [
      ['he', 'שלום לכולם'],
      ['en', 'Hello everyone'],
    ] as const) {
      await open(guest, `/i/${slug}?lang=${lang}&open=1`);
      const track = guest.locator('.hero-media video track[kind="captions"]');
      await expect(track).toHaveAttribute('srclang', lang);
      await expect
        .poll(
          () =>
            guest.locator('.hero-media video').evaluate((v: HTMLVideoElement) => {
              const t = v.textTracks[0];
              return t ? `${t.mode}|${[...(t.cues ?? [])].map((c) => (c as VTTCue).text).join('|')}` : '';
            }),
          { timeout: 15_000 },
        )
        .toContain(`showing|${words}`);
    }
  });
});

// ─── switched off ────────────────────────────────────────────────────────────────────────────────

test.describe('each switched off', () => {
  test('gone from the screens, and the APIs refuse', async ({ page, browser }) => {
    test.skip(phoneOf(page), 'one run');
    test.setTimeout(120_000);
    const { id } = await host(page, 'studio-off', 'business');
    // a review link made while it was on
    const made = await api(page, `/api/invitations/${id}/review`, 'POST', { expiresInDays: null });
    const reviewUrl = (made.body!.link as { url: string }).url;
    for (const feature of ['draft_review', 'art_direction', 'voice'])
      expect(
        (await api(page, `/api/invitations/${id}/features`, 'PATCH', { feature, off: true })).status,
      ).toBe(200);
    await open(page, `/app/invitations/${id}/edit`);
    await expect(page.locator('iframe[title="תצוגה מקדימה של ההזמנה"]')).toBeVisible();
    await expect(page.getByTestId('review-button')).toHaveCount(0);
    await page.getByRole('tab', { name: 'עיצוב' }).click();
    await expect(page.getByRole('button', { name: 'עצבו לי', exact: true })).toHaveCount(0);
    // the APIs
    expect((await api(page, `/api/invitations/${id}/review`)).body).toMatchObject({ code: 'feature_off' });
    const art = await api(page, '/api/art-direction', 'POST', {
      invitationId: id,
      eventType: 'wedding',
      locales: ['he', 'en'],
      uiLocale: 'he',
      photos: [0, 1, 2].map(() => ({
        jpeg: 'AAAA',
        info: { swatches: [], focal: { x: 0.5, y: 0.5 }, scrim: 0.3, width: 10, height: 10 },
      })),
    });
    expect(art.status).toBe(403);
    // the family's link says nothing is there
    const family = await familyPage(browser, reviewUrl, false);
    await expect(family.getByTestId('review-gone')).toHaveAttribute('data-state', 'unavailable');
    const token = reviewUrl.split('/').pop();
    expect(
      await family.evaluate(
        async (t) =>
          (
            await fetch('/api/review/open', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ t }),
            })
          ).status,
        token,
      ),
    ).toBe(404);
    await family.context().close();
    // no "listen" for guests; the host's card has its switch off
    const slug = await publish(page, id);
    const guest = await page.context().newPage();
    await open(guest, `/i/${slug}?lang=he&open=1`);
    await expect(guest.locator('.inv')).toBeVisible();
    await expect(guest.getByTestId('listen')).toHaveCount(0);
    expect((await api(page, `/api/invitations/${id}/voice`)).body).toMatchObject({ ok: true, on: false });
  });
});

import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The cinematic editor (feature `cinematic`): a host adds a picture section, uploads its photo, taps
// its focal point, picks a layout and a motion, chooses an opening, takes the invitation's colors
// from a photo and publishes — and the guest's page shows all of it. On a desktop and on a phone
// (the mobile project), in Hebrew (the editor's default). Without the feature the controls are gone
// and the server refuses what they would add. QA_SHOTS=1 keeps screenshots in tests/.artifacts.

const SHOTS = process.env.QA_SHOTS ? 'tests/.artifacts/cinematic-editor' : null;

async function open(page: Page, url: string) {
  const res = await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return res;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    // template media and the gallery's previews aren't produced in the local stack
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function signUp(page: Page) {
  await open(page, '/signup');
  await page.fill(
    'input[name=email]',
    `cine-ed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
  );
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

/** Any valid document: sent against an old version, the answer is the stored draft (409). */
const PROBE = JSON.parse(readFileSync('docs/invitations/fixtures/example-wedding-he-en.json', 'utf8'));

/** The stored draft and its version. */
async function storedDraft(page: Page, id: string) {
  return page.evaluate(
    async ({ id, probe }) => {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft: probe, updatedAt: '2000-01-01T00:00:00.000Z' }),
      });
      return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    { id, probe: PROBE },
  );
}

/** A new wedding invitation (Hebrew + English) with its venue filled in, ready to publish. */
async function createInvitation(page: Page, templateId = 'sahar-bordeaux'): Promise<string> {
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
  const stored = await storedDraft(page, id);
  expect(stored.status, 'the stored draft').toBe(409);
  const status = await page.evaluate(
    async ({ id, draft, updatedAt }) => {
      const venues = draft.sections.find((s: { type: string }) => s.type === 'venues');
      venues.data.items[0].name = { he: 'אחוזת הגפן', en: 'Ahuzat HaGefen' };
      venues.data.items[0].address = {
        he: 'דרך הכרמים 12, זכרון יעקב',
        en: "12 Derech HaKramim, Zikhron Ya'akov",
      };
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft, updatedAt }),
      });
      return res.status;
    },
    { id, draft: stored.body.draft, updatedAt: stored.body.updatedAt },
  );
  expect(status, 'the venue is saved').toBe(200);
  return id;
}

const saved = (page: Page) =>
  expect(page.locator('[role=status]', { hasText: 'כל השינויים נשמרו' }).first()).toBeAttached({
    timeout: 20_000,
  });

/** A picture that has arrived (whatever the optimizer made of it, or the original). */
const loaded = (img: Locator) =>
  img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0 && !!el.currentSrc);

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  await page.screenshot({ path: `${SHOTS}/${phone ? 'phone' : 'desktop'}-${name}.png` });
}

test.describe('the cinematic editor', () => {
  test('a picture section, its focal point, layout and motion, an opening and colors from a photo — published', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const phone = (page.viewportSize()?.width ?? 0) < 1024;
    const errors = collectErrors(page);
    await signUp(page);
    const id = await createInvitation(page);
    await open(page, `/app/invitations/${id}/edit`);
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    await expect(frame.locator('h1.names')).toContainText('נועה', { timeout: 30_000 });
    const tabs = page.getByRole('navigation', { name: 'מצב העורך' });

    // ── add "text & picture" ──
    if (phone) {
      await tabs.getByRole('button', { name: 'עריכה' }).click();
      await page
        .getByRole('dialog', { name: 'כל הסקשנים' })
        .getByRole('button', { name: 'הוספת סקשן' })
        .click();
    } else {
      await page.getByRole('button', { name: 'הוספת סקשן' }).click();
    }
    await page.getByRole('button', { name: /^טקסט ותמונה/ }).click();
    await expect(page.getByRole('dialog', { name: 'כל הסקשנים' })).toBeHidden();
    const mediaCard = page.locator('[data-field-path$=".media"]').first();
    await expect(page.getByText('תמונה או וידאו', { exact: true })).toBeVisible();
    // without a picture the layouts that need one wait for it
    const layouts = page.getByRole('radiogroup', { name: 'פריסה' });
    await expect(layouts.getByRole('radio', { name: 'רקע מלא' })).toHaveAttribute('aria-disabled', 'true');

    // ── its photo, uploaded (with progress), then its focal point by tapping ──
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'העלאת תמונה או וידאו' }).click();
    await (
      await chooser
    ).setFiles({
      name: 'couple.jpg',
      mimeType: 'image/jpeg',
      buffer: readFileSync('tests/fixtures/media/cine-couple.jpg'),
    });
    const focal = page.getByTestId('focal-box');
    await expect(focal).toBeVisible({ timeout: 30_000 });
    await expect(focal.locator('img')).toHaveJSProperty('complete', true);
    const box = (await focal.boundingBox())!;
    await focal.click({ position: { x: box.width * 0.3, y: box.height * 0.7 } });
    await expect(mediaCard).toBeVisible();
    if (SHOTS) {
      await focal.scrollIntoViewIfNeeded();
      await shot(page, '0-media');
    }

    // ── full bleed, a zoom entrance, words ──
    await layouts.getByRole('radio', { name: 'רקע מלא' }).click();
    await expect(layouts.getByRole('radio', { name: 'רקע מלא' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radiogroup', { name: 'כניסה' }).getByRole('radio', { name: 'התקרבות' }).click();
    await page.getByRole('radiogroup', { name: 'חשיפת הטקסט' }).getByRole('radio', { name: 'מילים' }).click();
    await shot(page, '1-section');
    // the preview has it
    const previewed = frame.locator('.cine[data-layout="full_bleed"][data-enter="zoom"]');
    await expect(previewed).toHaveAttribute('data-tr', 'words', { timeout: 15_000 });
    await saved(page);
    if (SHOTS) {
      // its colors: a dark band
      await page
        .getByRole('radiogroup', { name: 'צבעי הרקע והטקסט' })
        .getByRole('radio', { name: 'רצועה כהה' })
        .click();
      await page.getByTestId('section-contrast').scrollIntoViewIfNeeded();
      await shot(page, '1b-colors');
      await page.keyboard.press('Control+z');
    }

    // ── the opening: a curtain ──
    const designPanel = async (name: string) => {
      if (phone) {
        await tabs.getByRole('button', { name: 'עיצוב' }).click();
        await page
          .getByRole('dialog', { name: 'כל הסקשנים' })
          .getByRole('button', { name, exact: true })
          .click();
      } else {
        await page.getByRole('tab', { name: 'עיצוב' }).click();
        await page.getByRole('button', { name, exact: true }).click();
      }
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    };
    await designPanel('מעטפה ופתיחה');
    const openings = page.getByRole('radiogroup', { name: 'פתיחה' });
    await openings.getByRole('radio', { name: 'מסך' }).click();
    await expect(openings.getByRole('radio', { name: 'מסך' })).toHaveAttribute('aria-checked', 'true');
    await shot(page, '2-opening');
    await saved(page);
    if (SHOTS) {
      await designPanel('סגנון ותנועה');
      await shot(page, '2b-style');
    }

    // ── the invitation's colors from a photo (read on the device, nothing uploaded) ──
    await designPanel('צבעים');
    await page.getByTestId('photo-palette-file').setInputFiles({
      name: 'sunset.jpg',
      mimeType: 'image/jpeg',
      buffer: readFileSync('tests/fixtures/media/cine-sunset.jpg'),
    });
    const options = page.getByTestId('photo-palette-options');
    // sahar-bordeaux lets the host change its background, text and accent (its cards stay light):
    // a light and a tinted option, no evening
    await expect(options.locator('[data-palette-option]')).toHaveCount(2);
    await expect(options.locator('[data-palette-option="dark"]')).toHaveCount(0);
    await expect(options.getByText('בעיצוב הזה אפשר לשנות רק', { exact: false })).toBeVisible();
    await shot(page, '3-palette');
    const tinted = options.getByRole('button', { name: 'החלת הצבעים: גוון' });
    const bg = await tinted.evaluate((el) => getComputedStyle(el).backgroundColor);
    await tinted.click();
    await expect(page.getByText('הצבעים הוחלו — ↶ מבטל', { exact: true })).toBeVisible();
    await saved(page);
    // the fonts that fit it
    await designPanel('גופנים');
    await expect(page.getByTestId('font-suggestions').locator('[data-font-pair]')).toHaveCount(3);
    await shot(page, '4-fonts');

    // ── publish ──
    if (phone) await tabs.getByRole('button', { name: 'פרסום' }).click();
    else await page.getByRole('button', { name: 'פרסום', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('הכל מוכן לפרסום')).toBeVisible();
    await dialog.getByRole('button', { name: 'פרסום', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
    const url = await dialog.getByRole('textbox').inputValue();

    // ── the guest: the curtain, then the section over its photo, in colors from the sunset ──
    const guest = await page.context().newPage();
    const guestErrors = collectErrors(guest);
    await open(guest, new URL(url).pathname);
    await expect(guest.locator('.cover[data-opening="curtain"]')).toBeVisible();
    await guest.locator('.cover-tap').click();
    await expect(guest.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    const section = guest.locator('.cine[data-layout="full_bleed"][data-enter="zoom"]');
    await expect(section).toHaveAttribute('data-tr', 'words');
    await section.scrollIntoViewIfNeeded();
    await expect.poll(() => loaded(section.locator('img.cine-img')), { timeout: 15_000 }).toBe(true);
    await expect(section.locator('.sec-title')).toHaveText('רגע משלנו');
    const [fx, fy] = await section.evaluate((el) => [
      parseFloat(el.style.getPropertyValue('--fx')),
      parseFloat(el.style.getPropertyValue('--fy')),
    ]);
    expect(Math.abs(fx! - 30), `focal x ${fx}`).toBeLessThanOrEqual(2);
    expect(Math.abs(fy! - 70), `focal y ${fy}`).toBeLessThanOrEqual(2);
    // the page's background is the tinted palette's
    const pageBg = await guest.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(pageBg).toBe(bg);
    // the countdown's numbers read left to right in Hebrew too
    const countdown = guest.locator('.cd-num').first();
    await countdown.scrollIntoViewIfNeeded();
    const order = await countdown.evaluate((el) => {
      const digits = [...el.querySelectorAll('.cd-d')].map((d) => ({
        ch: d.textContent ?? '',
        x: d.getBoundingClientRect().x,
      }));
      return {
        dom: digits.map((d) => d.ch).join(''),
        painted: [...digits]
          .sort((a, b) => a.x - b.x)
          .map((d) => d.ch)
          .join(''),
      };
    });
    expect(order.painted).toBe(order.dom);
    if (SHOTS) {
      await section.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await guest.waitForTimeout(1500);
      await shot(guest, '5-guest-section');
      // the editor in English: the section's cards and the design panels
      await page.context().addCookies([{ name: 'ui_lang', value: 'en', url: new URL(page.url()).origin }]);
      await open(page, `/app/invitations/${id}/edit`);
      const go = async (name: string, tab: 'Sections' | 'Design') => {
        if (phone) {
          await page
            .getByRole('navigation', { name: 'Editor mode' })
            .getByRole('button', { name: tab === 'Sections' ? 'Edit' : 'Design' })
            .click();
          await page
            .getByRole('dialog', { name: 'All sections' })
            .getByRole('button', { name, exact: true })
            .click();
        } else {
          await page.getByRole('tab', { name: tab }).click();
          await page.getByRole('button', { name, exact: true }).click();
        }
        await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
      };
      await go('A moment of ours', 'Sections');
      await page.getByRole('radiogroup', { name: 'Layout' }).scrollIntoViewIfNeeded();
      await shot(page, 'en-1-section');
      await page.getByRole('radiogroup', { name: 'Entrance' }).scrollIntoViewIfNeeded();
      await shot(page, 'en-1b-motion');
      await go('Envelope & opening', 'Design');
      await shot(page, 'en-2-opening');
      await go('Style & motion', 'Design');
      await shot(page, 'en-2b-style');
      await go('Fonts', 'Design');
      await shot(page, 'en-4-fonts');
    }
    expect(errors).toEqual([]);
    expect(guestErrors).toEqual([]);
  });
});

test.describe('without the cinematic feature', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'one run is enough');

  test('the controls are hidden and the server refuses what they would add', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await signUp(page);
    const id = await createInvitation(page);
    const off = await page.evaluate(async (id) => {
      const res = await fetch(`/api/invitations/${id}/features`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feature: 'cinematic', off: true }),
      });
      return res.status;
    }, id);
    expect(off).toBe(200);

    await open(page, `/app/invitations/${id}/edit`);
    const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
    await expect(frame.locator('h1.names')).toContainText('נועה', { timeout: 30_000 });
    // a section: its content, none of the picture / layout / motion / colors cards
    await page.getByRole('button', { name: 'הסיפור שלנו', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'הסיפור שלנו' })).toBeVisible();
    await expect(page.getByText('תמונה או וידאו', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'פריסה' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'כניסה' })).toHaveCount(0);
    await expect(page.getByText('צבעי הסקשן', { exact: true })).toHaveCount(0);
    // the new section types are still there — as text
    await page.getByRole('button', { name: 'הוספת סקשן' }).click();
    await page.getByRole('button', { name: /^ציטוט/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'ציטוט' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'כניסה' })).toHaveCount(0);
    // the design tab: no "style & motion", no opening picker; colors from a photo stay (plain colors)
    await page.getByRole('tab', { name: 'עיצוב' }).click();
    await expect(page.getByRole('button', { name: 'סגנון ותנועה', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'מעטפה ופתיחה', exact: true }).click();
    await expect(page.getByRole('radiogroup', { name: 'פתיחה' })).toHaveCount(0);
    await page.getByRole('button', { name: 'צבעים', exact: true }).click();
    await expect(page.getByText('צבעים מתמונה', { exact: true })).toBeVisible();
    await saved(page);

    // the server: a new layout / motion / opening is refused (403), naming what; the draft's own
    // content still saves
    const stored = await storedDraft(page, id);
    expect(stored.status).toBe(409);
    const refused = await page.evaluate(
      async ({ id, draft, updatedAt }) => {
        const story = draft.sections.findIndex((s: { id: string }) => s.id === 'story');
        const next = structuredClone(draft);
        next.sections[story].animation = { enter: { preset: 'zoom' } };
        next.cover.opening = 'gate';
        const res = await fetch(`/api/invitations/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draft: next, updatedAt }),
        });
        return { status: res.status, body: await res.json() };
      },
      { id, draft: stored.body.draft, updatedAt: stored.body.updatedAt },
    );
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'feature_off', feature: 'cinematic' });
    expect(refused.body.issues).toEqual(expect.arrayContaining(['cover.opening']));
    expect(errors).toEqual([]);
  });
});

test.describe('the photographic flagship (Lumière)', () => {
  test('unlisted: not in a host’s gallery; its demo opens in gold dust over its photo, a photo per part', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const phone = (page.viewportSize()?.width ?? 0) < 1024;
    const errors = collectErrors(page);
    if (!phone) {
      await signUp(page);
      await open(page, '/app/invitations/new');
      await expect(page.getByRole('heading', { name: 'בחרו עיצוב' })).toBeVisible();
      await expect(page.getByRole('button', { name: /סהר בורדו/ })).toHaveCount(1);
      await expect(page.getByRole('button', { name: /לומייר/ })).toHaveCount(0);
      // and the server won't make one for a host either
      const created = await page.evaluate(async () => {
        const res = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId: 'lumiere',
            eventType: 'wedding',
            locales: ['he'],
            defaultLocale: 'he',
            hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
            date: '2027-06-17',
            startTime: '19:30',
            timezone: 'Asia/Jerusalem',
          }),
        });
        return { status: res.status, body: await res.json() };
      });
      expect(created).toMatchObject({ status: 400, body: { issues: ['templateId'] } });
    }

    // its seeded demo (reachable by its link like every demo)
    await open(page, '/i/demo-lumiere/he');
    const cover = page.locator('.cover[data-opening="gold_dust"]');
    await expect(cover).toHaveAttribute('data-backdrop', '');
    await expect.poll(() => loaded(cover.locator('img.co-photo')), { timeout: 15_000 }).toBe(true);
    await shot(page, '6-lumiere-cover');
    await page.locator('.cover-tap').click();
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    const pictures: string[] = [];
    for (const [id, layout] of [
      ['quote', 'full_bleed'],
      ['story', 'split_start'],
      ['venues', 'parallax'],
      ['rsvp', 'full_bleed'],
    ] as const) {
      const section = page.locator(`.cine[data-section="${id}"]`);
      await expect(section, id).toHaveAttribute('data-layout', layout);
      await section.scrollIntoViewIfNeeded();
      const img = section.locator('img.cine-img').first();
      await expect.poll(() => loaded(img), { timeout: 15_000 }).toBe(true);
      pictures.push(
        await img.evaluate(
          (el: HTMLImageElement) => new URL(el.currentSrc).searchParams.get('url') ?? el.currentSrc,
        ),
      );
    }
    // a different photo for every part
    expect(new Set(pictures).size).toBe(pictures.length);
    // the date is a dark band of its own
    await expect(page.locator('.cine[data-section="when"]')).toHaveAttribute('data-theme', 'dark');
    await page.locator('.cine[data-section="rsvp"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(1500);
    await shot(page, '7-lumiere-rsvp');
    expect(errors).toEqual([]);
  });
});

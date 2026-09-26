import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The cinematic template engine (invitation schema v2): each section's media and layout, the
// scroll-driven motion and the cinematic openings — on a phone and a desktop, in Hebrew and English,
// with reduced motion, without the `cinematic` feature, and from a host's saved draft to the guest's
// page. The showcase document (features/invitations/dev/cinematic-demo.ts) has every layout: a
// full-bleed quote, the story split (its picture at the start), the parents split the other way, a
// parallax venue, a dance floor over a video, candles in the flow and a full-bleed footer.

const showcase = (lang: 'he' | 'en', query = '') =>
  `/dev/invitations/render/sahar-bordeaux/${lang}/cinematic${query ? `?${query}` : ''}`;

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

const LAYOUTS = ['full_bleed', 'split_start', 'split_end', 'parallax', 'video_bg', 'stack'] as const;

/** A picture that has arrived (whatever the optimizer made of it, or the original). */
const loaded = (img: Locator) =>
  img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0 && !!el.currentSrc);

/** Scrolls the page by a share of the screen and lets a frame pass. */
const scrollBy = (page: Page, share: number) =>
  page.evaluate(async (s) => {
    window.scrollBy(0, Math.round(window.innerHeight * s));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, share);

/** Where a section's background sits inside it (moves with the parallax). */
const layerOffset = (section: Locator) =>
  section.evaluate(
    (el) => el.querySelector('.cine-layer')!.getBoundingClientRect().top - el.getBoundingClientRect().top,
  );

for (const lang of ['he', 'en'] as const) {
  test(`every layout shows its picture and its text, and the text reads (${lang})`, async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, showcase(lang, 'open=1'));
    for (const layout of LAYOUTS) {
      // (a section with motion only is a `stack` too: the one with a picture)
      const section = page.locator(`.cine[data-layout="${layout}"]:has(img.cine-img)`).first();
      await section.scrollIntoViewIfNeeded();
      await expect(section, layout).toBeVisible();
      // its picture (a video's still)
      await expect
        .poll(() => loaded(section.locator('img.cine-img').first()), { timeout: 15_000 })
        .toBe(true);
      // its heading comes in (scrubbed by the scroll: once it is well on screen) and stays whole —
      // the letters / words / lines played over the real text
      const heading = section.locator('.q-text, .sec-title').first();
      await heading.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect
        .poll(() => heading.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10_000 })
        .toBe('1');
      await expect(section.locator('.tr-fx')).toHaveCount(0, { timeout: 10_000 });
      expect((await heading.textContent())?.trim().length, layout).toBeGreaterThan(0);
    }
    // the section's own colors: the night band of "when"
    const when = page.locator('.cine[data-section="when"]');
    await expect(when).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
  });
}

test('the end of the page: the last blocks come in although there is no scroll left to drive them', async ({
  page,
}) => {
  const errors = collectErrors(page);
  // every section of the template's demo with an entrance: the footer's end at the page's end
  await open(page, '/dev/invitations/render/sahar-bordeaux/he/demo?open=1&motion=rise');
  await expect(page.locator('.cine[data-enter="rise"]').first()).toBeAttached();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('.cine .reveal[data-en-time]').first()).toBeAttached();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll('.cine[data-enter] .reveal')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > 0 && r.top < window.innerHeight && r.height > 0;
            })
            .filter((el) => getComputedStyle(el).opacity !== '1')
            .map((el) => `${el.getAttribute('class')}: ${getComputedStyle(el).opacity}`),
        ),
      { timeout: 8000 },
    )
    .toEqual([]);
  expect(errors).toEqual([]);
});

test('split layouts follow the reading direction: the picture at the start, or at the end', async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) < 900, 'side by side on wide screens; stacked on a phone');
  for (const lang of ['he', 'en'] as const) {
    await open(page, showcase(lang, 'open=1'));
    for (const layout of ['split_start', 'split_end'] as const) {
      const section = page.locator(`.cine[data-layout="${layout}"]`).first();
      await section.scrollIntoViewIfNeeded();
      const figure = (await section.locator('.cine-figure').boundingBox())!;
      const body = (await section.locator('.cine-body').boundingBox())!;
      const pictureOnRight = figure.x > body.x;
      // Hebrew starts on the right
      expect(pictureOnRight, `${lang} ${layout}`).toBe((lang === 'he') === (layout === 'split_start'));
      // side by side, not stacked
      expect(Math.abs(figure.y - body.y)).toBeLessThan(figure.height);
    }
  }
});

test('the scroll moves the pictures: parallax and Ken Burns', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, showcase('he', 'open=1'));
  // the venue: its background drifts slower than the page
  const venue = page.locator('.cine[data-layout="parallax"]').first();
  await venue.scrollIntoViewIfNeeded();
  await scrollBy(page, -0.45);
  const before = await layerOffset(venue);
  await scrollBy(page, 0.5);
  await expect.poll(async () => Math.abs((await layerOffset(venue)) - before)).toBeGreaterThan(4);

  // the candles: the picture zooms in slowly
  const candles = page.locator('.cine[data-section="candles"]');
  await candles.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      candles
        .locator('img.cine-img')
        .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a),
    )
    .toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('the video background plays muted near the screen and pauses away from it', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, showcase('en', 'open=1'));
  const video = page.locator('.cine[data-layout="video_bg"] video.cine-video');
  // nothing loads with the page
  await expect(video).not.toHaveAttribute('src', /./);
  await expect(video).toHaveAttribute('preload', 'none');
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute('src', /cine-loop\.webm$/);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.muted && v.loop)).toBe(true);
  await expect(video).toHaveAttribute('data-playing', '');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  expect(errors).toEqual([]);
});

test('reduced motion: everything in place and still, the video stays a picture', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = collectErrors(page);
  await open(page, showcase('he', 'open=1'));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(400);
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll('.cine .reveal, .cine-layer, .cine-img, .cine-video')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        // a video that never plays stays transparent over its still
        const shown = el.classList.contains('cine-video') || cs.opacity === '1';
        return !shown || cs.transform !== 'none';
      })
      .map((el) => `${el.className}: ${getComputedStyle(el).opacity} ${getComputedStyle(el).transform}`),
  );
  expect(moving).toEqual([]);
  await expect(page.locator('.tr-fx')).toHaveCount(0);
  await expect(page.locator('video.cine-video')).not.toHaveAttribute('src', /./);
  await expect.poll(() => loaded(page.locator('.cine[data-layout="video_bg"] img.cine-img'))).toBe(true);
  expect(errors).toEqual([]);
});

test('the language switch keeps the cinematic sections', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, showcase('he', 'open=1'));
  const count = await page.locator('.cine').count();
  expect(count).toBeGreaterThan(8);
  await page.locator('.cine[data-section="where"]').scrollIntoViewIfNeeded();
  await page.locator('.fab-lang').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.cine')).toHaveCount(count);
  const title = page.locator('.cine[data-section="where"] .sec-title');
  await expect(title).toHaveText(/[A-Za-z]/);
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await expect.poll(() => loaded(page.locator('.cine[data-section="where"] img.cine-img'))).toBe(true);
  // and back
  await page.locator('.fab-lang').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('.cine')).toHaveCount(count);
  expect(errors).toEqual([]);
});

test.describe('the cinematic openings', () => {
  for (const opening of ['gate', 'curtain', 'fireworks', 'gold_dust'] as const) {
    test(`${opening}: the monogram, a tap, and the invitation`, async ({ page }) => {
      const errors = collectErrors(page);
      await open(page, showcase('he', `opening=${opening}`));
      const cover = page.locator(`.cover[data-opening="${opening}"]`);
      await expect(cover).toBeVisible();
      await expect(cover.locator('.co-mono').first()).toHaveText(/\S/);
      await expect(page.locator('body')).toHaveClass(/locked/);
      if (opening === 'gate' || opening === 'curtain')
        await expect(cover.locator('.co-scroll')).toContainText('גללו להיכנס');
      await page.locator('.cover-tap').click();
      await expect(page.locator('html')).toHaveAttribute('data-opened', '1', { timeout: 10_000 });
      await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('body')).not.toHaveClass(/locked/);
      await expect(page.locator('.hero')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  for (const opening of ['gate', 'curtain'] as const) {
    test(`${opening}: opens by scrolling — a swipe on a phone, the wheel or a key on a desktop`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await open(page, showcase('en', `opening=${opening}`));
      const cover = page.locator(`.cover[data-opening="${opening}"]`);
      await expect(cover).toBeVisible();
      await expect(cover.locator('.co-scroll')).toContainText('Scroll to enter');
      const { width, height } = page.viewportSize()!;
      const peek = () =>
        cover.evaluate((el: HTMLElement) => Number(el.style.getPropertyValue('--co-peek') || 0));
      if (width < 900) {
        // a finger swipes up: the doors / the curtain follow, and open when it lifts
        const cdp = await page.context().newCDPSession(page);
        const x = Math.round(width / 2);
        const y = Math.round(height * 0.7);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++)
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y - i * 28 }],
          });
        expect(await peek()).toBeGreaterThan(0.5);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(width / 2, height / 2);
        await page.mouse.wheel(0, 120);
        await expect.poll(peek).toBeGreaterThan(0);
        await page.mouse.wheel(0, 120);
        await page.mouse.wheel(0, 120);
      }
      await expect(page.locator('html')).toHaveAttribute('data-opened', '1', { timeout: 10_000 });
      await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
      expect(errors).toEqual([]);
    });
  }

  test('the keyboard: the arrow down opens the gate', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'a desktop keyboard');
    await open(page, showcase('he', 'opening=gate'));
    await expect(page.locator('.cover[data-opening="gate"]')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
  });

  test('reduced motion: a short fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const opening of ['gate', 'fireworks'] as const) {
      await open(page, showcase('he', `opening=${opening}`));
      await expect(page.locator(`.cover[data-opening="${opening}"]`)).toBeVisible();
      const started = Date.now();
      await page.locator('.cover-tap').click();
      await expect(page.locator('.cover')).toHaveCount(0, { timeout: 3000 });
      expect(Date.now() - started).toBeLessThan(2500);
      await expect(page.locator('canvas.fx-sparks')).toHaveCount(0);
    }
  });
});

test('without the feature: the plain invitation — its text, no pictures, the classic cover', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await open(page, showcase('en', 'cinematic=0&opening=curtain'));
  const cover = page.locator('.cover');
  await expect(cover).toBeVisible();
  await expect(cover).not.toHaveAttribute('data-opening', /./);
  await page.locator('.cover-tap').click();
  await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('.cine')).toHaveCount(0);
  await expect(page.locator('img[src*="cine-"], img[srcset*="cine-"], video')).toHaveCount(0);
  // the new sections still read
  await expect(page.getByText('I have found the one whom my soul loves')).toBeAttached();
  await expect(page.getByText('Dance till dawn')).toBeAttached();
  expect(errors).toEqual([]);
});

test.describe('from the host’s draft to the guest’s page', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'one run is enough');

  test('a v2 draft is saved and published; without the feature the guest gets the plain page', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await open(page, '/signup');
    await page.fill(
      'input[name=email]',
      `cine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    );
    await page.fill('input[name=password]', 'a-good-password');
    await page.click('form:has(input[name=password]) button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);

    const photo = readFileSync('tests/fixtures/media/cine-couple.jpg').toString('base64');
    // any valid document (a v1 one: the server takes both) against an old version: the answer is the
    // stored draft and its version
    const probe = JSON.parse(readFileSync('docs/invitations/fixtures/example-wedding-he-en.json', 'utf8'));
    const result = await page.evaluate(
      async ({ photoBase64, probe }) => {
        const json = async (url: string, method: string, body: unknown) => {
          const res = await fetch(url, {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
        };
        const created = await json('/api/invitations', 'POST', {
          templateId: 'sahar-bordeaux',
          eventType: 'wedding',
          locales: ['he'],
          defaultLocale: 'he',
          hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
          date: '2027-06-17',
          startTime: '19:30',
          timezone: 'Asia/Jerusalem',
        });
        const id = created.body.id as string;
        const current = await json(`/api/invitations/${id}`, 'PATCH', {
          draft: probe,
          updatedAt: '2000-01-01T00:00:00.000Z',
        });
        if (current.status !== 409) return { step: 'read', ...current };
        const draft = current.body.draft;
        // the host's photo
        const bytes = Uint8Array.from(atob(photoBase64), (c) => c.charCodeAt(0));
        const ticket = await json(`/api/invitations/${id}/uploads`, 'POST', {
          contentType: 'image/jpeg',
          size: bytes.length,
        });
        const put = await fetch(ticket.body.url, {
          method: 'PUT',
          headers: { 'content-type': 'image/jpeg', 'x-upsert': 'false' },
          body: bytes,
        });
        if (!put.ok) return { step: 'upload', status: put.status, body: {} };
        // v2: a full-bleed quote over the photo, and a curtain to open with
        const venues = draft.sections.find((s: { type: string }) => s.type === 'venues');
        venues.data.items[0].name = { he: 'אחוזת הגפן' };
        venues.data.items[0].address = { he: 'דרך הכרמים 12, זכרון יעקב' };
        const footer = draft.sections.findIndex((s: { type: string }) => s.type === 'footer');
        draft.sections.splice(footer, 0, {
          id: 'quote-e2e',
          type: 'quote',
          enabled: true,
          layout: 'full_bleed',
          media: {
            kind: 'image',
            src: ticket.body.ref,
            poster: null,
            focalPoint: { x: 0.5, y: 0.4 },
            overlay: 0.4,
          },
          animation: { enter: { preset: 'rise' }, text: 'words' },
          data: { text: { he: 'אני לדודי ודודי לי' }, attribution: { he: 'שיר השירים' } },
        });
        draft.cover.opening = 'curtain';
        const saved = await json(`/api/invitations/${id}`, 'PATCH', {
          draft,
          updatedAt: current.body.updatedAt,
        });
        if (saved.status !== 200) return { step: 'save', ...saved };
        const published = await json(`/api/invitations/${id}/publish`, 'POST', {});
        if (published.status !== 200) return { step: 'publish', ...published };
        return { step: 'done', status: 200, body: { id, slug: published.body.slug } };
      },
      { photoBase64: photo, probe },
    );
    expect(result, JSON.stringify(result.body).slice(0, 600)).toMatchObject({ step: 'done' });
    const { id, slug } = result.body as { id: string; slug: string };

    // the guest: the curtain, then the quote over the photo
    await open(page, `/i/${slug}/he`);
    await expect(page.locator('.cover[data-opening="curtain"]')).toBeVisible();
    await page.locator('.cover-tap').click();
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    const quote = page.locator('.cine[data-section="quote-e2e"]');
    await expect(quote).toHaveAttribute('data-layout', 'full_bleed');
    await quote.scrollIntoViewIfNeeded();
    await expect.poll(() => loaded(quote.locator('img.cine-img'))).toBe(true);
    await expect(quote.locator('.q-text')).toHaveText('אני לדודי ודודי לי');

    // the host switches the feature off; the next publish refreshes the page
    const off = await page.evaluate(async (invitationId) => {
      const patch = await fetch(`/api/invitations/${invitationId}/features`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feature: 'cinematic', off: true }),
      });
      const again = await fetch(`/api/invitations/${invitationId}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      return [patch.status, again.status];
    }, id);
    expect(off).toEqual([200, 200]);
    await open(page, `/i/${slug}/he`);
    await expect(page.locator('.cover')).toBeVisible();
    await expect(page.locator('.cover')).not.toHaveAttribute('data-opening', /./);
    await page.locator('.cover-tap').click();
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('.cine')).toHaveCount(0);
    await expect(page.locator('.qt .q-text')).toHaveText('אני לדודי ודודי לי');
    expect(errors).toEqual([]);
  });
});

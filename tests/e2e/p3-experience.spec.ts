import { expect, test, type Page } from '@playwright/test';

// P3 done-when: "Opening works on iOS Safari + Android Chrome + WhatsApp in-app browser" — the
// automated part: the video-first cover (and its fallbacks), music started by the tap, the live
// language switch, the lazy map, the link-preview image and the share screen. Real devices are in
// the phase report's manual checklist.

const SINK = '/dev/invitations/render/sahar-bordeaux/he/wedding-he-en';

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

const paused = (page: Page) => page.locator('audio').evaluate((a: HTMLAudioElement) => a.paused);

test.describe('the opening', () => {
  test('video cover: the tap opens it and starts the music; nothing plays before', async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, `${SINK}?cover=fixture&music=fixture`);
    const cover = page.locator('.cover.cover-video');
    await expect(cover).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/locked/);
    expect(await paused(page)).toBe(true);

    await page.locator('.cover-tap').click();
    await expect(page.locator('html')).toHaveAttribute('data-opened', '1', { timeout: 10_000 });
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('body')).not.toHaveClass(/locked/);
    await expect.poll(() => paused(page)).toBe(false);

    const music = page.locator('.fab-music');
    await expect(music).toHaveAttribute('aria-pressed', 'true');
    await expect(music).toHaveAttribute('aria-label', 'השתקת מוזיקה');
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'false');
    expect(await paused(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a video that never loads still opens', async ({ page }) => {
    await open(page, `${SINK}?cover=stall`);
    await page.locator('.cover-tap').click();
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('body')).not.toHaveClass(/locked/);
  });

  test('reduced motion: a short fade instead of the video', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, `${SINK}?cover=fixture`);
    const started = Date.now();
    await page.locator('.cover-tap').click();
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 3000 });
    expect(Date.now() - started).toBeLessThan(2500);
  });

  test('without media the CSS 3D cover opens', async ({ page }) => {
    await open(page, SINK);
    await expect(page.locator('.cover')).toBeVisible();
    await expect(page.locator('.cover-video')).toHaveCount(0);
    await page.locator('.cover-tap').click();
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 8000 });
  });

  test('music: a host’s MP3 starts at their second and fades in to their volume', async ({ page }) => {
    await open(page, `${SINK}?music=mp3&musicStart=5`);
    const audio = page.locator('audio');
    await expect(audio).toHaveAttribute('src', /\/music\.mp3#t=5$/);
    await page.locator('.cover-tap').click();
    await expect.poll(() => paused(page)).toBe(false);
    expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThanOrEqual(5);
    await expect
      .poll(() => audio.evaluate((a: HTMLAudioElement) => a.volume), { timeout: 5000 })
      .toBeCloseTo(0.6, 2);
    await expect(page.locator('.fab-music')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a tap on the cover before the scripts have loaded still opens it and starts the music', async ({
    page,
  }) => {
    // slow connection: the cover (HTML) is on screen well before React takes over
    await page.route('**/_next/static/**/*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await page.goto(`${SINK}?music=mp3&musicStart=5`, { waitUntil: 'commit' });
    await page.locator('.cover-tap').click();
    expect(await page.evaluate(() => document.documentElement.dataset.coverReady ?? null)).toBeNull();
    // the music starts inside that tap (iOS allows it only there)…
    await expect.poll(() => paused(page)).toBe(false);
    // …and the cover opens as soon as React is ready — no second tap
    await expect(page.locator('html')).toHaveAttribute('data-opened', '1', { timeout: 20_000 });
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('.fab-music')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(5);
  });

  test('a browser that won’t start the music by itself: the button calls for the tap that plays it', async ({
    page,
  }) => {
    // like iOS: audio starts only inside a tap (the task of a trusted click)
    await page.addInitScript(() => {
      let tapping = false;
      window.addEventListener(
        'click',
        (e) => {
          if (!e.isTrusted) return;
          tapping = true;
          window.setTimeout(() => (tapping = false));
        },
        true,
      );
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        return tapping ? play.call(this) : Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      };
    });
    await open(page, `${SINK}?open=1&music=mp3&musicStart=5`);
    // an opening outside a tap
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('invitation:open')));
    const music = page.locator('.fab-music');
    await expect(music).toHaveAttribute('data-blocked', '');
    await expect(music).toHaveAttribute('aria-pressed', 'false');
    await music.click();
    await expect.poll(() => paused(page)).toBe(false);
    await expect(music).not.toHaveAttribute('data-blocked');
    await expect(music).toHaveAttribute('aria-pressed', 'true');
  });

  test('music: paused while the page is hidden, back when it returns; no autoplay on a skipped cover', async ({
    page,
  }) => {
    await open(page, `${SINK}?open=1&music=fixture`);
    await page.waitForTimeout(500);
    expect(await paused(page)).toBe(true);
    await page.locator('.fab-music').click();
    await expect.poll(() => paused(page)).toBe(false);
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await setHidden(true);
    await expect.poll(() => paused(page)).toBe(true);
    await setHidden(false);
    await expect.poll(() => paused(page)).toBe(false);
  });
});

test.describe('hero video', () => {
  test('an uploaded video autoplays muted (the attribute too, for iOS), over its still', async ({ page }) => {
    await open(page, `${SINK}?open=1&hero=video`);
    const video = page.locator('.hero-media video');
    await expect(video).toHaveAttribute('muted', '');
    await expect(video).toHaveAttribute('poster', '/dev/media/cover-poster.png');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.muted)).toBe(true);
  });

  test('“video sound”: the cover’s tap turns the video’s sound on; the button mutes it again', async ({
    page,
  }) => {
    await open(page, `${SINK}?hero=video&videoSound=1`);
    await expect(page.locator('audio')).toHaveCount(0);
    const video = page.locator('.hero-media video');
    await page.locator('.cover-tap').click();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.muted && !v.paused)).toBe(true);
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.volume), { timeout: 5000 })
      .toBeCloseTo(0.6, 2);
    const music = page.locator('.fab-music');
    await expect(music).toHaveAttribute('aria-pressed', 'true');
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'false');
    // the picture keeps playing
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted && !v.paused)).toBe(true);
    await music.click();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  });

  test('a YouTube link: the muted, looping player without controls, over its still', async ({ page }) => {
    await open(page, `${SINK}?open=1&hero=youtube`);
    const embed = page.locator('.hero-embed');
    await expect(embed.locator('img.hero-still')).toHaveAttribute(
      'src',
      /^https:\/\/i\.ytimg\.com\/vi\/dQw4w9WgXcQ\//,
    );
    const iframe = embed.locator('iframe');
    const url = new URL((await iframe.getAttribute('src'))!);
    expect(url.origin + url.pathname).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      autoplay: '1',
      mute: '1',
      loop: '1',
      controls: '0',
      playsinline: '1',
      cc_load_policy: '0', // subtitles off by default
    });
    // taps go to the page, and it only shows once it plays (the still until then)
    await expect(iframe).toHaveCSS('pointer-events', 'none');
    await expect(iframe).toHaveCSS('opacity', '0');
  });
});

test.describe('bilingual invitation', () => {
  test('the pill switches language in place: no reload, same place, ?lang=, RSVP kept', async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, '/i/noa-and-itay?open=1');
    await page.evaluate(() => Object.assign(window, { __sameDocument: true }));

    // something typed in the RSVP form survives the switch
    await page.locator('#rsvp .choice label').first().click();
    await page.getByLabel('שם פרטי').first().fill('נועה');

    // the guest is reading the venue
    const venue = page.locator('.v-name').first();
    await venue.evaluate((el) =>
      window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 200, behavior: 'instant' }),
    );
    await page.waitForTimeout(400);
    const topBefore = await venue.evaluate((el) => el.getBoundingClientRect().top);

    await page.locator('.fab-lang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page).toHaveURL(/\/i\/noa-and-itay\?(.*&)?lang=en/);
    await expect(page).toHaveTitle('Noa & Itay are getting married');
    await expect(venue).toHaveText('Ahuzat HaGefen');
    expect(await page.evaluate(() => (window as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
    const topAfter = await venue.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(topAfter - topBefore)).toBeLessThan(120);
    // what is on screen shows at once (no reveal waiting for a scroll)
    await expect(venue).toHaveClass(/\bin\b/);
    await expect(page.getByLabel('First name').first()).toHaveValue('נועה');
    await expect(page.locator('.fab-lang')).toHaveText('עברית');

    await page.locator('.fab-lang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page).toHaveURL(/lang=he/);
    await expect(venue).toHaveText('אחוזת הגפן');
    await expect(page.getByLabel('שם פרטי').first()).toHaveValue('נועה');
    expect(errors).toEqual([]);
  });

  test('the venue map loads only once it is near the screen', async ({ page }) => {
    await page.route(/google\.com\/maps/, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>map</p>' }),
    );
    await open(page, '/i/noa-and-itay?open=1');
    await expect(page.locator('.map')).toHaveCount(1);
    await expect(page.locator('.map iframe')).toHaveCount(0);
    await expect(page.locator('.map')).toHaveAttribute('role', 'img');
    await page.locator('.map').scrollIntoViewIfNeeded();
    const iframe = page.locator('.map iframe');
    await expect(iframe).toHaveAttribute('src', /google\.com\/maps\?q=.*&hl=he&.*output=embed/);
    await expect(iframe).toHaveAttribute('title', 'מפה: אחוזת הגפן');
  });

  test('link preview: og:image points at a 1200×630 PNG', async ({ page, request }) => {
    await open(page, '/i/noa-and-itay');
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toMatch(/\/i\/noa-and-itay\/opengraph-image\?lang=he&v=[0-9a-f]{10}$/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    for (const lang of ['he', 'en']) {
      const res = await request.get(`/i/noa-and-itay/opengraph-image?lang=${lang}`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
      expect(res.headers()['cache-control']).toContain('s-maxage=');
      const png = await res.body();
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    }
    expect((await request.get('/i/no-such-invitation/opengraph-image')).status()).toBe(404);
  });
});

test.describe('share screen', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'publishing runs in the desktop editor');

  test('publish → share: link, message, WhatsApp, preview, QR', async ({ page, context }) => {
    test.setTimeout(150_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = collectErrors(page);
    await open(page, '/signup');
    await page.fill(
      'input[name=email]',
      `share-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    );
    await page.fill('input[name=password]', 'a-good-password');
    await page.click('form:has(input[name=password]) button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);
    const { id } = await page.evaluate(async () => {
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

    // not published yet
    await open(page, `/app/invitations/${id}/share`);
    await expect(page.getByRole('heading', { level: 1, name: 'ההזמנה עוד לא פורסמה' })).toBeVisible();
    await page.getByRole('link', { name: 'לעורך' }).click();

    // fill in the venue and publish
    await page.waitForURL(/\/edit$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'פרסום', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /שם המקום/ }).click();
    await page.getByRole('textbox', { name: 'שם המקום' }).fill('אחוזת הגפן');
    await page.getByRole('textbox', { name: 'כתובת', exact: true }).fill('דרך הכרמים 12, זכרון יעקב');
    await expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'פרסום', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'פרסום', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'ההזמנה באוויר!' })).toBeVisible({ timeout: 20_000 });
    const url = await dialog.getByRole('textbox').inputValue();
    await dialog.getByRole('link', { name: 'QR והודעה מוכנה' }).click();

    // the share screen
    await page.waitForURL(/\/share$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await expect(page.getByRole('heading', { level: 1, name: 'ההזמנה באוויר 🎉' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'קישור להזמנה' })).toHaveValue(url);
    const message = page.getByRole('textbox', { name: 'הודעה לשליחה' });
    await expect(message).toHaveValue(new RegExp(`^היי! 💌\\nנועה & איתי\\n.*2027\\n.*\\n${url}$`));

    await page.getByRole('button', { name: 'העתקה', exact: true }).click();
    await expect(page.getByText('הקישור הועתק')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

    await message.fill(`מחכים לכם!\n${url}`);
    const whatsapp = page.getByRole('link', { name: 'שליחה בוואטסאפ' });
    await expect(whatsapp).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(`מחכים לכם!\n${url}`)}`,
    );
    await page.getByRole('button', { name: 'העתקת ההודעה' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`מחכים לכם!\n${url}`);

    // WhatsApp preview: the real OG image of the published invitation
    const preview = page.getByRole('img', { name: 'תמונת התצוגה המקדימה של הקישור' });
    await expect(preview).toHaveAttribute('src', /\/opengraph-image\?lang=he&v=[0-9a-f]{10}$/);
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBe(1200);

    // QR: inline SVG + downloads
    await expect(page.getByRole('img', { name: 'קוד QR של קישור ההזמנה' }).locator('svg')).toBeVisible();
    const png = page.getByRole('link', { name: 'הורדת קוד ה-QR כתמונת PNG' });
    await expect(png).toHaveAttribute('href', /^data:image\/png;base64,/);
    await expect(png).toHaveAttribute('download', /-qr\.png$/);
    const svg = page.getByRole('link', { name: 'הורדת קוד ה-QR כקובץ SVG' });
    await expect(svg).toHaveAttribute('href', /^data:image\/svg\+xml/);

    // the list menu leads here too
    await open(page, '/app/invitations');
    await page.getByRole('button', { name: 'אפשרויות נוספות' }).first().click();
    await expect(page.getByRole('menuitem', { name: 'שיתוף' })).toHaveAttribute(
      'href',
      `/app/invitations/${id}/share`,
    );
    expect(errors).toEqual([]);
  });
});

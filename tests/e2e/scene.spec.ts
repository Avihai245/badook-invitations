import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The scroll scene (renderer/scene): the invitation as one film. The design made as one ("celestial":
// a wax-sealed gatefold, then a gate among the clouds → up above them → down to the venue) and any
// design turned into one in the editor. On a phone the page scrolls; on a computer the invitation is a
// phone frame that scrolls itself. With reduced motion only the pictures' cross-fade remains.

const demo = (template: string, query = '') =>
  `/dev/invitations/render/${template}/he/demo${query ? `?${query}` : ''}`;

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

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 600;

/** Scrolls what scrolls the scene — the page on a phone, the frame on a computer — to `y`. */
const scrollTo = (page: Page, y: number) =>
  page.evaluate(async (y) => {
    const frame = document.querySelector<HTMLElement>('.sc-scroll')!;
    const o = getComputedStyle(frame).overflowY;
    const el = o !== 'visible' && o !== 'clip' ? frame : document.scrollingElement!;
    (el as HTMLElement).style.scrollBehavior = 'auto';
    el.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, y);

/** A section's top in the scene's own coordinates, and the screen's (or the frame's) height. */
const geometry = (page: Page, type: string) =>
  page.evaluate((type) => {
    const track = document.querySelector('.sc-track')!.getBoundingClientRect().top;
    const sec = document.querySelector(`.sc-sec[data-type="${type}"]`)!.getBoundingClientRect().top;
    const frame = document.querySelector<HTMLElement>('.sc-scroll')!;
    const o = getComputedStyle(frame).overflowY;
    const height = o !== 'visible' && o !== 'clip' ? frame.clientHeight : window.innerHeight;
    return { top: sec - track, height };
  }, type);

const layerOpacity = (page: Page, i: number) =>
  page.locator(`.sc-layer[data-i="${i}"]`).evaluate((el) => Number(getComputedStyle(el).opacity));

test('the gate: embossed paper sealed with wax — the seal breaks, the halves open, the film begins', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await open(page, demo('celestial'));
  const cover = page.locator('.cover.co[data-opening="gatefold"]');
  await expect(cover).toBeVisible();
  await expect(cover.locator('.co-seal')).toBeVisible();
  await expect(cover.locator('.co-leaf')).toHaveCount(2);
  // everything under the cover waits for it
  await expect(page.locator('.sc-frame')).toHaveJSProperty('inert', true);
  const tap = page.getByRole('button', { name: 'הקישו לפתיחה' });
  await tap.click();
  await expect(cover).toHaveClass(/opening/);
  // ~1.2 s: the seal, the halves, then the invitation
  await expect(page.locator('html')).toHaveAttribute('data-opened', '1', { timeout: 2_500 });
  await expect(cover).toBeHidden({ timeout: 3_000 });
  await expect(page.locator('.sc-frame')).toHaveJSProperty('inert', false);
  await expect(page.locator('.hero h1.names')).toContainText('נועה');
  expect(errors).toEqual([]);
});

test('the backdrop stays pinned and cross-fades from picture to picture as the sections pass', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await open(page, demo('celestial', 'open=1'));
  await expect(page.locator('.sc-layer')).toHaveCount(8);
  // the first picture only is loaded with the page, preloaded; the others wait
  await expect(page.locator('.sc-layer[data-i="0"] img')).toHaveJSProperty('complete', true, {
    timeout: 15_000,
  });
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveCount(1);
  expect(await page.locator('.sc-layer[data-i="7"] img').getAttribute('src')).toBeNull();
  expect(await layerOpacity(page, 1)).toBe(0);
  // the browser plays it from the scroll itself (scroll-driven animations): the driver only measured
  await expect(page.locator('.sc-frame')).toHaveAttribute('data-scene-css', '');
  const names = page.locator('.hero .hero-inner');
  expect(await names.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);

  // the intro's top crossing the middle of the screen: its picture comes in over the gate…
  const intro = await geometry(page, 'custom');
  await scrollTo(page, intro.top - intro.height * 0.5);
  await expect.poll(() => layerOpacity(page, 1)).toBeGreaterThan(0.2);
  expect(await layerOpacity(page, 1)).toBeLessThan(0.8);
  // …while the names lift away
  expect(await names.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.9);
  await scrollTo(page, intro.top - intro.height * 0.3);
  await expect.poll(() => layerOpacity(page, 1)).toBe(1);
  // …the backdrop is still where it was: pinned, the texts scroll over it
  const pinned = await page.evaluate(() => {
    const back = document.querySelector('.sc-back')!.getBoundingClientRect();
    const frame = document.querySelector('.sc-frame')!.getBoundingClientRect();
    return Math.round(back.top - Math.max(0, frame.top));
  });
  expect(Math.abs(pinned)).toBeLessThanOrEqual(1);

  // down to the garden: the pictures on the way have loaded, and each one zooms in slowly
  const rsvp = await geometry(page, 'rsvp');
  await scrollTo(page, rsvp.top - rsvp.height * 0.2);
  await expect.poll(() => layerOpacity(page, 6)).toBe(1);
  await expect(page.locator('.sc-layer[data-i="6"] img')).toHaveJSProperty('complete', true, {
    timeout: 15_000,
  });
  const scale = await page
    .locator('.sc-layer[data-i="6"] .sc-pic')
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(scale).toBeGreaterThan(1);
  expect(scale).toBeLessThanOrEqual(1.21);
  // pictures fully covered by the one above them are out of the way
  await expect(page.locator('.sc-layer[data-i="1"]')).toHaveCSS('visibility', 'hidden');
  // the particles drift over it all (one canvas)
  await expect(page.locator('canvas.sc-dust')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('where the browser can’t play the scroll itself, the driver plays the same film', async ({ page }) => {
  // (no scroll-driven animations: Firefox, older Safari)
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS) as (...args: string[]) => boolean;
    CSS.supports = ((...args: string[]) =>
      args.join(':').includes('animation-timeline') ? false : supports(...args)) as typeof CSS.supports;
  });
  const errors = collectErrors(page);
  await open(page, demo('celestial', 'open=1'));
  await expect(page.locator('.sc-frame')).toHaveAttribute('data-scene-ready', '');
  await expect(page.locator('.sc-frame')).not.toHaveAttribute('data-scene-css', '');
  const intro = await geometry(page, 'custom');
  await scrollTo(page, intro.top - intro.height * 0.5);
  await expect.poll(() => layerOpacity(page, 1)).toBeGreaterThan(0.2);
  expect(await layerOpacity(page, 1)).toBeLessThan(0.8);
  // written by the driver, frame by frame
  expect(await page.locator('.sc-layer[data-i="1"]').evaluate((el) => el.style.opacity)).not.toBe('');
  const rsvp = await geometry(page, 'rsvp');
  await scrollTo(page, rsvp.top - rsvp.height * 0.2);
  await expect.poll(() => layerOpacity(page, 6)).toBe(1);
  const scale = await page
    .locator('.sc-layer[data-i="6"] .sc-pic')
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(scale).toBeGreaterThan(1);
  expect(scale).toBeLessThanOrEqual(1.21);
  await expect(page.locator('.sc-layer[data-i="1"]')).toHaveCSS('visibility', 'hidden');
  expect(errors).toEqual([]);
});

test('each text rises in once, the countdown pins itself in glass, "RSVP" follows after the first screen', async ({
  page,
}) => {
  await open(page, demo('celestial', 'open=1&now=2027-01-01T10:00:00Z'));
  const cta = page.locator('a.sc-cta');
  await expect(cta).toBeAttached();
  await expect(cta).not.toHaveAttribute('data-shown', '');

  // the parents' title, far below: not in yet
  const title = page.locator('.sc-sec[data-type="parents"] .sec-title');
  await expect(title).not.toHaveClass(/\bin\b/);
  const parents = await geometry(page, 'parents');
  await scrollTo(page, parents.top - parents.height * 0.3);
  await expect(title).toHaveClass(/\bin\b/);
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  // past the first screen: "RSVP" is there
  await expect(cta).toHaveAttribute('data-shown', '');
  // back up: the title stays in
  await scrollTo(page, 0);
  await expect(title).toHaveClass(/\bin\b/);

  // the date: its countdown stays at the top of the screen, in frosted glass, while the date scrolls
  const when = await geometry(page, 'when');
  const cd = page.locator('.sc-sec[data-type="when"] .cd');
  await expect(cd).toHaveCSS('position', 'sticky');
  expect(await cd.evaluate((el) => getComputedStyle(el).backdropFilter)).toContain('blur');
  const pinnedAt = () =>
    cd.evaluate((el) => {
      const frame = document.querySelector('.sc-frame')!.getBoundingClientRect();
      return Math.round(el.getBoundingClientRect().top - Math.max(0, frame.top));
    });
  await scrollTo(page, when.top + when.height * 0.3);
  const first = await pinnedAt();
  await scrollTo(page, when.top + when.height * 0.5);
  // the same place on the screen while the page moves: near the top, under the language button
  expect(await pinnedAt()).toBe(first);
  expect(first).toBeGreaterThanOrEqual(8);
  expect(first).toBeLessThanOrEqual(80);

  // "RSVP" takes the guest to the form, and steps aside there
  await cta.click();
  await expect
    .poll(() => page.locator('#rsvp').evaluate((el) => Math.round(el.getBoundingClientRect().top)), {
      timeout: 8_000,
    })
    .toBeLessThan(200);
  await expect(cta).not.toHaveAttribute('data-shown', '');
});

test('with reduced motion: every text at once, no particles, no zoom — the pictures only cross-fade', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = collectErrors(page);
  await open(page, demo('celestial'));
  await page.getByRole('button', { name: 'הקישו לפתיחה' }).click();
  await expect(page.locator('.cover')).toBeHidden({ timeout: 2_000 });
  // a text far down the page is already there
  const title = page.locator('.sc-sec[data-type="timeline"] .sec-title');
  expect(await title.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await expect(page.locator('canvas.sc-dust')).toHaveCount(0);
  const venue = await geometry(page, 'timeline');
  await scrollTo(page, venue.top);
  await expect.poll(() => layerOpacity(page, 5)).toBe(1);
  expect(
    await page.locator('.sc-layer[data-i="5"] .sc-pic').evaluate((el) => getComputedStyle(el).transform),
  ).toBe('none');
  expect(errors).toEqual([]);
});

test('any design becomes a film: its own art behind the whole invitation', async ({ page }) => {
  const errors = collectErrors(page);
  await open(page, demo('sahar-bordeaux', 'open=1&scene=1'));
  await expect(page.locator('.inv[data-film]')).toBeAttached();
  await expect(page.locator('.sc-layer')).toHaveCount(1);
  await expect(page.locator('.sc-layer .sc-art')).toBeAttached();
  // the hero's own picture is the backdrop's now, not the hero's
  await expect(page.locator('.hero .hero-media')).toHaveCount(0);
  // …and as a page it is as it was
  await open(page, demo('sahar-bordeaux', 'open=1'));
  await expect(page.locator('.inv[data-film]')).toHaveCount(0);
  await expect(page.locator('.hero .hero-media')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('reads for everyone: no WCAG 2.1 AA violations in the film', async ({ page }) => {
  await open(page, demo('celestial', 'open=1'));
  // every text in (the reveal is decoration: a text in its first state is not what a guest reads)
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')));
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page })
    .options({ resultTypes: ['violations'] })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
});

test.describe('on a computer', () => {
  test('a phone frame in the middle of the screen: it scrolls itself, its controls are inside it', async ({
    page,
  }) => {
    test.skip(isPhone(page), 'the frame is a computer’s');
    const errors = collectErrors(page);
    await open(page, demo('celestial'));
    const vw = page.viewportSize()!.width;
    const frame = (await page.locator('.sc-frame').boundingBox())!;
    expect(Math.round(frame.width)).toBe(480);
    expect(Math.abs(frame.x + frame.width / 2 - vw / 2)).toBeLessThanOrEqual(1);
    // the gate opens inside the frame
    const cover = (await page.locator('.cover').boundingBox())!;
    expect(Math.round(cover.width)).toBe(480);
    await page.getByRole('button', { name: 'הקישו לפתיחה' }).click();
    await expect(page.locator('.cover')).toBeHidden({ timeout: 3_000 });
    // a wheel over the frame scrolls the frame, never the page
    await page.mouse.move(vw / 2, 450);
    await page.mouse.wheel(0, 900);
    await expect
      .poll(() => page.locator('.sc-scroll').evaluate((el) => el.scrollTop), { timeout: 5_000 })
      .toBeGreaterThan(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // …and so does a wheel beside it
    const before = await page.locator('.sc-scroll').evaluate((el) => el.scrollTop);
    await page.mouse.move(120, 450);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => page.locator('.sc-scroll').evaluate((el) => el.scrollTop), { timeout: 5_000 })
      .toBeGreaterThan(before + 200);
    // the language switch and "pause the animations" sit in the frame's corners
    const fab = (await page.locator('.fab').first().boundingBox())!;
    expect(fab.x).toBeGreaterThanOrEqual(frame.x);
    expect(fab.x + fab.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(errors).toEqual([]);
  });
});

// ─── the editor: "Animated invitation" on any design ────────────────────────────────────────────

async function signUp(page: Page) {
  await open(page, '/signup');
  await page.fill(
    'input[name=email]',
    `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
  );
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

/** Any valid document: sent against an old version, the answer is the stored draft (409). */
const PROBE = JSON.parse(readFileSync('docs/invitations/fixtures/example-wedding-he-en.json', 'utf8'));

test('the editor: "Animated invitation" turns a design into a film — in the preview and in the draft', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const phone = isPhone(page);
  await signUp(page);
  const id = await page.evaluate(async () => {
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
    return ((await res.json()) as { id: string }).id;
  });
  await open(page, `/app/invitations/${id}/edit`);
  const frame = page.frameLocator('iframe[title="תצוגה מקדימה של ההזמנה"]');
  await expect(frame.locator('h1.names')).toContainText('נועה', { timeout: 30_000 });
  await expect(frame.locator('.inv[data-film]')).toHaveCount(0);

  const tabs = page.getByRole('navigation', { name: 'מצב העורך' });
  if (phone) {
    await tabs.getByRole('button', { name: 'עיצוב' }).click();
    await page
      .getByRole('dialog', { name: 'כל הסקשנים' })
      .getByRole('button', { name: 'סגנון ותנועה', exact: true })
      .click();
  } else {
    await page.getByRole('tab', { name: 'עיצוב' }).click();
    await page.getByRole('button', { name: 'סגנון ותנועה', exact: true }).click();
  }
  await expect(page.getByRole('heading', { level: 2, name: 'סגנון ותנועה' })).toBeVisible();
  await page.getByRole('switch', { name: 'הרקע זז עם הגלילה' }).click();
  await expect(frame.locator('.inv[data-film]')).toBeAttached({ timeout: 15_000 });
  await expect(frame.locator('.sc-layer')).toHaveCount(1);
  await page
    .getByRole('radiogroup', { name: 'מה מרחף מעל הרקע' })
    .getByRole('radio', { name: 'פרפרים' })
    .click();
  await expect(page.locator('[role=status]', { hasText: 'כל השינויים נשמרו' }).first()).toBeAttached({
    timeout: 20_000,
  });
  const stored = await page.evaluate(
    async ({ id, probe }) => {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft: probe, updatedAt: '2000-01-01T00:00:00.000Z' }),
      });
      return (await res.json()) as { draft: { theme: { scene?: unknown } } };
    },
    { id, probe: PROBE },
  );
  expect(stored.draft.theme.scene).toEqual({ enabled: true, particles: 'butterflies' });
});

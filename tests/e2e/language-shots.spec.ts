import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { LOCAL, PHONE, galleryOn, newHost, open, publish, seedPhotos, sql } from '../support/phase5b';

// Screenshots to look at (the guest languages of Phase 5): the gallery link's dialog with its
// messages by language and a preview of each, the highlights film's cards in Arabic and Russian, the
// guests' gallery page and the invitation in Arabic and Russian, and the insights by language — the
// host's screens in Hebrew and English — on a phone (390×844) and a desktop. Only with QA_SHOTS=1
// (tests/.artifacts/language-shots); the behaviour itself is tested in gallery-section.spec.ts,
// film.spec.ts, insights.spec.ts and a11y.spec.ts.

const SHOTS = process.env.QA_SHOTS ? 'tests/.artifacts/language-shots' : null;
test.skip(!SHOTS || !LOCAL, 'screenshots on the local stack only (QA_SHOTS=1)');

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

async function shot(page: Page, name: string, fullPage = false) {
  mkdirSync(SHOTS!, { recursive: true });
  await settle(page);
  await page.evaluate(() => document.fonts.ready);
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  await page.screenshot({ path: `${SHOTS}/${phone ? 'phone' : 'desktop'}-${name}.png`, fullPage });
}

test('the guest languages, to look at', async ({ page, browser }, testInfo) => {
  test.setTimeout(420_000);
  const phone = testInfo.project.name === 'mobile';
  const host = await newHost(page, 'shots-lang', 'business', { locales: ['he', 'en', 'ru', 'ar', 'am'] });
  await galleryOn(page, host.id);
  await publish(host.id);
  await seedPhotos(host.id, [
    { color: [200, 60, 50] },
    { color: [40, 120, 200] },
    { color: [60, 170, 90] },
    { color: [210, 170, 40] },
  ]);
  const suffix = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  for (const [i, [name, language]] of (
    [
      ['דנה כהן', null],
      ['Ольга Иванова', 'ru'],
      ['سمير حداد', 'ar'],
      ['አበበ ከበደ', 'am'],
      ['Emma Stone', 'en'],
    ] as const
  ).entries())
    await sql(
      `insert into invitation_guests (invitation_id, name, party_size, phone, token, preferred_language)
       values ($1, $2, 2, $3, $4, $5)`,
      [host.id, name, `+9725${suffix}${i}5`, `sh${randomUUID().replace(/-/g, '').slice(0, 20)}`, language],
    );

  // two guests read the invitation, in Arabic and in Russian (the insights by language)
  for (const [i, lang] of (['ar', 'ru'] as const).entries()) {
    const context = await browser.newContext({
      ...(phone ? PHONE : { viewport: { width: 1440, height: 900 } }),
      extraHTTPHeaders: { 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.${i + 1}` },
    });
    const guest = await context.newPage();
    await guest.goto(`/i/${host.slug}?lang=${lang}`);
    await expect(guest.locator('html')).toHaveAttribute('lang', lang);
    await shot(guest, `guest-invitation-cover-${lang}`);
    const cover = guest.locator('.cover');
    if (await cover.count()) {
      await guest.locator('.cover > button.cover-tap').click();
      await expect(cover).toHaveCount(0, { timeout: 10_000 });
    }
    await shot(guest, `guest-invitation-${lang}`);
    await guest.mouse.wheel(0, 1200);
    await expect
      .poll(
        async () =>
          (
            await sql<{ n: number }>(
              `select count(*)::int as n from insight_visits where invitation_id = $1 and lang = $2`,
              [host.id, lang],
            )
          )[0]!.n,
        { timeout: 20_000 },
      )
      .toBe(1);
    await context.close();
  }

  const link = (
    await sql<{ nonce: string }>(
      `select upload_token_nonce as nonce from galleries where invitation_id = $1`,
      [host.id],
    )
  )[0];
  expect(link).toBeTruthy();
  for (const ui of ['he', 'en'] as const) {
    await page
      .context()
      .addCookies([{ name: 'ui_lang', value: ui, url: new URL('/', page.url()).toString() }]);
    // the gallery link: the messages by language, a preview of each
    await open(page, `/app/invitations/${host.id}/gallery`);
    await page.getByTestId('gallery-send-links').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('gallery-notices-preview')).toBeVisible();
    await shot(page, `${ui}-gallery-link`, true);
    await dialog.getByRole('radio', { name: 'العربية' }).click();
    await dialog.getByTestId('gallery-notices-preview').scrollIntoViewIfNeeded();
    await shot(page, `${ui}-gallery-link-ar`);
    await dialog.getByRole('radio', { name: 'Русский' }).click();
    await shot(page, `${ui}-gallery-link-ru`);
    await page.keyboard.press('Escape');

    // the film's cards in Arabic and Russian
    await open(page, `/app/invitations/${host.id}/gallery/film`);
    await expect(page.getByTestId('film-studio')).toBeVisible();
    for (const lang of ['ar', 'ru', 'am'] as const) {
      await page.getByTestId('film-card-language').selectOption(lang);
      const canvas = page.getByTestId('film-preview-canvas');
      await expect(canvas).toHaveAttribute('data-card-dir', lang === 'ar' ? 'rtl' : 'ltr');
      await page.waitForTimeout(600);
      if (lang !== 'am') await shot(page, `${ui}-film-${lang}`, !phone);
      mkdirSync(SHOTS!, { recursive: true });
      await canvas.screenshot({
        path: `${SHOTS}/${phone ? 'phone' : 'desktop'}-${ui}-film-card-${lang}.png`,
      });
    }

    // the insights: a visit in Arabic, one in Russian
    await open(page, `/app/invitations/${host.id}/insights`);
    await expect(page.getByTestId('insights-languages').locator('li')).toHaveCount(2);
    await page.getByTestId('insights-languages').scrollIntoViewIfNeeded();
    await shot(page, `${ui}-insights-languages`);
  }

  // the film's end card (its closing line) in Arabic, Russian and Amharic: the preview played to its
  // end (the bar under it), once
  if (!phone) {
    await open(page, `/app/invitations/${host.id}/gallery/film`);
    const settings = page.getByTestId('film-settings');
    await settings.getByRole('radio', { name: '30 s' }).click();
    await settings.getByRole('radio', { name: 'None' }).click();
    const canvas = page.getByTestId('film-preview-canvas');
    const bar = canvas.locator('xpath=following-sibling::span[1]');
    for (const lang of ['ar', 'ru', 'am'] as const) {
      await page.getByTestId('film-card-language').selectOption(lang);
      await page.getByTestId('film-preview-play').click();
      await expect(page.getByTestId('film-preview-play')).toHaveText('Stop', { timeout: 20_000 });
      await expect
        .poll(
          async () => parseFloat((await bar.getAttribute('style'))?.match(/width:\s*([\d.]+)%/)?.[1] ?? '0'),
          {
            timeout: 60_000,
            intervals: [100],
          },
        )
        .toBeGreaterThan(96);
      mkdirSync(SHOTS!, { recursive: true });
      await canvas.screenshot({ path: `${SHOTS}/desktop-film-end-card-${lang}.png` });
      await expect(page.getByTestId('film-preview-play')).toHaveText('Play', { timeout: 20_000 });
    }
  }

  // the guests' gallery page in Arabic and Russian
  const uploadUrl = (
    await page.evaluate(async (id) => {
      const res = await fetch(`/api/invitations/${id}/gallery`);
      return ((await res.json()) as { view: { gallery: { uploadUrl: string } } }).view.gallery.uploadUrl;
    }, host.id)
  ).replace(/^https?:\/\/[^/]+/, '');
  const context = await browser.newContext(phone ? PHONE : { viewport: { width: 1440, height: 900 } });
  const guest = await context.newPage();
  for (const lang of ['ar', 'ru'] as const) {
    await guest.goto(`${uploadUrl}&lang=${lang}`);
    await expect(guest.getByTestId('gallery-files')).toBeAttached();
    await shot(guest, `guest-gallery-${lang}`);
  }
  await context.close();
});

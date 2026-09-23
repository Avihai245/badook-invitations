// Host-app screens QA (P2/P3 Design QA gate, §11): screenshots of the list, gallery, preview, wizard,
// editor, publish dialog and share screen in HE (RTL) and EN (LTR) at 1440×900, 1024×768 (editor,
// compact rail) and 390×844, plus layout probes (no horizontal scroll, mirrored columns).
// Usage: BASE=http://127.0.0.1:3000 [QA_DATABASE_URL=postgres://…] node scripts/qa-host.mjs [he|en] [desktop|tablet|mobile]
// Needs a running app on a local stack (tests/support/rest-shim.mjs) and its database (the venue that
// publishing requires is filled in directly). Screenshots go to tests/.artifacts/qa/host/ (gitignored).
// Exits 1 when a probe fails. Never runs in the Amplify build.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import pg from 'pg';

const OUT = 'tests/.artifacts/qa/host';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
const [onlyLang, onlyVp] = process.argv.slice(2);
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
].filter((v) => !onlyVp || v.name === onlyVp);
const LANGS = ['he', 'en'].filter((l) => !onlyLang || l === onlyLang);
const T = {
  he: {
    edit: 'עריכה',
    publish: 'פרסום',
    venues: 'מקום האירוע',
    design: 'עיצוב',
    colors: 'צבעים',
    use: 'שימוש בעיצוב הזה',
    next: 'המשך',
  },
  en: {
    edit: 'Edit',
    publish: 'Publish',
    venues: 'Venue',
    design: 'Design',
    colors: 'Colors',
    use: 'Use this design',
    next: 'Continue',
  },
};

const db = new pg.Pool({
  connectionString: process.env.QA_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/badook_dev',
});
/** The first venue's name and address in both languages (publishing requires them). */
const fillVenue = (id) =>
  db.query(
    `update invitations set draft = jsonb_set(draft, '{sections}', (
       select jsonb_agg(case when s->>'type' = 'venues'
         then jsonb_set(jsonb_set(s, '{data,items,0,name}', $2::jsonb), '{data,items,0,address}', $3::jsonb)
         else s end order by i)
       from jsonb_array_elements(draft->'sections') with ordinality as t(s, i))) where id = $1`,
    [
      id,
      JSON.stringify({ he: 'אחוזת הגפן', en: 'Ahuzat HaGefen' }),
      JSON.stringify({ he: 'דרך הכרמים 12, זכרון יעקב', en: "12 Derech HaKramim, Zikhron Ya'akov" }),
    ],
  );

const results = [];
const check = (tag, name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${tag}  ${name}${detail ? `  (${detail})` : ''}`);
const settle = (page, ms = 600) => page.waitForTimeout(ms);
const noOverflow = async (page, tag, name) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(tag, `${name}: no horizontal scroll`, over <= 0, `${over}px`);
};

const browser = await chromium.launch();
for (const lang of LANGS) {
  for (const vp of VIEWPORTS) {
    const tag = `${lang}-${vp.name}`;
    const t = T[lang];
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    await context.addCookies([{ name: 'ui_lang', value: lang, url: BASE }]);
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const logs = [];
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 200)}`));
    const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });

    await page.goto(`${BASE}/signup`);
    await page.fill('input[name=email]', `qa-${lang}-${vp.name}-${Date.now()}@example.com`);
    await page.fill('input[name=password]', 'a-good-password');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/app\/invitations$/);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    check(tag, 'html dir', (await page.getAttribute('html', 'dir')) === (lang === 'he' ? 'rtl' : 'ltr'));

    if (vp.name !== 'tablet') {
      await settle(page);
      await shot('01-list-empty');
      await noOverflow(page, tag, 'list (empty)');
      await page.goto(`${BASE}/app/invitations/new`, { waitUntil: 'networkidle' });
      await settle(page);
      await shot('02-gallery');
      await noOverflow(page, tag, 'gallery');
      await page.locator('ul li button').first().click();
      await page.getByRole('dialog').waitFor();
      await settle(page, 2500);
      await shot('03-preview');
      await page.getByRole('button', { name: t.use }).click();
      await settle(page);
      await shot('04-wizard-1');
      await page.getByRole('dialog').getByRole('button', { name: t.next }).click();
      await settle(page);
      await shot('05-wizard-2');
      await page.keyboard.press('Escape');
    }

    const created = await page.evaluate(async (l) => {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: 'sahar-bordeaux',
          eventType: 'wedding',
          locales: l === 'he' ? ['he', 'en'] : ['en', 'he'],
          defaultLocale: l,
          hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
          date: '2027-06-17',
          startTime: '19:30',
          timezone: 'Asia/Jerusalem',
        }),
      });
      return res.json();
    }, lang);
    await page.goto(`${BASE}/app/invitations/${created.id}/edit`);
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await settle(page, 3000);
    await shot('10-editor-hero');
    await noOverflow(page, tag, 'editor');
    if (vp.name !== 'mobile') {
      // the rail's column (the aside sits inside it, next to a 1px border)
      const rail = await page.locator('aside').first().locator('xpath=..').boundingBox();
      const panel = await page.getByRole('heading', { level: 2 }).first().boundingBox();
      const railStart = lang === 'he' ? rail.x > panel.x : rail.x < panel.x;
      check(tag, 'rail at the inline-start of the form panel', railStart);
      check(
        tag,
        'rail width',
        Math.round(rail.width) === (vp.name === 'tablet' ? 64 : 280),
        `${Math.round(rail.width)}px`,
      );
      await page.getByRole('button', { name: t.venues, exact: true }).first().click();
      await settle(page, 1200);
      await shot('11-editor-venues');
      if (vp.name === 'desktop') {
        await page.getByRole('tab', { name: t.design }).click();
        await page.getByRole('button', { name: t.colors, exact: true }).click();
        await settle(page);
        await shot('12-editor-colors');
      }
      await page.getByRole('button', { name: t.publish, exact: true }).first().click();
      await settle(page, 1200);
      await shot('13-publish');
      await page.keyboard.press('Escape');
    } else {
      const nav = page.getByRole('navigation').last();
      await nav.getByRole('button').nth(1).click();
      await settle(page, 1500);
      await shot('11-editor-preview');
      await nav.getByRole('button').nth(0).click();
      await settle(page);
      await shot('12-editor-sheet');
      await noOverflow(page, tag, 'editor sheet');
      await page.keyboard.press('Escape');
    }

    // share screen (P3)
    await fillVenue(created.id);
    const published = await page.evaluate(
      async (id) =>
        (
          await fetch(`/api/invitations/${id}/publish`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
        ).status,
      created.id,
    );
    check(tag, 'publish', published === 200, String(published));
    await page.goto(`${BASE}/app/invitations/${created.id}/share`, { waitUntil: 'networkidle' });
    await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
    await settle(page, 1200);
    await shot('30-share');
    await noOverflow(page, tag, 'share');
    const linkBox = await page.locator('input[readonly]').boundingBox();
    const qrBox = await page.locator('[role=img] svg').boundingBox();
    if (vp.name === 'mobile') check(tag, 'share: one column', qrBox.y > linkBox.y + linkBox.height);
    else
      check(
        tag,
        'share: link card at the inline-start',
        lang === 'he' ? linkBox.x > qrBox.x : linkBox.x < qrBox.x,
      );
    const preview = await page
      .locator('img[width="1200"]')
      .evaluate((img) => img.complete && img.naturalWidth === 1200);
    check(tag, 'share: link preview image loads', preview);

    await page.goto(`${BASE}/app/invitations`, { waitUntil: 'networkidle' });
    await settle(page);
    await shot('20-list');
    await noOverflow(page, tag, 'list');
    for (const l of logs) results.push(`LOG   ${tag}  ${l}`);
    await context.close();
  }
}
await browser.close();
await db.end();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);

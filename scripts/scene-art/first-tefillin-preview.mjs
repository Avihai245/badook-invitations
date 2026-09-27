// The "first-tefillin" design's gallery poster (manifest.previewImage): the film's last shot — the bar
// mitzvah boy in the dawn light, the head tefillin on his head, the straps on — rendered by the app itself
// (the design's demo, scrolled to its very end), without the texts and the controls, and a little smaller
// than on the invitation, low on the card: the poster writes the names above him.
//
//   node scripts/scene-art/first-tefillin-preview.mjs <base url of a running app with the dev routes>
//     (INVITES_DEV_ROUTES=true) → public/templates/first-tefillin/preview.webp
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/scene-art/first-tefillin-preview.mjs <base url>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const out = join(root, 'public/templates/first-tefillin/preview.webp');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 540, height: 960 },
  deviceScaleFactor: 2,
  locale: 'he-IL',
});
await page.goto(`${base}/dev/invitations/render/first-tefillin/he/demo?open=1`, { waitUntil: 'networkidle' });
await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
// the last shot alone: no texts, no controls; the boy a little smaller and lower (the names go above him)
await page.addStyleTag({
  content:
    '.sc-track main,.sc-cta,.fab,.lang-menu,.fab-listen-slot{visibility:hidden!important}' +
    '.sc-prop{width:84%!important;top:12%!important;bottom:-12%!important}',
});
await page.evaluate(async () => {
  const el = document.scrollingElement;
  el.style.scrollBehavior = 'auto';
  const max = el.scrollHeight - el.clientHeight;
  for (let k = 1; k <= 40; k++) {
    el.scrollTo(0, (max * k) / 40);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
});
// the straps drawn on, the burst gone
await page.locator('.sc-prop[data-scored]').waitFor({ state: 'attached' });
await page.waitForTimeout(3500);
const shot = await page.screenshot({ type: 'png' });
await browser.close();
mkdirSync(dirname(out), { recursive: true });
await sharp(shot).resize({ width: 1080 }).webp({ quality: 80, effort: 6 }).toFile(out);
console.log(out);

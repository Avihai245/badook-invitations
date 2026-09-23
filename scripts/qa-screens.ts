/**
 * Design QA gate (MASTER_PROMPT §11) — screenshots + comparison against the design reference.
 *
 *   npx tsx scripts/qa-screens.ts [--base http://127.0.0.1:3000] [--out tests/.artifacts/qa]
 *
 * 1. Our kitchen-sink render of the §10.1 fixture (sahar-bordeaux) at 390×844 @2x, HE + EN, with the
 *    RSVP form driven into the same state as the reference screenshots (yes · 2 adults · 1 child ·
 *    "Dana" · vegetarian), time frozen, reduced motion (every section revealed).
 * 2. The same frames of docs/invitations/design-reference/invitation.html rendered live in the same
 *    Chromium → per-frame pixel diff (pixelmatch).
 * 3. Side-by-side PNGs: ours | live reference | provided screenshot (design-reference/screenshots).
 * 4. Desktop 1440×900 hero (HE/EN), cover, all 8 templates × he/en (demo) — checks for horizontal
 *    overflow and console errors.
 * Runs locally or in CI only — never in the Amplify build (§1.1 rule 7).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { fontFaceCss } from '../src/features/invitations/fonts';
import { TEMPLATE_IDS } from '../src/features/invitations/templates/registry';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:3000');
const OUT = resolve(arg('out', 'tests/.artifacts/qa'));
const ONLY = arg('only', 'all'); // all | fixture | templates | sheets | legibility | stress
const NOW = '2026-09-23T10:00:00Z';
// --tpl a,b limits the template loops (templates / sheets / legibility) to those ids
const TPLS = arg('tpl', '')
  ? TEMPLATE_IDS.filter((id) => arg('tpl', '').split(',').includes(id))
  : TEMPLATE_IDS;
const REF_DIR = resolve('docs/invitations/design-reference');
// --public: compare the published page /i/noa-and-itay (P1, needs the database) instead of the kitchen sink
const PUBLIC = process.argv.includes('--public');
const fixtureUrl = (locale: string) =>
  PUBLIC
    ? `${BASE}/i/noa-and-itay?lang=${locale}&open=1`
    : `${BASE}/dev/invitations/render/sahar-bordeaux/${locale}/wedding-he-en?open=1&now=${NOW}`;
const FRAME = { w: 390, h: 844, dpr: 2 };

mkdirSync(OUT, { recursive: true });

type Legibility = { name: string; small: number; large: number; bareSmall: number; bareLarge: number };
type Report = {
  frames: { name: string; diffPct: number | null; vsProvidedPct?: number | null }[];
  pages: { name: string; overflowX: number; errors: string[]; height: number }[];
  legibility: Legibility[];
};
const report: Report = { frames: [], pages: [], legibility: [] };

async function newPage(browser: Browser, w = FRAME.w, h = FRAME.h, dpr = FRAME.dpr) {
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: dpr,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(NOW));
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return { page, errors };
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

/** Put the RSVP form into the reference state. `ours` = our DOM, otherwise the reference DOM. */
async function driveRsvp(page: Page, ours: boolean, locale: 'he' | 'en') {
  const name = locale === 'he' ? 'דנה' : 'Dana';
  if (ours) {
    await page.locator('.form .opt').first().click();
    await page.locator('.form .srow').nth(0).locator('.stepper button').last().click();
    await page.locator('.form .srow').nth(1).locator('.stepper button').last().click();
    await page.locator('.form .person').first().locator('input').first().fill(name);
    await page.locator('.form input[data-diet="a0"][value="vegetarian"]').check({ force: true });
  } else {
    await page.locator('#rsvpForm .opt').first().click();
    await page.locator('[data-step="adults:1"]').click();
    await page.locator('[data-step="children:1"]').click();
    await page.locator('[id="f-a0.firstName"]').fill(name);
    await page.locator('input[data-diet="a0"][value="vegetarian"]').check({ force: true });
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function hideFixed(page: Page) {
  await page.addStyleTag({ content: '.fab{display:none!important}' });
}

async function frames(page: Page, prefix: string): Promise<string[]> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const files: string[] = [];
  for (let i = 0; i * FRAME.h < height; i++) {
    const file = join(OUT, `${prefix}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({
      path: file,
      fullPage: true,
      clip: { x: 0, y: i * FRAME.h, width: FRAME.w, height: Math.min(FRAME.h, height - i * FRAME.h) },
    });
    files.push(file);
  }
  return files;
}

function readPng(file: string) {
  return PNG.sync.read(readFileSync(file));
}

/** Pixel diff of two same-width frames (compared over the common height). */
function diffPct(a: string, b: string, out: string): number {
  const A = readPng(a);
  const B = readPng(b);
  const w = Math.min(A.width, B.width);
  const h = Math.min(A.height, B.height);
  const crop = (p: PNG) => {
    const c = new PNG({ width: w, height: h });
    PNG.bitblt(p, c, 0, 0, w, h, 0, 0);
    return c;
  };
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(crop(A).data, crop(B).data, diff.data, w, h, { threshold: 0.15 });
  writeFileSync(out, PNG.sync.write(diff));
  return (n / (w * h)) * 100;
}

/** ours | live reference | provided reference screenshot, side by side with 16px gutters. */
function sideBySide(files: (string | null)[], out: string) {
  const imgs = files.map((f) => (f && existsSync(f) ? readPng(f) : null));
  const w = Math.max(...imgs.map((i) => i?.width ?? 0));
  const h = Math.max(...imgs.map((i) => i?.height ?? 0));
  const gap = 16;
  const canvas = new PNG({ width: files.length * w + (files.length - 1) * gap, height: h });
  canvas.data.fill(255);
  imgs.forEach((img, k) => img && PNG.bitblt(img, canvas, 0, 0, img.width, img.height, k * (w + gap), 0));
  writeFileSync(out, PNG.sync.write(canvas));
}

async function checkPage(page: Page, errors: string[], name: string) {
  const [overflowX, height] = await page.evaluate(() => [
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.documentElement.scrollHeight,
  ]);
  report.pages.push({ name, overflowX, errors: [...errors], height });
}

async function fixtureQA(browser: Browser) {
  for (const locale of ['he', 'en'] as const) {
    // ours
    const ours = await newPage(browser);
    await ours.page.goto(fixtureUrl(locale), { waitUntil: 'networkidle' });
    await settle(ours.page);
    await ours.page.screenshot({ path: join(OUT, `ours-${locale}-top-with-controls.png`) });
    await driveRsvp(ours.page, true, locale);
    await hideFixed(ours.page);
    await settle(ours.page);
    const ourFrames = await frames(ours.page, `ours-${locale}`);
    await checkPage(ours.page, ours.errors, `fixture sahar-bordeaux ${locale}`);
    await ours.page.context().close();

    // live reference (same Chromium, same clock). Its Google Fonts request is answered with the same
    // self-hosted font files our pages use, so both sides render with identical fonts.
    const ref = await newPage(browser);
    const refFonts = fontFaceCss([
      'Assistant',
      'Bellefair',
      'Cormorant Garamond',
      'Frank Ruhl Libre',
      'Lora',
      'Pinyon Script',
    ]).replaceAll('url(/fonts/', `url(${BASE}/fonts/`);
    await ref.page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: refFonts }),
    );
    await ref.page.route('https://fonts.gstatic.com/**', (route) => route.abort());
    // the reference is a file:// page → cross-origin font loads need CORS headers
    await ref.page.route(`${BASE}/fonts/**`, (route) =>
      route.fulfill({
        path: join('public', new URL(route.request().url()).pathname),
        headers: { 'access-control-allow-origin': '*', 'content-type': 'font/woff2' },
      }),
    );
    await ref.page.goto(
      `${pathToFileURL(join(REF_DIR, 'invitation.html')).href}?open=1${locale === 'en' ? '&lang=en' : ''}`,
      {
        waitUntil: 'networkidle',
      },
    );
    await settle(ref.page);
    await driveRsvp(ref.page, false, locale);
    await hideFixed(ref.page);
    await settle(ref.page);
    const refFrames = await frames(ref.page, `ref-${locale}`);
    await ref.page.context().close();

    ourFrames.forEach((file, i) => {
      const r = refFrames[i] ?? null;
      const provided = join(REF_DIR, 'screenshots', `inv-${locale}-${String(i).padStart(2, '0')}.png`);
      const pct = r ? diffPct(file, r, join(OUT, `diff-${locale}-${String(i).padStart(2, '0')}.png`)) : null;
      const vsProvided = existsSync(provided)
        ? diffPct(file, provided, join(OUT, `diffp-${locale}-${String(i).padStart(2, '0')}.png`))
        : null;
      report.frames.push({
        name: `${locale}-${String(i).padStart(2, '0')}`,
        diffPct: pct,
        vsProvidedPct: vsProvided,
      });
      sideBySide(
        [file, r, existsSync(provided) ? provided : null],
        join(OUT, `cmp-${locale}-${String(i).padStart(2, '0')}.png`),
      );
    });
  }

  // cover (closed) — HE, like inv-01-cover-he.png
  const cover = await newPage(browser);
  await cover.page.goto(`${BASE}/dev/invitations/render/sahar-bordeaux/he/wedding-he-en?now=${NOW}`, {
    waitUntil: 'networkidle',
  });
  await settle(cover.page);
  await cover.page.addStyleTag({
    content: '.cover-hint{opacity:1!important;animation:none!important}.seal{animation:none!important}',
  });
  await cover.page.screenshot({ path: join(OUT, 'ours-cover-he.png') });
  sideBySide(
    [join(OUT, 'ours-cover-he.png'), null, join(REF_DIR, 'screenshots', 'inv-01-cover-he.png')],
    join(OUT, 'cmp-cover-he.png'),
  );
  await cover.page.context().close();

  // desktop hero
  for (const locale of ['he', 'en'] as const) {
    const d = await newPage(browser, 1440, 900, 1);
    await d.page.goto(fixtureUrl(locale), { waitUntil: 'networkidle' });
    await settle(d.page);
    await d.page.screenshot({ path: join(OUT, `ours-desktop-${locale}-top.png`) });
    await checkPage(d.page, d.errors, `desktop ${locale}`);
    await d.page.context().close();
  }
}

async function templatesQA(browser: Browser) {
  for (const id of TPLS) {
    for (const locale of ['he', 'en'] as const) {
      for (const scheme of ['light', 'dark'] as const) {
        const { page, errors } = await newPage(browser);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`${BASE}/dev/invitations/render/${id}/${locale}/demo?open=1&now=${NOW}`, {
          waitUntil: 'networkidle',
        });
        await settle(page);
        await checkPage(page, errors, `${id} ${locale} device-${scheme}`);
        const file = join(OUT, `tpl-${id}-${locale}-${scheme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        await page.context().close();
      }
      // device dark mode must not change the invitation (it always uses template colors)
      const light = join(OUT, `tpl-${id}-${locale}-light.png`);
      const dark = join(OUT, `tpl-${id}-${locale}-dark.png`);
      report.frames.push({
        name: `${id}-${locale} light≡dark`,
        diffPct: diffPct(light, dark, join(OUT, `diff-scheme-${id}-${locale}.png`)),
      });
    }
  }
}

/** One row of viewport frames per template (dpr 1) — a quick visual check that every template renders cleanly. */
async function contactSheets(browser: Browser) {
  for (const locale of ['he', 'en'] as const) {
    for (const id of TPLS) {
      const { page } = await newPage(browser, FRAME.w, FRAME.h, 1);
      await page.goto(`${BASE}/dev/invitations/render/${id}/${locale}/demo?open=1&now=${NOW}`, {
        waitUntil: 'networkidle',
      });
      await settle(page);
      await hideFixed(page);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const shots: string[] = [];
      for (let i = 0; i * FRAME.h < height && i < 8; i++) {
        const file = join(OUT, `sheet-part-${id}-${locale}-${i}.png`);
        await page.screenshot({
          path: file,
          fullPage: true,
          clip: { x: 0, y: i * FRAME.h, width: FRAME.w, height: Math.min(FRAME.h, height - i * FRAME.h) },
        });
        shots.push(file);
      }
      sideBySide(shots, join(OUT, `sheet-${id}-${locale}.png`));
      // cover (closed) of the same template
      const cover = await newPage(browser, FRAME.w, FRAME.h, 1);
      await cover.page.goto(`${BASE}/dev/invitations/render/${id}/${locale}/demo?now=${NOW}`, {
        waitUntil: 'networkidle',
      });
      await settle(cover.page);
      await cover.page.addStyleTag({ content: '.cover-hint{opacity:1!important;animation:none!important}' });
      await cover.page.screenshot({ path: join(OUT, `cover-${id}-${locale}.png`) });
      await cover.page.context().close();
      await page.context().close();
    }
    sideBySide(
      TPLS.map((id) => join(OUT, `cover-${id}-${locale}.png`)),
      join(OUT, `covers-${locale}.png`),
    );
  }
}

/**
 * §12.12: the longest allowed strings (stress document) in every template × locale at 360×640,
 * 390×844 and 1440×900 — no horizontal overflow and no text outside the viewport or clipped by its
 * box. Full-page screenshots (390 wide) go to stress-<id>-<locale>.png for the overlap review.
 */
async function stressQA(browser: Browser) {
  const views = [
    { tag: '360', w: 360, h: 640 },
    { tag: '390', w: FRAME.w, h: FRAME.h },
    { tag: '1440', w: 1440, h: 900 },
  ];
  for (const id of TPLS) {
    for (const locale of ['he', 'en'] as const) {
      for (const v of views) {
        const { page, errors } = await newPage(browser, v.w, v.h, 1);
        await page.goto(`${BASE}/dev/invitations/render/${id}/${locale}/stress?open=1&now=${NOW}`, {
          waitUntil: 'networkidle',
        });
        await settle(page);
        const escapes = await page.evaluate(() => {
          const out: string[] = [];
          const vw = document.documentElement.clientWidth;
          const root = document.querySelector('.inv');
          if (!root) return ['no .inv root'];
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const el = node.parentElement;
            const text = (node.textContent ?? '').trim();
            if (!el || !text || el.closest('[aria-hidden="true"], .fab, .cover, [hidden]')) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = range.getClientRects();
            let escaped = false;
            for (let i = 0; i < rects.length; i++) {
              const r = rects[i]!;
              if (r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5)) escaped = true;
            }
            const clipped =
              (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1;
            if (escaped || clipped)
              out.push(
                `${escaped ? 'outside viewport' : 'clipped'}: <${el.tagName.toLowerCase()} class="${el.className}"> "${text.slice(0, 40)}"`,
              );
          }
          return out;
        });
        await checkPage(page, [...errors, ...escapes], `stress ${id} ${locale} ${v.tag}`);
        if (v.tag === '390') {
          await hideFixed(page);
          await page.screenshot({ path: join(OUT, `stress-${id}-${locale}.png`), fullPage: true });
        }
        await page.context().close();
      }
    }
  }
}

const LUT = Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const luminance = (r: number, g: number, b: number) => 0.2126 * LUT[r]! + 0.7152 * LUT[g]! + 0.0722 * LUT[b]!;

type TextLine = { large: boolean; color: string; x: number; y: number; w: number; h: number };

/** 10th-percentile WCAG contrast of each line's text color against the pixels behind it (min per kind). */
function contrastBehind(png: PNG, lines: TextLine[]) {
  let small = Infinity;
  let large = Infinity;
  for (const line of lines) {
    const m = line.color.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
    const lt = luminance(m[0]!, m[1]!, m[2]!);
    const ratios: number[] = [];
    const x0 = Math.max(0, Math.floor(line.x));
    const y0 = Math.max(0, Math.floor(line.y));
    const x1 = Math.min(png.width, Math.ceil(line.x + line.w));
    const y1 = Math.min(png.height, Math.ceil(line.y + line.h));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * png.width + x) * 4;
        const lb = luminance(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
        ratios.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05));
      }
    }
    if (!ratios.length) continue;
    ratios.sort((a, b) => a - b);
    const p10 = ratios[Math.floor(ratios.length * 0.1)]!;
    if (line.large) large = Math.min(large, p10);
    else small = Math.min(small, p10);
  }
  return { small, large };
}

/**
 * Hero text legibility: hide the hero text, then for every line box of the eyebrow / names / date /
 * location read the backdrop pixels behind it and compute the WCAG contrast of the text color
 * against each pixel. Reported value = the 10th percentile (90% of the backdrop behind the line has at
 * least this contrast). Text shadows are ignored, so this is conservative. `small` = eyebrow, date,
 * location, joiner; `large` = the names.
 */
async function heroLegibility(browser: Browser) {
  const views = [
    { tag: 'mobile', w: FRAME.w, h: FRAME.h },
    { tag: 'desktop', w: 1440, h: 900 },
  ];
  for (const id of TPLS) {
    for (const locale of ['he', 'en'] as const) {
      for (const v of views) {
        const { page } = await newPage(browser, v.w, v.h, 1);
        await page.goto(`${BASE}/dev/invitations/render/${id}/${locale}/demo?open=1&now=${NOW}`, {
          waitUntil: 'networkidle',
        });
        await settle(page);
        const lines = await page.evaluate(() => {
          const out: { large: boolean; color: string; x: number; y: number; w: number; h: number }[] = [];
          const els = document.querySelectorAll<HTMLElement>(
            '.hero .eyebrow, .hero .names .n, .hero .names .j, .hero .hero-date, .hero .hero-loc',
          );
          for (let i = 0; i < els.length; i++) {
            const el = els[i]!;
            const range = document.createRange();
            range.selectNodeContents(el);
            const rects = range.getClientRects();
            for (let k = 0; k < rects.length; k++) {
              const r = rects[k]!;
              if (r.width < 4 || r.height < 4) continue;
              out.push({
                large: el.classList.contains('n'),
                color: getComputedStyle(el).color,
                x: r.x,
                y: r.y,
                w: r.width,
                h: r.height,
              });
            }
          }
          return out;
        });
        // 1) text fill transparent → the backdrop as a reader sees it (overlay + text shadow halo)
        const shadow = await page.addStyleTag({
          content:
            '.hero-inner *{color:transparent!important;-webkit-text-fill-color:transparent!important}.hero .rule,.cue,.fab{visibility:hidden!important}',
        });
        await page.waitForTimeout(50);
        const withShadow = contrastBehind(PNG.sync.read(await page.screenshot()), lines);
        // 2) text + shadow hidden → bare backdrop (conservative)
        await shadow.evaluate((el) => (el as Element).remove());
        await page.addStyleTag({ content: '.hero-inner,.cue,.fab{visibility:hidden!important}' });
        await page.waitForTimeout(50);
        const bare = contrastBehind(PNG.sync.read(await page.screenshot()), lines);
        const small = withShadow.small;
        const large = withShadow.large;
        report.legibility.push({
          name: `${id} ${locale} ${v.tag}`,
          small,
          large,
          bareSmall: bare.small,
          bareLarge: bare.large,
        });
        await page.context().close();
      }
    }
  }
}

async function main() {
  const browser = await chromium.launch();
  try {
    if (ONLY === 'all' || ONLY === 'fixture') await fixtureQA(browser);
    if (ONLY === 'all' || ONLY === 'templates') await templatesQA(browser);
    if (ONLY === 'all' || ONLY === 'sheets') await contactSheets(browser);
    if (ONLY === 'all' || ONLY === 'legibility') await heroLegibility(browser);
    if (ONLY === 'all' || ONLY === 'stress') await stressQA(browser);
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const pct = (v: number | null | undefined) => (v == null ? '   n/a' : `${v.toFixed(2).padStart(6)}%`);
  for (const f of report.frames) {
    console.log(
      `frame ${f.name.padEnd(34)} vs live ref ${pct(f.diffPct)}   vs provided png ${pct(f.vsProvidedPct)}`,
    );
  }
  for (const p of report.pages) {
    console.log(
      `page  ${p.name.padEnd(34)} h=${p.height} overflowX=${p.overflowX}${p.errors.length ? ` ERRORS: ${p.errors.join(' | ')}` : ''}`,
    );
  }
  for (const l of report.legibility) {
    console.log(
      `hero  ${l.name.padEnd(34)} small ${l.small.toFixed(2)}:1  names ${l.large.toFixed(2)}:1   (bare: ${l.bareSmall.toFixed(2)} / ${l.bareLarge.toFixed(2)})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

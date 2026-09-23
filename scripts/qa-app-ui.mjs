// Host-app UI QA (§9B.2): screenshots + RTL/LTR, focus and layout probes for /dev/app-ui.
// Usage: BASE=http://127.0.0.1:3000 npm run qa:app-ui -- [he|en] [desktop|mobile]
// Screenshots go to tests/.artifacts/qa/app-ui/ (gitignored). Exits 1 when a probe fails.
// Runs locally or in CI only — never in the Amplify build (§1.1 rule 7).
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'tests/.artifacts/qa/app-ui';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
const [onlyLang, onlyVp] = process.argv.slice(2);
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
].filter((v) => !onlyVp || v.name === onlyVp);
const LANGS = ['he', 'en'].filter((l) => !onlyLang || l === onlyLang);

const settle = (page, ms = 450) => page.waitForTimeout(ms);
const results = [];
const check = (tag, name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${tag}  ${name}${detail ? `  (${detail})` : ''}`);

const browser = await chromium.launch();
for (const lang of LANGS) {
  for (const vp of VIEWPORTS) {
    const tag = `${lang}-${vp.width}x${vp.height}`;
    const rtl = lang === 'he';
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const logs = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning')
        logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
    });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));

    await page.goto(`${BASE}/dev/app-ui${lang === 'en' ? '?lang=en' : ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, 300);

    // No horizontal page scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(tag, 'no horizontal page scroll', overflow <= 0, `scrollWidth-clientWidth=${overflow}`);

    await page.screenshot({ path: `${OUT}/${tag}-full.png`, fullPage: true });

    // Compositions (element screenshots of the block after each band).
    for (const id of ['responses', 'share', 'editor']) {
      await page.locator(`#${id} + div`).screenshot({ path: `${OUT}/${tag}-${id}.png` });
    }

    // ── Probes ────────────────────────────────────────────────────────────────────────────────
    const probe = await page.evaluate((isRtl) => {
      const out = {};
      const sw = document.querySelector('[role="switch"][aria-checked="true"]:not([disabled])');
      if (sw) {
        const b = sw.getBoundingClientRect();
        const k = sw.firstElementChild.getBoundingClientRect();
        out.switchOnKnobAtEnd = isRtl ? k.left - b.left <= 3 : b.right - k.right <= 3;
      }
      const swOff = document.querySelector('[role="switch"][aria-checked="false"]:not([disabled])');
      if (swOff) {
        const b = swOff.getBoundingClientRect();
        const k = swOff.firstElementChild.getBoundingClientRect();
        out.switchOffKnobAtStart = isRtl ? b.right - k.right <= 3 : k.left - b.left <= 3;
      }
      const track = document.querySelector('section[aria-labelledby="demo-bars"] li > span[aria-hidden]');
      if (track) {
        const t = track.getBoundingClientRect();
        const f = track.firstElementChild.getBoundingClientRect();
        out.barFillFromStart = isRtl ? Math.abs(t.right - f.right) < 1 : Math.abs(f.left - t.left) < 1;
        out.barFillWidth = Math.round(f.width);
      }
      const icon = document.querySelector('section[aria-labelledby="demo-button"] .icon-dir');
      if (icon) out.dirIconTransform = getComputedStyle(icon).transform;
      const email = document.querySelector('section[aria-labelledby="demo-inputs"] input[type="email"]');
      if (email) out.ltrEmailTextAlign = getComputedStyle(email).textAlign;
      const url = document.querySelector('section[aria-labelledby="demo-inputs"] input[type="url"]');
      if (url) out.ltrUrlTextAlign = getComputedStyle(url).textAlign;
      const btn = document.querySelector('section[aria-labelledby="demo-button"] button');
      if (btn) {
        const r = btn.getBoundingClientRect();
        const ic = btn.querySelector('span[aria-hidden]').getBoundingClientRect();
        out.buttonIconAtStart = isRtl ? r.right - ic.right < 20 : ic.left - r.left < 20;
        out.buttonHeight = r.height;
      }
      const seg = document.querySelector('section[aria-labelledby="demo-segmented"] [role="radio"]');
      if (seg) out.segmentedItemHeight = seg.getBoundingClientRect().height;
      const l10n = document.querySelector('section[aria-labelledby="demo-l10n-tabs"] [role="radio"]');
      if (l10n) out.l10nTabHeight = l10n.getBoundingClientRect().height;
      const dot = [
        ...document.querySelectorAll(
          'section[aria-labelledby="demo-l10n-tabs"] [role="radio"] > span[aria-hidden]',
        ),
      ][0];
      if (dot) {
        const tab = dot.parentElement.getBoundingClientRect();
        const d = dot.getBoundingClientRect();
        out.missingDotAtEnd = isRtl ? d.left - tab.left < 6 : tab.right - d.right < 6;
      }
      const input = document.querySelector('section[aria-labelledby="demo-inputs"] input');
      if (input) out.inputHeight = input.getBoundingClientRect().height;
      const ta = document.querySelector('section[aria-labelledby="demo-inputs"] textarea');
      if (ta) out.textareaHeight = ta.getBoundingClientRect().height;
      const phone = document.querySelector('section[aria-labelledby="demo-phone"] figure > div');
      if (phone) {
        const r = phone.getBoundingClientRect();
        out.phoneScaled = `${Math.round(r.width)}x${Math.round(r.height)}`;
      }
      return out;
    }, rtl);
    check(tag, 'switch ON knob at inline-end', probe.switchOnKnobAtEnd === true);
    check(tag, 'switch OFF knob at inline-start', probe.switchOffKnobAtStart === true);
    check(
      tag,
      'bar fill grows from inline-start',
      probe.barFillFromStart === true,
      `fill=${probe.barFillWidth}px`,
    );
    check(
      tag,
      'directional icon mirrored only in RTL',
      rtl ? probe.dirIconTransform === 'matrix(-1, 0, 0, 1, 0, 0)' : probe.dirIconTransform === 'none',
      probe.dirIconTransform,
    );
    check(tag, 'button icon at inline-start', probe.buttonIconAtStart === true);
    check(tag, 'button md height 40', probe.buttonHeight === 40, String(probe.buttonHeight));
    check(tag, 'segmented item 28', probe.segmentedItemHeight === 28, String(probe.segmentedItemHeight));
    check(tag, 'l10n tab 22', probe.l10nTabHeight === 22, String(probe.l10nTabHeight));
    check(tag, 'missing dot at inline-end', probe.missingDotAtEnd === true);
    check(tag, 'input 40', probe.inputHeight === 40, String(probe.inputHeight));
    check(tag, 'textarea >= 88', probe.textareaHeight >= 88, String(probe.textareaHeight));
    // dir="ltr" data keeps to the layout's start edge (RTL → its own end = right); textAlign="start" keeps its own start.
    check(
      tag,
      'dir=ltr email aligned to layout start',
      probe.ltrEmailTextAlign === (rtl ? 'end' : 'start'),
      probe.ltrEmailTextAlign,
    );
    check(
      tag,
      'dir=ltr url (textAlign=start) aligned to own start',
      probe.ltrUrlTextAlign === 'start',
      probe.ltrUrlTextAlign,
    );
    results.push(`INFO  ${tag}  phone(scaled .42)=${probe.phoneScaled}`);

    // Keyboard: arrows follow the visual order.
    const filterGroup = page.locator('section[aria-labelledby="demo-segmented"] [role="radiogroup"]').nth(2);
    await filterGroup.locator('[role="radio"]').first().focus();
    await page.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight');
    const checkedIdx = await filterGroup
      .locator('[role="radio"]')
      .evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-checked') === 'true'));
    check(
      tag,
      `segmented ${rtl ? 'ArrowLeft' : 'ArrowRight'} selects next`,
      checkedIdx === 1,
      `checked index ${checkedIdx}`,
    );
    await page.keyboard.press('End');
    const endIdx = await filterGroup
      .locator('[role="radio"]')
      .evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-checked') === 'true'));
    check(tag, 'segmented End selects last', endIdx === 2, `checked index ${endIdx}`);
    await page.keyboard.press('Home');

    const tablist = page.locator('section[aria-labelledby="demo-tabs"] [role="tablist"]');
    await tablist.locator('[role="tab"]').first().focus();
    await page.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight');
    const tabIdx = await tablist
      .locator('[role="tab"]')
      .evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-selected') === 'true'));
    check(tag, 'tabs arrow selects next (visual order)', tabIdx === 1, `selected ${tabIdx}`);
    await page.keyboard.press('Home');

    // Focus ring on an input.
    const inputsDemo = page.locator('section[aria-labelledby="demo-inputs"]');
    await inputsDemo.locator('input').first().click();
    await inputsDemo.screenshot({ path: `${OUT}/${tag}-inputs-focus.png` });
    await page.locator('body').click({ position: { x: 2, y: 300 } });

    // Tooltip.
    const undo = page.locator('section[aria-labelledby="demo-icon-button"] button').nth(1);
    await undo.hover();
    await settle(page, 900);
    const tipBox = await undo.boundingBox();
    await page.screenshot({
      path: `${OUT}/${tag}-tooltip.png`,
      clip: {
        x: Math.max(0, tipBox.x - 120),
        y: Math.max(0, tipBox.y - 20),
        width: Math.min(300, vp.width),
        height: 110,
      },
    });
    await page.mouse.move(1, 1);

    // Drawer (primitive demo): mid-animation + settled.
    const overlayButtons = page.locator('section[aria-labelledby="demo-overlays"] button');
    await overlayButtons.nth(0).scrollIntoViewIfNeeded();
    await overlayButtons.nth(0).click();
    await page.waitForTimeout(70);
    await page.screenshot({ path: `${OUT}/${tag}-drawer-mid.png` });
    await settle(page);
    await page.screenshot({ path: `${OUT}/${tag}-drawer.png` });
    const drawerBox = await page.locator('[role="dialog"]').boundingBox();
    const drawerOk = rtl ? Math.abs(drawerBox.x) < 1 : Math.abs(drawerBox.x + drawerBox.width - vp.width) < 1;
    check(
      tag,
      `drawer attached to inline-end (${rtl ? 'left' : 'right'})`,
      drawerOk,
      `x=${drawerBox.x} w=${drawerBox.width}`,
    );
    check(
      tag,
      'drawer width 480 / full on mobile',
      drawerBox.width === Math.min(480, vp.width),
      String(drawerBox.width),
    );
    const drawerDir = await page.locator('[role="dialog"]').evaluate((el) => getComputedStyle(el).direction);
    check(tag, 'drawer content direction', drawerDir === (rtl ? 'rtl' : 'ltr'), drawerDir);
    await page.keyboard.press('Escape');
    await settle(page);
    check(tag, 'drawer closes on Esc', (await page.locator('[role="dialog"]').count()) === 0);

    // Dialog.
    await overlayButtons.nth(1).click();
    await settle(page);
    await page.screenshot({ path: `${OUT}/${tag}-dialog.png` });
    const dlg = await page.locator('[role="dialog"]').boundingBox();
    check(tag, 'dialog max-width 560', dlg.width <= 560, String(dlg.width));
    await page.mouse.click(5, vp.height - 5); // overlay click closes
    await settle(page);
    check(tag, 'dialog closes on overlay click', (await page.locator('[role="dialog"]').count()) === 0);

    // Toasts.
    const toastButtons = page.locator('section[aria-labelledby="demo-toast"] button');
    await toastButtons.nth(0).scrollIntoViewIfNeeded();
    await toastButtons.nth(0).click();
    await toastButtons.nth(1).click();
    await toastButtons.nth(2).click();
    await settle(page, 600);
    await page.screenshot({ path: `${OUT}/${tag}-toasts.png` });
    const toastBoxes = await page
      .locator('ol li[data-state="open"]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    const tb = toastBoxes[0];
    if (tb) {
      const centered = Math.abs(tb.x + tb.width / 2 - vp.width / 2) < 2;
      const atEnd = rtl ? tb.x <= 26 : Math.abs(vp.width - (tb.x + tb.width)) <= 26;
      const ok = vp.width < 640 ? centered : atEnd;
      check(
        tag,
        vp.width < 640
          ? 'toasts bottom-center (mobile)'
          : `toasts bottom inline-end (${rtl ? 'left' : 'right'})`,
        ok,
        `x=${Math.round(tb.x)} w=${Math.round(tb.width)}`,
      );
    } else check(tag, 'toasts rendered', false);
    // Persistent danger toast survives the default duration.
    await page.waitForTimeout(5600);
    const persistent = await page.locator('ol li[data-state="open"]').count();
    check(
      tag,
      'danger toast persistent (duration Infinity)',
      persistent === 1,
      `${persistent} open after 6s`,
    );
    const retry = page
      .locator('ol li[data-state="open"] button')
      .filter({ hasText: rtl ? 'ניסיון חוזר' : 'Try again' });
    await retry.click();
    await page.mouse.move(vp.width / 2, 10); // leave the viewport so the 5s timer isn't paused
    await settle(page, 600);
    const afterRetry = await page.locator('ol li[data-state="open"]').allInnerTexts();
    check(
      tag,
      'retry action closes + shows success',
      afterRetry.length === 1,
      afterRetry.join(' | ').replace(/\n/g, ' '),
    );
    await page.waitForTimeout(5400);

    // Row click → response drawer.
    const firstRow = page.locator('#responses + div table tbody tr').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click();
    await settle(page);
    await page.screenshot({ path: `${OUT}/${tag}-row-drawer.png` });
    await page.keyboard.press('Escape');
    await settle(page);

    // Editor viewport shot aligned under the sticky nav (compare with app-editor.png).
    if (vp.name === 'desktop') {
      for (const id of ['editor', 'responses', 'share']) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 44);
        }, `#${id} + div`);
        await settle(page, 300);
        await page.screenshot({ path: `${OUT}/${tag}-${id}-viewport.png` });
      }
    }

    results.push(...logs.map((l) => `LOG   ${tag}  ${l}`));
    await context.close();
  }
}
await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${failed} failed`);
if (failed) process.exit(1);

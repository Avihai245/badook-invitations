/**
 * Performance budget gate for the invitations (MASTER_PROMPT §9A) — every template's demo as a guest
 * opens it on a phone, measured in Chromium through the DevTools protocol (no Lighthouse):
 *
 *   LCP  < 2.5 s   the largest paint before the guest's first tap (the cover, as guests first see it)
 *   CLS  < 0.1     layout shifts over the whole visit: the load, the opening, a scroll to the end
 *   FPS  ≥ 55      scroll smoothness: the median rate of frames the compositor presents while the
 *                  whole invitation is scrolled (a trace's DrawFrame events). The main thread's frame
 *                  rate over the same scroll (requestAnimationFrame) is reported beside it: what
 *                  scroll-linked work there gets — reveals, main-thread animations — not the scroll
 *
 * Conditions: a 390×844 @2x phone (touch), Lighthouse's mobile network — 4G: 150 ms RTT, 1.6 Mbps
 * down, 750 Kbps up, applied per request the way DevTools and Lighthouse do (562.5 ms, ×0.9) — and a
 * 4× slower CPU. The server is warm (each page is loaded once before it is measured, as for any guest
 * after the first); the browser is cold (a fresh profile per page). A page that misses a budget is
 * measured once more before it counts as a failure (the machine may be busy).
 *
 *   npm run perf:templates [-- --base http://127.0.0.1:3000] [--tpl a,b] [--docs demo,cinematic]
 *                             [--lang he] [--out test-results/perf] [--port 3520] [--profile old-phone]
 *
 * `--profile old-phone`: an older, smaller phone — 360×640 @2x, a 6× slower CPU, the same network —
 * with its own budget (LCP < 4 s, CLS < 0.1, ≥ 50 fps): the invitation still opens, comes in and
 * scrolls smoothly there. Not part of the CI gate; run it for a new design or a heavier effect.
 *
 * Pages: `demo` — the template's own demo (its first event type); `cinematic` — the schema-v2 showcase
 * (every section layout, parallax, Ken Burns, a video background, text reveals; photos from /dev/media).
 * Without --base it starts `next start` itself (run `npm run build` first) with the dev routes on, and
 * stops it at the end. Writes <out>/templates.json and <out>/templates.md; exits 1 when a page misses
 * a budget. Runs locally or in CI (.github/workflows/perf-templates.yml) — never in the Amplify build.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import { TEMPLATE_IDS } from '../src/features/invitations/templates/registry';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const PORT = Number(arg('port', process.env.PERF_PORT || '3520'));
const BASE = arg('base', process.env.PERF_BASE_URL || '');
const OUT = resolve(arg('out', 'test-results/perf'));
const LANG = arg('lang', 'he');
const DOCS = arg('docs', 'demo,cinematic')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);
const only = arg('tpl', '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const TEMPLATES = only.length ? TEMPLATE_IDS.filter((id) => only.includes(id)) : [...TEMPLATE_IDS];

/** The phone the gate measures on, and an older one (`--profile old-phone`) with its own budget. */
const PROFILES = {
  phone: {
    viewport: { width: 390, height: 844, dpr: 2 },
    cpu: 4,
    budget: { lcpMs: 2500, cls: 0.1, fps: 55 },
  },
  'old-phone': {
    viewport: { width: 360, height: 640, dpr: 2 },
    cpu: 6,
    budget: { lcpMs: 4000, cls: 0.1, fps: 50 },
  },
} as const;
const PROFILE = arg('profile', 'phone') as keyof typeof PROFILES;
if (!(PROFILE in PROFILES)) throw new Error(`--profile: one of ${Object.keys(PROFILES).join(', ')}`);

export const BUDGET = PROFILES[PROFILE].budget;
/** Lighthouse's mobile throttling (constants.throttling.mobileSlow4G), applied per request by CDP. */
export const NETWORK = {
  label: '4G — 150 ms RTT, 1.6 Mbps down, 750 Kbps up (per request: 562.5 ms, ×0.9)',
  latency: 150 * 3.75,
  downloadThroughput: (1.6 * 1024 * 0.9 * 1024) / 8,
  uploadThroughput: (750 * 0.9 * 1024) / 8,
};
export const CPU_SLOWDOWN = PROFILES[PROFILE].cpu;
const PHONE = PROFILES[PROFILE].viewport;
/** How fast the page is scrolled (px/s, per gesture): a brisk read, not a fling. */
const SCROLL_SPEED = 1400;
/** The scroll test's cap (px) — a very long invitation is sampled, not read to the end. */
const SCROLL_MAX = 14_000;

interface Measure {
  lcpMs: number | null;
  lcpElement: string | null;
  fcpMs: number | null;
  cls: number;
  shifts: { value: number; at: number; sources: string[] }[];
  /** frames presented while scrolling (the compositor): median, and the slowest 5% */
  fps: number | null;
  fpsP5: number | null;
  frames: number;
  /** the main thread's frames over the same scroll (requestAnimationFrame): median rate */
  mainFps: number | null;
  mainFrames: number;
  longFrames: number;
  longTasks: number;
  scrolled: number;
  /** px/s, measured */
  scrollSpeed: number;
  kb: number;
  requests: number;
  errors: string[];
}
interface Row extends Measure {
  template: string;
  doc: string;
  url: string;
  attempts: number;
  failures: string[];
}

// ─── the page's own instruments (installed before any of its scripts) ────────────────────────────

function instruments() {
  const describe = (el: Element | null | undefined) => {
    if (!el) return null;
    const cls =
      typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    const text = (el.textContent ?? '').trim().slice(0, 24);
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${text ? ` “${text}”` : ''}`;
  };
  const perf = {
    lcp: [] as { t: number; el: string | null }[],
    shifts: [] as { t: number; v: number; sources: string[] }[],
    longTasks: 0,
    frames: [] as number[],
    recording: false,
  };
  (window as unknown as { __perf: typeof perf }).__perf = perf;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { element?: Element })[])
        perf.lcp.push({ t: e.startTime, el: describe(e.element) });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      })[]) {
        if (e.hadRecentInput) continue;
        perf.shifts.push({
          t: e.startTime,
          v: e.value,
          sources: (e.sources ?? [])
            .map((s) => describe(s.node instanceof Element ? s.node : (s.node?.parentElement ?? null)))
            .filter((s): s is string => !!s),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      if (perf.recording) perf.longTasks += list.getEntries().length;
    }).observe({ type: 'longtask' });
  } catch {
    // an old engine: the numbers stay empty
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]!;
};

/** CLS as the browser reports it: the worst session window (gaps < 1 s, at most 5 s). */
export function clsOf(shifts: { t: number; v: number }[]): number {
  let worst = 0;
  let current = 0;
  let first = 0;
  let previous = 0;
  for (const s of [...shifts].sort((a, b) => a.t - b.t)) {
    if (current && (s.t - previous > 1000 || s.t - first > 5000)) current = 0;
    if (!current) first = s.t;
    current += s.v;
    previous = s.t;
    worst = Math.max(worst, current);
  }
  return worst;
}

// ─── one page ────────────────────────────────────────────────────────────────────────────────────

async function throttle(cdp: CDPSession) {
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: NETWORK.latency,
    downloadThroughput: NETWORK.downloadThroughput,
    uploadThroughput: NETWORK.uploadThroughput,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
}

async function settleLcp(page: Page) {
  // the largest paint settles: nothing new for 1.5 s (at most 12 s after the load)
  const started = Date.now();
  let count = -1;
  let stableSince = Date.now();
  while (Date.now() - started < 12_000) {
    const n = await page.evaluate(
      () => (window as unknown as { __perf: { lcp: unknown[] } }).__perf.lcp.length,
    );
    if (n !== count) {
      count = n;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > 1500) return;
    await page.waitForTimeout(250);
  }
}

async function measure(browser: Browser, url: string): Promise<Measure> {
  const context = await browser.newContext({
    viewport: { width: PHONE.width, height: PHONE.height },
    deviceScaleFactor: PHONE.dpr,
    isMobile: true,
    hasTouch: true,
    locale: LANG === 'he' ? 'he-IL' : 'en-US',
  });
  const errors: string[] = [];
  try {
    // tsx names functions (esbuild keepNames): the helper it calls must exist in the page too
    await context.addInitScript({ content: 'globalThis.__name ??= (fn) => fn;' });
    await context.addInitScript(instruments);
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    const cdp = await context.newCDPSession(page);
    await throttle(cdp);

    await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
    await settleLcp(page);
    const loadNumbers = await page.evaluate(() => {
      const perf = (window as unknown as { __perf: { lcp: { t: number; el: string | null }[] } }).__perf;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const last = perf.lcp.at(-1);
      return {
        lcpMs: last ? last.t : null,
        lcpElement: last?.el ?? null,
        fcpMs: fcp ? fcp.startTime : null,
      };
    });

    // the guest opens the cover (a tap), and the invitation comes in
    const tap = page.locator('.cover-tap');
    if (await tap.count()) {
      await page.locator('html[data-hydrated]').waitFor({ state: 'attached', timeout: 60_000 });
      await tap.tap();
      await page.locator('.cover').waitFor({ state: 'detached', timeout: 30_000 });
    } else {
      await page.locator('html[data-hydrated]').waitFor({ state: 'attached', timeout: 60_000 });
    }
    await page.waitForTimeout(1200);

    // a scroll through the whole invitation, every frame's time and position kept. Wheel gestures:
    // they scroll through the compositor like a finger (synthesized touch gestures don't scroll
    // headless Chromium at all)
    const target = await page.evaluate(
      (max) => Math.min(max, document.documentElement.scrollHeight - window.innerHeight),
      SCROLL_MAX,
    );
    await page.evaluate(() => {
      const perf = (window as unknown as { __perf: { frames: number[][]; recording: boolean } }).__perf;
      perf.frames = [];
      perf.recording = true;
      const tick = (t: number) => {
        if (!perf.recording) return;
        perf.frames.push([t, window.scrollY]);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // the frames the compositor presents meanwhile: a trace's DrawFrame events
    const trace: { name: string; ts: number }[] = [];
    const onData = (e: { value: Record<string, unknown>[] }) => {
      for (const v of e.value) trace.push({ name: String(v.name), ts: Number(v.ts) });
    };
    cdp.on('Tracing.dataCollected', onData);
    const traced = new Promise<void>((r) => cdp.once('Tracing.tracingComplete', () => r()));
    await cdp.send('Tracing.start', {
      categories: 'disabled-by-default-devtools.timeline.frame',
      transferMode: 'ReportEvents',
    });
    const started = Date.now();
    for (let y = 0; y < target - 40 && Date.now() - started < 40_000;) {
      await cdp.send('Input.synthesizeScrollGesture', {
        x: Math.round(PHONE.width / 2),
        y: Math.round(PHONE.height / 2),
        yDistance: -Math.min(2000, target - y),
        speed: SCROLL_SPEED,
        gestureSourceType: 'mouse',
      });
      y = await page.evaluate(() => window.scrollY);
    }
    await cdp.send('Tracing.end');
    await traced;
    cdp.off('Tracing.dataCollected', onData);
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const perf = (
        window as unknown as {
          __perf: {
            frames: number[][];
            recording: boolean;
            longTasks: number;
            shifts: { t: number; v: number; sources: string[] }[];
          };
        }
      ).__perf;
      perf.recording = false;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return {
        frames: perf.frames,
        longTasks: perf.longTasks,
        shifts: perf.shifts,
        scrolled: window.scrollY,
        bytes: resources.reduce((n, r) => n + (r.transferSize || 0), nav?.transferSize ?? 0),
        requests: resources.length + 1,
      };
    });
    // the frames in which the page moved, each with the time since the frame before it
    const moving: number[] = [];
    let scrollMs = 0;
    for (let i = 1; i < after.frames.length; i++) {
      const [t, y] = after.frames[i]!;
      const [t0, y0] = after.frames[i - 1]!;
      if (y === y0) continue;
      moving.push(t! - t0!);
      scrollMs += t! - t0!;
    }
    const draws = trace
      .filter((e) => e.name === 'DrawFrame')
      .map((e) => e.ts)
      .sort((a, b) => a - b);
    const presented = draws.slice(1).map((t, i) => (t - draws[i]!) / 1000);
    const mid = median(presented);
    const slow = percentile(presented, 95);
    const mainMid = median(moving);
    return {
      ...loadNumbers,
      cls: clsOf(after.shifts),
      shifts: after.shifts
        .filter((s) => s.v >= 0.005)
        .map((s) => ({ value: Number(s.v.toFixed(4)), at: Math.round(s.t), sources: s.sources.slice(0, 3) })),
      fps: mid ? Math.min(60, 1000 / mid) : null,
      fpsP5: slow ? Math.min(60, 1000 / slow) : null,
      frames: draws.length,
      mainFps: mainMid ? Math.min(60, 1000 / mainMid) : null,
      mainFrames: moving.length,
      longFrames: moving.filter((d) => d > 50).length,
      longTasks: after.longTasks,
      scrolled: after.scrolled,
      scrollSpeed: scrollMs ? Math.round((after.scrolled / scrollMs) * 1000) : 0,
      kb: Math.round(after.bytes / 1024),
      requests: after.requests,
      errors,
    };
  } finally {
    await context.close();
  }
}

function failuresOf(m: Measure): string[] {
  const out: string[] = [];
  if (m.lcpMs === null) out.push('no LCP');
  else if (m.lcpMs >= BUDGET.lcpMs) out.push(`LCP ${(m.lcpMs / 1000).toFixed(2)} s`);
  if (m.cls >= BUDGET.cls) out.push(`CLS ${m.cls.toFixed(3)}`);
  if (m.fps === null) out.push('no frames');
  else if (m.fps < BUDGET.fps) out.push(`${m.fps.toFixed(1)} fps`);
  if (m.errors.length) out.push(`${m.errors.length} console error(s)`);
  return out;
}

// ─── the server ──────────────────────────────────────────────────────────────────────────────────

async function waitFor(url: string, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not answer in ${timeoutMs / 1000}s`);
}

function startServer(): ChildProcess {
  // node runs `next start` itself (no npx wrapper): one process, stopped by its own id
  const child = spawn(
    process.execPath,
    [resolve('node_modules/next/dist/bin/next'), 'start', '-p', String(PORT)],
    {
      env: {
        ...process.env,
        INVITES_DEV_ROUTES: 'true',
        // the app's recurring jobs would run on this traffic: not here
        INVITES_JOBS_FALLBACK: 'off',
        INVITES_PUBLIC_BASE_URL: `http://127.0.0.1:${PORT}`,
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  return child;
}

// ─── the report ──────────────────────────────────────────────────────────────────────────────────

function markdown(rows: Row[], meta: Record<string, string>): string {
  const s = (ms: number | null) => (ms === null ? '—' : (ms / 1000).toFixed(2));
  const lines = [
    '# Invitation performance budget',
    '',
    `${meta.when} · ${meta.browser} · ${PROFILE === 'phone' ? 'phone' : 'older phone'} ${PHONE.width}×${PHONE.height} @${PHONE.dpr}x (touch) · ${NETWORK.label} · CPU ${CPU_SLOWDOWN}× slower`,
    '',
    `Budgets: LCP < ${BUDGET.lcpMs / 1000} s · CLS < ${BUDGET.cls} · scroll median ≥ ${BUDGET.fps} fps. ` +
      'LCP: before the first tap (the cover). CLS: the whole visit. Scroll: frames the compositor presents ' +
      'while the whole invitation is scrolled; the main thread’s frame rate over the same scroll is shown ' +
      'beside it (information, not a budget).',
    '',
    `**${rows.filter((r) => !r.failures.length).length} of ${rows.length} pages within budget.**`,
    '',
    '| Template | Page | LCP (s) | LCP element | FCP (s) | CLS | Scroll fps (median · p5) | Main-thread fps | Long frames | Long tasks | Scrolled (px · px/s) | KB | Requests | Result |',
    '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map((r) =>
      [
        '',
        r.template,
        r.doc,
        s(r.lcpMs),
        (r.lcpElement ?? '—').replace(/\|/g, '/'),
        s(r.fcpMs),
        r.cls.toFixed(3),
        r.fps === null ? '—' : `${r.fps.toFixed(1)} · ${r.fpsP5?.toFixed(1) ?? '—'}`,
        r.mainFps === null ? '—' : r.mainFps.toFixed(1),
        `${r.longFrames}/${r.mainFrames}`,
        String(r.longTasks),
        `${r.scrolled} · ${r.scrollSpeed}`,
        String(r.kb),
        String(r.requests),
        r.failures.length ? `**fail** — ${r.failures.join(', ')}${r.attempts > 1 ? ' (twice)' : ''}` : 'ok',
        '',
      ]
        .join(' | ')
        .trim(),
    ),
    '',
  ];
  const shifted = rows.filter((r) => r.shifts.length);
  if (shifted.length) {
    lines.push('## Layout shifts', '');
    for (const r of shifted)
      lines.push(
        `- ${r.template} / ${r.doc}: ${r.shifts
          .slice(0, 4)
          .map((x) => `${x.value} at ${x.at} ms (${x.sources.join(', ') || '?'})`)
          .join('; ')}`,
      );
    lines.push('');
  }
  return lines.join('\n');
}

// ─── main ────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const base = (BASE || `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
  let server: ChildProcess | null = null;
  const stop = () => {
    if (server?.pid && server.exitCode === null) server.kill('SIGTERM');
  };
  process.on('SIGINT', () => {
    stop();
    process.exit(130);
  });
  if (!BASE) {
    server = startServer();
    await waitFor(`${base}/dev/invitations/render/${TEMPLATES[0]}/${LANG}/demo?open=1`, 90_000);
  }
  const browser = await chromium.launch();
  const rows: Row[] = [];
  try {
    for (const template of TEMPLATES) {
      for (const doc of DOCS) {
        const url = `${base}/dev/invitations/render/${template}/${LANG}/${doc}`;
        // warm the server (the render, the optimized images at the phone's widths), not the browser
        const warm = await browser.newContext({
          viewport: { width: PHONE.width, height: PHONE.height },
          deviceScaleFactor: PHONE.dpr,
          isMobile: true,
          hasTouch: true,
        });
        const wp = await warm.newPage();
        await wp.goto(`${url}?open=1`, { waitUntil: 'load', timeout: 90_000 });
        await wp.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
        });
        await wp.waitForLoadState('networkidle').catch(() => undefined);
        await warm.close();

        let m = await measure(browser, url);
        let failures = failuresOf(m);
        let attempts = 1;
        if (failures.length) {
          attempts = 2;
          const again = await measure(browser, url);
          const againFailures = failuresOf(again);
          if (againFailures.length <= failures.length) {
            m = again;
            failures = againFailures;
          }
        }
        const row: Row = { template, doc, url, attempts, failures, ...m };
        rows.push(row);
        console.log(
          `${failures.length ? 'FAIL' : 'ok  '} ${template.padEnd(22)} ${doc.padEnd(10)} LCP ${
            m.lcpMs === null ? '—' : (m.lcpMs / 1000).toFixed(2)
          }s  CLS ${m.cls.toFixed(3)}  ${m.fps?.toFixed(1) ?? '—'} fps (main ${m.mainFps?.toFixed(1) ?? '—'})  ${m.kb} KB${
            failures.length ? `  ← ${failures.join(', ')}` : ''
          }`,
        );
      }
    }
  } finally {
    const version = browser.version();
    await browser.close();
    stop();
    mkdirSync(OUT, { recursive: true });
    const meta = { when: new Date().toISOString(), browser: `Chromium ${version}` };
    writeFileSync(
      join(OUT, 'templates.json'),
      `${JSON.stringify(
        {
          ...meta,
          profile: PROFILE,
          budget: BUDGET,
          network: NETWORK,
          cpuSlowdown: CPU_SLOWDOWN,
          viewport: PHONE,
          lang: LANG,
          pages: rows,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(join(OUT, 'templates.md'), markdown(rows, meta));
    console.log(
      `\n${rows.filter((r) => !r.failures.length).length}/${rows.length} within budget → ${OUT}/templates.md`,
    );
  }
  if (rows.some((r) => r.failures.length)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

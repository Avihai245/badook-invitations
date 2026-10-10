#!/usr/bin/env node
/**
 * A published invitation against the performance budget (perf-budget.json) — Lighthouse's mobile
 * preset (Moto G Power, Slow 4G, 4x CPU), the median of `--runs` runs per page:
 *
 *   node scripts/lighthouse-budget.mjs --url https://invitations.badooks.com/i/<slug> [--url …]
 *   node scripts/lighthouse-budget.mjs --slug <slug> [--base https://invitations.badooks.com]
 *   node scripts/lighthouse-budget.mjs --recent [--hours 24]
 *        the invitations published in the last hours (GET /api/cron/recent-invitations with
 *        INVITES_CRON_URL + INVITES_CRON_SECRET, like the other scheduled jobs)
 *
 * Writes test-results/lighthouse/budget.json and budget.md; prints a line per page; exits 1 when a page
 * misses the budget. With INVITES_PERF_ALERT_WEBHOOK (a Slack-compatible incoming webhook) it posts the
 * pages that miss it there. Lighthouse comes through npx (lighthouse@12) — not a dependency of the app.
 * Needs Chrome (CHROME_PATH, or one chrome-launcher finds).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));
const one = (name, fallback) => all(name)[0] ?? fallback;
const budget = JSON.parse(readFileSync(new URL('../perf-budget.json', import.meta.url), 'utf8'));
const OUT = one('out', 'test-results/lighthouse');
const RUNS = Math.max(1, Number(one('runs', '1')));

async function recentUrls() {
  const base = process.env.INVITES_CRON_URL;
  const secret = process.env.INVITES_CRON_SECRET;
  if (!base || !secret) throw new Error('--recent needs INVITES_CRON_URL and INVITES_CRON_SECRET');
  const res = await fetch(
    `${base.replace(/\/+$/, '')}/api/cron/recent-invitations?hours=${one('hours', '24')}`,
    {
      headers: { authorization: `Bearer ${secret}` },
    },
  );
  if (!res.ok) throw new Error(`recent invitations: HTTP ${res.status}`);
  const body = await res.json();
  return body.invitations.map((i) => i.url);
}

const urls = [
  ...all('url'),
  ...all('slug').map(
    (slug) => `${one('base', 'https://invitations.badooks.com').replace(/\/+$/, '')}/i/${slug}`,
  ),
  ...(args.includes('--recent') ? await recentUrls() : []),
];
if (!urls.length) {
  console.log('No pages to check (give --url, --slug or --recent).');
  process.exit(0);
}

/** One Lighthouse run of `url` → its report (JSON). */
function lighthouse(url) {
  const r = spawnSync(
    'npx',
    [
      '--yes',
      'lighthouse@12',
      url,
      '--quiet',
      '--output=json',
      '--output-path=stdout',
      '--only-categories=performance,accessibility,best-practices',
      '--chrome-flags=--headless=new --no-sandbox',
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`lighthouse ${url}: ${r.stderr.slice(-500)}`);
  return JSON.parse(r.stdout);
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** A page's numbers (the median run, by performance score) and what misses the budget. */
function measure(url) {
  const reports = Array.from({ length: RUNS }, () => lighthouse(url));
  const score = median(reports.map((r) => r.categories.performance.score));
  const r = reports.find((x) => x.categories.performance.score === score);
  const a = r.audits;
  const scripts = a['resource-summary'].details.items.find((i) => i.resourceType === 'script');
  const m = {
    performance: r.categories.performance.score,
    accessibility: r.categories.accessibility.score,
    bestPractices: r.categories['best-practices'].score,
    lcpMs: Math.round(a['largest-contentful-paint'].numericValue),
    tbtMs: Math.round(a['total-blocking-time'].numericValue),
    speedIndexMs: Math.round(a['speed-index'].numericValue),
    serverResponseMs: Math.round(a['server-response-time'].numericValue),
    scriptRequests: scripts?.requestCount ?? 0,
    cls: Number(a['cumulative-layout-shift'].numericValue.toFixed(3)),
    scriptBytes: scripts?.transferSize ?? 0,
    totalBytes: Math.round(a['total-byte-weight'].numericValue),
  };
  const misses = [
    m.performance < budget.performance &&
      `performance ${Math.round(m.performance * 100)} < ${budget.performance * 100}`,
    m.lcpMs > budget.lcpMs && `LCP ${m.lcpMs} ms > ${budget.lcpMs}`,
    m.tbtMs > budget.tbtMs && `TBT ${m.tbtMs} ms > ${budget.tbtMs}`,
    m.speedIndexMs > budget.speedIndexMs && `Speed Index ${m.speedIndexMs} ms > ${budget.speedIndexMs}`,
    m.serverResponseMs > budget.serverResponseMs &&
      `server response ${m.serverResponseMs} ms > ${budget.serverResponseMs}`,
    m.scriptRequests > budget.scriptRequests && `${m.scriptRequests} scripts > ${budget.scriptRequests}`,
    m.cls > budget.cls && `CLS ${m.cls} > ${budget.cls}`,
    m.scriptBytes > budget.scriptBytes && `JS ${kb(m.scriptBytes)} > ${kb(budget.scriptBytes)}`,
    m.totalBytes > budget.totalBytes && `weight ${kb(m.totalBytes)} > ${kb(budget.totalBytes)}`,
    m.accessibility < budget.accessibility && `accessibility ${Math.round(m.accessibility * 100)}`,
    m.bestPractices < budget.bestPractices && `best practices ${Math.round(m.bestPractices * 100)}`,
  ].filter(Boolean);
  return { url, ...m, misses };
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

const results = [];
for (const url of urls) {
  try {
    const r = measure(url);
    results.push(r);
    console.log(
      `${r.misses.length ? '✖' : '✓'} ${url}  P${Math.round(r.performance * 100)} LCP ${r.lcpMs}ms TBT ${r.tbtMs}ms CLS ${r.cls} JS ${kb(r.scriptBytes)} total ${kb(r.totalBytes)}${r.misses.length ? `  — ${r.misses.join(', ')}` : ''}`,
    );
  } catch (err) {
    results.push({ url, error: String(err.message ?? err), misses: ['not measured'] });
    console.log(`✖ ${url}  — ${err.message ?? err}`);
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'budget.json'), JSON.stringify({ budget, results }, null, 2));
writeFileSync(
  join(OUT, 'budget.md'),
  [
    '| Page | Perf | LCP | TBT | CLS | JS | Total | Budget |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map((r) =>
      r.error
        ? `| ${r.url} | – | – | – | – | – | – | ✖ ${r.error.slice(0, 80)} |`
        : `| ${r.url} | ${Math.round(r.performance * 100)} | ${r.lcpMs} ms | ${r.tbtMs} ms | ${r.cls} | ${kb(r.scriptBytes)} | ${kb(r.totalBytes)} | ${r.misses.length ? `✖ ${r.misses.join(', ')}` : '✓'} |`,
    ),
  ].join('\n') + '\n',
);

const failed = results.filter((r) => r.misses.length);
const hook = process.env.INVITES_PERF_ALERT_WEBHOOK;
if (failed.length && hook) {
  const text = `Performance budget missed by ${failed.length} of ${results.length} invitation(s):\n${failed
    .map((r) => `• ${r.url} — ${r.misses.join(', ')}`)
    .join('\n')}`;
  await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch((err) => console.error('alert not sent:', err.message));
}
process.exit(failed.length ? 1 : 0);

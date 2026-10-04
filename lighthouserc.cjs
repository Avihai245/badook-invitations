/* eslint-disable @typescript-eslint/no-require-imports -- Lighthouse CI reads a CommonJS config */
/**
 * Lighthouse CI (.github/workflows/lighthouse.yml): the home page and a sample invitation of every
 * template — each template's demo through the same renderer as /i/<slug> (the dev render route, no
 * database needed) — on Lighthouse's mobile preset, held to perf-budget.json. Run after `npm run build`:
 *
 *   INVITES_DEV_ROUTES=true npx @lhci/cli@0.15 autorun
 *
 * LHCI_TEMPLATES=a,b limits the templates (default: all); LHCI_RUNS the runs per page (median, default 1).
 */
const { readdirSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const budget = require('./perf-budget.json');

const pack = join(__dirname, 'invitation-templates-pack');
const all = readdirSync(pack, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(pack, d.name, 'manifest.json')))
  .map((d) => d.name)
  .sort();
const only = (process.env.LHCI_TEMPLATES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const templates = only.length ? all.filter((id) => only.includes(id)) : all;
// scripts/lhci-server.mjs: `next start` behind an HTTP/2 TLS front, the way a CDN serves the site — over plain
// HTTP/1.1 the simulation of Slow 4G puts every request on a connection of its own and scores ~0.9 s worse in LCP
const base = 'https://localhost:3443';

// what every page must meet
const perf = {
  'categories:performance': ['error', { minScore: budget.performance }],
  'largest-contentful-paint': ['error', { maxNumericValue: budget.lcpMs }],
  'total-blocking-time': ['error', { maxNumericValue: budget.tbtMs }],
  'speed-index': ['error', { maxNumericValue: budget.speedIndexMs }],
  'server-response-time': ['error', { maxNumericValue: budget.serverResponseMs }],
  'resource-summary:script:count': ['error', { maxNumericValue: budget.scriptRequests }],
  'cumulative-layout-shift': ['error', { maxNumericValue: budget.cls }],
  'resource-summary:script:size': ['error', { maxNumericValue: budget.scriptBytes }],
  'total-byte-weight': ['error', { maxNumericValue: budget.totalBytes }],
  'categories:accessibility': ['error', { minScore: budget.accessibility }],
  'categories:best-practices': ['error', { minScore: budget.bestPractices }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/lhci-server.mjs',
      startServerReadyPattern: 'Ready in https',
      url: [`${base}/`, ...templates.map((id) => `${base}/dev/invitations/render/${id}/he/demo`)],
      numberOfRuns: Number(process.env.LHCI_RUNS || 1),
      settings: {
        // the mobile preset (Lighthouse's default): Moto G Power, Slow 4G, 4x CPU
        // (the front's certificate is a throw-away one)
        chromeFlags: '--no-sandbox --headless=new --ignore-certificate-errors',
      },
    },
    assert: {
      assertMatrix: [
        // the public site is meant to be found: search engines too
        {
          matchingUrlPattern: `^${base}/$`,
          assertions: {
            ...perf,
            'categories:seo': ['error', { minScore: budget.seo }],
            'resource-summary:font:count': ['error', { maxNumericValue: budget.fontRequests }],
          },
        },
        // an invitation is hidden from search engines by default (noindex): SEO isn't held to it
        { matchingUrlPattern: '/dev/invitations/render/', assertions: perf },
      ],
    },
    upload: { target: 'filesystem', outputDir: 'test-results/lhci' },
  },
};

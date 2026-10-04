#!/usr/bin/env node
/**
 * Proof that the public pages' stylesheet (src/styles/public.css, scripts/build-public-css.mjs) has every
 * class its pages use. Against a running build (`npm run build && npm start`):
 *
 *   node scripts/check-public-css.mjs [--base http://localhost:3000]
 *
 * For each public page, in both UI languages: the classes in its HTML and in the payload that hydrates
 * it → every one the full app stylesheet (the one /dev/app-ui loads) has a rule for must have one in the
 * stylesheets the public page loads. Exits 1, listing the classes, when one is missing. Needs the dev
 * routes on (INVITES_DEV_ROUTES=true) for the full sheet to compare with.
 */
const args = process.argv.slice(2);
const base = (args[args.indexOf('--base') + 1] || 'http://localhost:3000').replace(/\/+$/, '');

const PAGES = [
  '/',
  '/login',
  '/signup',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
  '/accessibility',
  '/auth/forgot',
  '/this-page-does-not-exist',
];

const get = async (path, headers = {}) => {
  const res = await fetch(base + path, { headers, redirect: 'follow' });
  return { status: res.status, text: await res.text() };
};

/** The stylesheets a page loads, concatenated. */
async function sheetsOf(html) {
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const hrefs2 = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"[^>]*rel="stylesheet"/g)].map(
    (m) => m[1],
  );
  const all = [...new Set([...hrefs, ...hrefs2])];
  const parts = await Promise.all(all.map(async (href) => (await get(href.replace(base, ''))).text));
  return parts.join('\n');
}

const decodeEntities = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** The payload that hydrates the page (RSC rows, in the page's inline scripts), decoded. */
function payloadOf(html) {
  let text = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      text += JSON.parse(m[1]);
    } catch {
      // a chunk that isn't text
    }
  }
  return text;
}

/** Every class token in the HTML's class attributes and in the payload's className strings. */
function classesOf(html) {
  const tokens = new Set();
  const add = (value) => {
    for (const token of value.split(/\s+/)) if (token) tokens.add(token);
  };
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) add(decodeEntities(m[1]));
  for (const m of payloadOf(html).matchAll(/"className":("(?:[^"\\]|\\.)*")/g)) {
    try {
      add(JSON.parse(m[1]));
    } catch {
      // not a plain string
    }
  }
  return tokens;
}

/** Whether the CSS has a rule for the class (as a selector: `.token` with Tailwind's escaping). */
function hasRule(css, token) {
  const escaped = token.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
  return css.includes('.' + escaped);
}

const full = await get('/dev/app-ui');
if (full.status !== 200) {
  console.error(`/dev/app-ui answered ${full.status}: start the build with INVITES_DEV_ROUTES=true`);
  process.exit(2);
}
const fullCss = await sheetsOf(full.text);

let missing = 0;
for (const lang of ['he', 'en']) {
  for (const path of PAGES) {
    const page = await get(path, { cookie: `ui_lang=${lang}` });
    const css = await sheetsOf(page.text);
    const lost = [...classesOf(page.text)].filter((token) => hasRule(fullCss, token) && !hasRule(css, token));
    const line = `${lang} ${path} (${page.status}): ${classesOf(page.text).size} classes, sheet ${Math.round(css.length / 1024)} KB`;
    if (lost.length) {
      missing += lost.length;
      console.log(`✖ ${line}\n    missing: ${lost.slice(0, 40).join(' ')}${lost.length > 40 ? ' …' : ''}`);
    } else console.log(`✓ ${line}`);
  }
}
if (missing) {
  console.error(`\n${missing} class(es) the public pages use are missing from their stylesheet.`);
  process.exit(1);
}
console.log('\nEvery class the public pages render is in their stylesheet.');

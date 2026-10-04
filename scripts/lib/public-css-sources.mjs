/**
 * The files the public site's pages can reach (scripts/build-public-css.mjs writes them as Tailwind
 * `@source` lines for src/styles/public.css; tests/unit/public-css-sources.test.ts keeps the host app
 * out of them). Walks the imports — static, re-exports, side-effect and dynamic `import('…')` — from
 * every route file of the public site: `src/app/(site)` except its `app/` and `dev/` subtrees, and the
 * not-found page. Packages are not followed; `@/…` is `src/…`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROUTE_FILE = /^(page|layout|error|not-found|loading|template|default)\.tsx?$/;
const EXTENSIONS = ['.tsx', '.ts', '/index.tsx', '/index.ts', ''];
const IMPORT =
  /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** @param {string} root the repository's root → absolute paths of the files, sorted */
export function publicSourceFiles(root) {
  const src = join(root, 'src');
  const site = join(src, 'app', '(site)');
  // the (site) subtrees that are the host app and the dev pages, not the public site
  const notPublic = [join(site, 'app'), join(site, 'dev')];

  const entries = [];
  const collect = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (notPublic.includes(path)) continue;
      if (statSync(path).isDirectory()) collect(path);
      else if (ROUTE_FILE.test(name)) entries.push(path);
    }
  };
  collect(site);
  // the page for an address that matches nothing (app/global-not-found.tsx)
  const notFound = join(src, 'app', 'global-not-found.tsx');
  if (existsSync(notFound)) entries.push(notFound);

  const resolveImport = (from, spec) => {
    let base;
    if (spec.startsWith('@/')) base = join(src, spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
    else return null; // a package
    for (const ext of EXTENSIONS) {
      const file = base + ext;
      if (existsSync(file) && statSync(file).isFile() && /\.tsx?$/.test(file)) return file;
    }
    return null;
  };

  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const target = resolveImport(file, m[1] ?? m[2] ?? m[3]);
      if (target) walk(target);
    }
  };
  for (const entry of entries) walk(entry);
  return [...seen].sort();
}

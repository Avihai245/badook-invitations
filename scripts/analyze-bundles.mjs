#!/usr/bin/env node
/**
 * What the JavaScript a page loads is made of, module by module — no extra dependency. Build with source
 * maps (`ANALYZE_SOURCEMAPS=1 npm run build`), start the build, then:
 *
 *   node scripts/analyze-bundles.mjs --url http://localhost:3000/ [--top 30] [--base http://localhost:3000]
 *
 * Fetches the page, takes the scripts it loads, and for each one reads its source map: the characters of
 * the bundle that map to each source file, scaled to the chunk's gzipped size. Prints each chunk, then
 * the heaviest sources across all of them (packages grouped as `node_modules/<package>`).
 */
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};
const base = arg('base', 'http://localhost:3000').replace(/\/+$/, '');
const url = arg('url', `${base}/`);
const top = Number(arg('top', '30'));

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

/** Source-map `mappings` → per generated line, the segments [genCol, sourceIndex | -1]. */
function decode(mappings) {
  const lines = [];
  let source = 0;
  for (const line of mappings.split(';')) {
    const segments = [];
    let genCol = 0;
    for (const part of line.split(',')) {
      if (!part) continue;
      const fields = [];
      let value = 0;
      let shift = 0;
      for (const char of part) {
        const digit = B64_INDEX.get(char);
        value += (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          fields.push(value & 1 ? -(value >> 1) : value >> 1);
          value = 0;
          shift = 0;
        }
      }
      genCol += fields[0];
      if (fields.length >= 4) {
        source += fields[1];
        segments.push([genCol, source]);
      } else segments.push([genCol, -1]);
    }
    lines.push(segments);
  }
  return lines;
}

const get = async (path) => {
  const res = await fetch(path.startsWith('http') ? path : base + path);
  return res.ok ? res : null;
};

const html = await (await get(url)).text();
const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))].filter((s) =>
  s.includes('/_next/static/'),
);

const totals = new Map();
let totalGzip = 0;
for (const script of scripts) {
  const js = await (await get(script)).text();
  const mapRes = await get(`${script}.map`);
  const gz = gzipSync(js, { level: 9 }).length;
  totalGzip += gz;
  if (!mapRes) {
    console.log(
      `${String(Math.round(gz / 1024)).padStart(4)} KB gz  ${script.split('/').pop()}  (no source map)`,
    );
    continue;
  }
  const map = await mapRes.json();
  const sources = map.sources.map((s) =>
    s
      .replace(/^webpack:\/\/_N_E\//, '')
      .replace(/^\.\//, '')
      .replace(/^(?:\.\.\/)+/, ''),
  );
  const perSource = new Map();
  const lines = js.split('\n');
  decode(map.mappings).forEach((segments, lineIndex) => {
    const length = lines[lineIndex]?.length ?? 0;
    segments.forEach(([col, source], i) => {
      const end = i + 1 < segments.length ? segments[i + 1][0] : length;
      const key = source < 0 ? '(unmapped)' : sources[source];
      perSource.set(key, (perSource.get(key) ?? 0) + Math.max(0, end - col));
    });
  });
  const raw = [...perSource.values()].reduce((a, b) => a + b, 0) || 1;
  const scale = gz / raw;
  console.log(`${String(Math.round(gz / 1024)).padStart(4)} KB gz  ${script.split('/').slice(-2).join('/')}`);
  for (const [source, chars] of [...perSource].sort((a, b) => b[1] - a[1]).slice(0, 4))
    console.log(`        ${String(Math.round((chars * scale) / 102.4) / 10).padStart(5)} KB  ${source}`);
  for (const [source, chars] of perSource) {
    const pkg = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(source);
    const key = pkg ? `node_modules/${pkg[1]}` : source;
    totals.set(key, (totals.get(key) ?? 0) + chars * scale);
  }
}
console.log(`\n${scripts.length} scripts, ${Math.round(totalGzip / 1024)} KB gzipped. Heaviest sources:`);
for (const [source, bytes] of [...totals].sort((a, b) => b[1] - a[1]).slice(0, top))
  console.log(`${String(Math.round(bytes / 102.4) / 10).padStart(6)} KB  ${source}`);

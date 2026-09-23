#!/usr/bin/env node
/**
 * Self-hosted fonts (runs in `predev` / `prebuild`).
 *
 * Reads the font pairs + monogram fonts of every pack template, picks the weights each role needs
 * (§9A.2), and for each family copies the matching @fontsource woff2 files (hebrew / latin /
 * latin-ext subsets only) to public/fonts/<id>/<version>/, then writes:
 *   - src/features/invitations/fonts/font-faces.generated.json  (faces + unicode-range + size-adjust)
 *   - src/styles/app-fonts.generated.css                         (the host app's Heebo, Inter + display fonts)
 * Font binaries are gitignored and regenerated on every build; the JSON/CSS are committed.
 * No request ever goes to Google Fonts (build or runtime).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = join(root, 'invitation-templates-pack');
const fontsourceDir = join(root, 'node_modules', '@fontsource');
const publicDir = join(root, 'public', 'fonts');
const jsonOut = join(root, 'src', 'features', 'invitations', 'fonts', 'font-faces.generated.json');
const appCssOut = join(root, 'src', 'styles', 'app-fonts.generated.css');

const SUBSETS = ['hebrew', 'latin', 'latin-ext'];

/** Optical size equalization between scripts (§9A.2 starting values). */
const SIZE_ADJUST = {
  'Amatic SC': '118%',
  Karantina: '115%',
  'Suez One': '92%',
  'Secular One': '92%',
  'Varela Round': '95%',
  'Playpen Sans Hebrew': '95%',
};

/** Weights per role and script. Hebrew never uses italics (§9A.2). */
const ROLE_VARIANTS = {
  display: { hebrew: [[400, 'normal']], latin: [[400, 'normal']] },
  heading: {
    hebrew: [
      [300, 'normal'],
      [400, 'normal'],
      [500, 'normal'],
    ],
    latin: [
      [400, 'normal'],
      [500, 'normal'],
      [400, 'italic'],
      [500, 'italic'],
    ],
  },
  body: {
    hebrew: [
      [400, 'normal'],
      [700, 'normal'],
    ],
    latin: [
      [400, 'normal'],
      [400, 'italic'],
      [700, 'normal'],
    ],
  },
  ui: {
    hebrew: [
      [400, 'normal'],
      [600, 'normal'],
      [700, 'normal'],
    ],
    latin: [
      [400, 'normal'],
      [600, 'normal'],
      [700, 'normal'],
    ],
  },
  monogram: { hebrew: [[400, 'normal']], latin: [[400, 'normal']] },
};

/** Host app (§9B.1): Heebo (HE) / Inter (EN); display headlines in Frank Ruhl Libre (HE) / Fraunces (EN). */
const APP_FAMILIES = {
  Heebo: [400, 500, 600, 700].map((w) => [w, 'normal']),
  Inter: [400, 500, 600, 700].map((w) => [w, 'normal']),
  'Frank Ruhl Libre': [500, 700].map((w) => [w, 'normal']),
  Fraunces: [500, 600].map((w) => [w, 'normal']),
};

const familyId = (family) => family.toLowerCase().replace(/\s+/g, '-');

function collectInvitationNeeds() {
  /** @type {Map<string, Set<string>>} family → "weight:style" */
  const needs = new Map();
  const add = (family, variants) => {
    const set = needs.get(family) ?? new Set();
    for (const [w, s] of variants) set.add(`${w}:${s}`);
    needs.set(family, set);
  };
  for (const id of readdirSync(packDir)) {
    const file = join(packDir, id, 'manifest.json');
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    for (const pair of manifest.fontPairs) {
      for (const role of ['display', 'heading', 'body', 'ui']) {
        add(pair[role].hebrew, ROLE_VARIANTS[role].hebrew);
        add(pair[role].latin, ROLE_VARIANTS[role].latin);
      }
    }
    add(manifest.cover.monogramFont.hebrew, ROLE_VARIANTS.monogram.hebrew);
    add(manifest.cover.monogramFont.latin, ROLE_VARIANTS.monogram.latin);
  }
  return needs;
}

function readMeta(family) {
  const dir = join(fontsourceDir, familyId(family));
  const metaFile = join(dir, 'metadata.json');
  if (!existsSync(metaFile)) {
    throw new Error(`Missing @fontsource/${familyId(family)} for "${family}" — add it to devDependencies.`);
  }
  const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  return { dir, meta, version: pkg.version };
}

const nearest = (available, weight) =>
  [...available].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight) || b - a)[0];

/** Parse one fontsource CSS file into { subset → { file, unicodeRange } }. */
function parseFaces(cssFile) {
  const css = readFileSync(cssFile, 'utf8');
  const faces = {};
  for (const block of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const body = block[1];
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim();
    const subset = file && SUBSETS.find((s) => file.includes(`-${s}-`));
    if (file && subset && !(subset === 'latin' && file.includes('-latin-ext-'))) {
      faces[subset] = { file, unicodeRange: range ?? null };
    }
  }
  // "latin" also matches "latin-ext" files above; resolve explicitly.
  for (const block of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const body = block[1];
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim();
    if (file?.includes('-latin-ext-')) faces['latin-ext'] = { file, unicodeRange: range ?? null };
    else if (file?.includes('-latin-')) faces.latin = { file, unicodeRange: range ?? null };
  }
  return faces;
}

function buildFamily(family, variants) {
  const { dir, meta, version } = readMeta(family);
  const subsets = SUBSETS.filter((s) => meta.subsets.includes(s));
  const weights = meta.weights;
  const faces = [];
  const seen = new Set();
  for (const variant of variants) {
    const [w, style] = variant.split(':');
    if (style === 'italic' && !meta.styles.includes('italic')) continue; // browser synthesizes
    const weight = nearest(weights, Number(w));
    const key = `${weight}:${style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cssFile = join(dir, `${weight}${style === 'italic' ? '-italic' : ''}.css`);
    const parsed = parseFaces(cssFile);
    for (const subset of subsets) {
      const face = parsed[subset];
      if (!face) continue;
      const outDir = join(publicDir, meta.id, version);
      mkdirSync(outDir, { recursive: true });
      const target = join(outDir, face.file);
      if (!existsSync(target)) copyFileSync(join(dir, 'files', face.file), target);
      faces.push({
        weight,
        style,
        subset,
        unicodeRange: face.unicodeRange,
        url: `/fonts/${meta.id}/${version}/${face.file}`,
      });
    }
  }
  faces.sort(
    (a, b) => a.weight - b.weight || a.style.localeCompare(b.style) || a.subset.localeCompare(b.subset),
  );
  return {
    id: meta.id,
    category: meta.category,
    subsets,
    sizeAdjust: SIZE_ADJUST[family] ?? null,
    faces,
  };
}

function faceCss(family, entry) {
  return entry.faces
    .map(
      (f) =>
        `@font-face{font-family:'${family}';font-style:${f.style};font-weight:${f.weight};font-display:swap;` +
        `src:url(${f.url}) format('woff2');` +
        (f.unicodeRange ? `unicode-range:${f.unicodeRange};` : '') +
        (entry.sizeAdjust ? `size-adjust:${entry.sizeAdjust};` : '') +
        '}',
    )
    .join('\n');
}

function writeIfChanged(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false;
  writeFileSync(file, content);
  return true;
}

const needs = collectInvitationNeeds();
const families = {};
for (const family of [...needs.keys()].sort()) families[family] = buildFamily(family, needs.get(family));

const app = {};
for (const [family, variants] of Object.entries(APP_FAMILIES)) {
  app[family] = buildFamily(
    family,
    variants.map(([w, s]) => `${w}:${s}`),
  );
}

const json = `${JSON.stringify({ generatedBy: 'scripts/build-fonts.mjs', families }, null, 2)}\n`;
const css =
  `/* Generated by scripts/build-fonts.mjs — host app fonts (§9B.1). Do not edit. */\n` +
  Object.entries(app)
    .map(([family, entry]) => faceCss(family, entry))
    .join('\n') +
  '\n';

const changed = [
  writeIfChanged(jsonOut, json) && jsonOut,
  writeIfChanged(appCssOut, css) && appCssOut,
].filter(Boolean);
const fileCount = Object.values({ ...families, ...app }).reduce((n, f) => n + f.faces.length, 0);
console.log(
  `✓ fonts: ${Object.keys(families).length} invitation families + ${Object.keys(app).length} app families, ` +
    `${fileCount} woff2 faces${changed.length ? ` (updated ${changed.map((f) => f.replace(root + '/', '')).join(', ')})` : ''}`,
);

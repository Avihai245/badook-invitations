#!/usr/bin/env node
/**
 * Self-hosted fonts (runs in `predev` / `prebuild`).
 *
 * Reads the font pairs + monogram fonts of every pack template and the font library's pairs
 * (src/features/invitations/fonts/library.json), picks the weights each role needs
 * (§9A.2), and for each family copies the matching @fontsource woff2 files to
 * public/fonts/<id>/<version>/ — a pair's families in their hebrew / latin / latin-ext / cyrillic /
 * cyrillic-ext subsets (those they have), and the fonts of the scripts a pair doesn't write
 * (fonts/scripts.json): a Cyrillic stand-in for a Latin family without Cyrillic, and the Arabic and
 * Ethiopic families, only in their own script's subset — then writes:
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
const libraryFile = join(root, 'src', 'features', 'invitations', 'fonts', 'library.json');
const scriptsFile = join(root, 'src', 'features', 'invitations', 'fonts', 'scripts.json');
const appCssOut = join(root, 'src', 'styles', 'app-fonts.generated.css');

/** The subsets a pair's own families are copied in (when they have them). */
const PAIR_SUBSETS = ['hebrew', 'latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'];
const SUBSETS = [...PAIR_SUBSETS, 'arabic', 'ethiopic'];
/** A Cyrillic stand-in, an Arabic or an Ethiopic family: only its own script. */
const SCRIPT_SUBSETS = { cyrillic: ['cyrillic', 'cyrillic-ext'], arabic: ['arabic'], ethiopic: ['ethiopic'] };
/** Arabic and Ethiopic text faces: a regular and a bold (300–500 fall on 400, 600–900 on 700). */
const SCRIPT_TEXT_VARIANTS = [
  [400, 'normal'],
  [700, 'normal'],
];

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
/**
 * The scripts neither has, which the live gallery's guest pages (and guest names) show: after them in
 * app.css's stacks, each downloaded only for its own letters (unicode-range).
 */
const APP_SCRIPT_FAMILIES = {
  Cairo: SCRIPT_SUBSETS.arabic,
  'Noto Sans Ethiopic': SCRIPT_SUBSETS.ethiopic,
};

const familyId = (family) => family.toLowerCase().replace(/\s+/g, '-');

function collectInvitationNeeds() {
  const scripts = JSON.parse(readFileSync(scriptsFile, 'utf8'));
  /** @type {Map<string, { variants: Set<string>, subsets: Set<string> }>} family → "weight:style", subsets */
  const needs = new Map();
  const add = (family, variants, subsets = PAIR_SUBSETS) => {
    const entry = needs.get(family) ?? { variants: new Set(), subsets: new Set() };
    for (const [w, s] of variants) entry.variants.add(`${w}:${s}`);
    for (const subset of subsets) entry.subsets.add(subset);
    needs.set(family, entry);
  };
  /** the fonts of the other scripts for one Latin family in one role (fonts/index.ts scriptFamily) */
  const addScripts = (latin, role) => {
    const standIn = scripts.cyrillic[latin];
    if (standIn) add(standIn, ROLE_VARIANTS[role].latin, SCRIPT_SUBSETS.cyrillic);
    const style = scripts.classes[latin] ?? 'serif';
    const face = role === 'display' || role === 'monogram' ? 'display' : 'text';
    const variants = face === 'display' ? [[400, 'normal']] : SCRIPT_TEXT_VARIANTS;
    add(scripts.arabic[style][face], variants, SCRIPT_SUBSETS.arabic);
    add(scripts.ethiopic[style][face], variants, SCRIPT_SUBSETS.ethiopic);
  };
  const addPair = (pair) => {
    for (const role of ['display', 'heading', 'body', 'ui']) {
      add(pair[role].hebrew, ROLE_VARIANTS[role].hebrew);
      add(pair[role].latin, ROLE_VARIANTS[role].latin);
      addScripts(pair[role].latin, role);
    }
  };
  for (const id of readdirSync(packDir)) {
    const file = join(packDir, id, 'manifest.json');
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    for (const pair of manifest.fontPairs) addPair(pair);
    add(manifest.cover.monogramFont.hebrew, ROLE_VARIANTS.monogram.hebrew);
    add(manifest.cover.monogramFont.latin, ROLE_VARIANTS.monogram.latin);
    addScripts(manifest.cover.monogramFont.latin, 'monogram');
  }
  // the font library: pairs any template can use
  for (const pair of JSON.parse(readFileSync(libraryFile, 'utf8')).pairs) addPair(pair);
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

/**
 * Parse one fontsource CSS file into { subset → { file, unicodeRange } }. Files are named
 * <id>-<subset>-<weight>-<style>.woff2, and the family id may itself contain a subset's name
 * ("noto-serif-hebrew-latin-400-normal.woff2"), so the subset is read after the id.
 */
function parseFaces(cssFile, id) {
  const css = readFileSync(cssFile, 'utf8');
  const faces = {};
  for (const block of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const body = block[1];
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim();
    const subset = file?.startsWith(`${id}-`)
      ? file.slice(id.length + 1).replace(/-\d+-(normal|italic)\.woff2$/, '')
      : null;
    if (file && SUBSETS.includes(subset)) faces[subset] = { file, unicodeRange: range ?? null };
  }
  return faces;
}

function buildFamily(family, variants, wanted = PAIR_SUBSETS) {
  const { dir, meta, version } = readMeta(family);
  const subsets = SUBSETS.filter((s) => wanted.includes(s) && meta.subsets.includes(s));
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
    const parsed = parseFaces(cssFile, meta.id);
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
for (const family of [...needs.keys()].sort()) {
  const { variants, subsets } = needs.get(family);
  families[family] = buildFamily(family, variants, [...subsets]);
}

const app = {};
for (const [family, variants] of Object.entries(APP_FAMILIES)) {
  app[family] = buildFamily(
    family,
    variants.map(([w, s]) => `${w}:${s}`),
  );
}
for (const [family, subsets] of Object.entries(APP_SCRIPT_FAMILIES)) {
  app[family] = buildFamily(family, ['400:normal', '500:normal', '600:normal', '700:normal'], subsets);
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

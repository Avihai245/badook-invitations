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
 *   - src/styles/app-fonts.generated.json                        (the app's variable files, for the layout's preloads)
 * Font binaries are gitignored and regenerated on every build; the JSON/CSS are committed.
 * No request ever goes to Google Fonts (build or runtime).
 *
 * "latin-basic": a Hebrew page's spaces, digits and punctuation — and every English page's letters — live
 * in each font's Latin file (12–39 KB a weight) with the accented letters, ligatures and symbols a page in
 * ASCII never shows. Each Latin face also gets its ASCII part (letters, digits, punctuation, the
 * typographic marks) cut out as a file of its own, about two thirds of the size; declared after the Latin
 * face, it wins for those characters and the whole Latin face downloads only for the rest.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = join(root, 'invitation-templates-pack');
const fontsourceDir = join(root, 'node_modules', '@fontsource');
const publicDir = join(root, 'public', 'fonts');
const jsonOut = join(root, 'src', 'features', 'invitations', 'fonts', 'font-faces.generated.json');
const libraryFile = join(root, 'src', 'features', 'invitations', 'fonts', 'library.json');
const scriptsFile = join(root, 'src', 'features', 'invitations', 'fonts', 'scripts.json');
const appCssOut = join(root, 'src', 'styles', 'app-fonts.generated.css');
const appJsonOut = join(root, 'src', 'styles', 'app-fonts.generated.json');
const fontsourceVariableDir = join(root, 'node_modules', '@fontsource-variable');

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
  'Frank Ruhl Libre': [500, 700].map((w) => [w, 'normal']),
  Fraunces: [500, 600].map((w) => [w, 'normal']),
};
/**
 * The app's text faces, Heebo and Inter, as variable fonts (@fontsource-variable): one file per script
 * covers every weight, where a file per weight — the home page uses four — made eight font requests
 * (68 KB) for Hebrew text with its digits and Latin letters, and ten for English. They are declared
 * as "<Family> Variable" (the stacks in theme.css name them), so the static faces the invitations
 * declare under the plain name never compete with them inside one document.
 */
const APP_VARIABLE_FAMILIES = ['Heebo', 'Inter'];
/**
 * The scripts neither has, which the live gallery's guest pages (and guest names) show: after them in
 * app.css's stacks, each downloaded only for its own letters (unicode-range).
 */
const APP_SCRIPT_FAMILIES = {
  Cairo: SCRIPT_SUBSETS.arabic,
  'Noto Sans Ethiopic': SCRIPT_SUBSETS.ethiopic,
};

/** The full fonts the combined Hebrew + ASCII files are cut from (see writeCombined). */
const FONT_SOURCES = join(root, 'scripts', 'font-sources');
const COMBINED = {
  Heebo: join(FONT_SOURCES, 'Heebo[wght].ttf'),
  'Frank Ruhl Libre': join(FONT_SOURCES, 'FrankRuhlLibre[wght].ttf'),
};

const familyId = (family) => family.toLowerCase().replace(/\s+/g, '-');

/** Bumped when the basic set changes (the file names carry it: nothing stale is reused). */
const BASIC_REV = 1;
/**
 * What a page in ASCII shows from the Latin file: the letters, digits and punctuation, NBSP, the
 * typographic marks (dashes, quotes, bullet, ellipsis, primes) and the signs beside numbers (€, ™, ©, ×, −).
 * Accented letters, ligatures and the rest stay in the full Latin face, fetched when a page has some.
 */
const BASIC_RANGES = [
  [0x20, 0x7e],
  [0xa0, 0xa0],
  [0xa9, 0xa9],
  [0xb7, 0xb7],
  [0xd7, 0xd7],
  [0x2011, 0x2015],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x2032, 0x2033],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2212, 0x2212],
];
/** The host app's variable text fonts are used from 400 to 800 (the static faces they replace were): a narrower axis, a lighter file. */
const WEIGHT_AXIS = { min: 400, max: 800 };

const expand = (ranges) => ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

/** The code points a font (TrueType / OpenType bytes) maps to a glyph — its cmap, formats 4 and 12. */
function cmapPoints(sfnt) {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
  const tables = view.getUint16(4);
  let cmap = -1;
  for (let i = 0; i < tables; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...[0, 1, 2, 3].map((k) => view.getUint8(at + k)));
    if (tag === 'cmap') cmap = view.getUint32(at + 8);
  }
  const points = new Set();
  if (cmap < 0) return points;
  for (let i = 0, n = view.getUint16(cmap + 2); i < n; i++) {
    const sub = cmap + view.getUint32(cmap + 4 + i * 8 + 4);
    const format = view.getUint16(sub);
    if (format === 4) {
      const segments = view.getUint16(sub + 6) / 2;
      const ends = sub + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const offsets = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const end = view.getUint16(ends + s * 2);
        const start = view.getUint16(starts + s * 2);
        const delta = view.getInt16(deltas + s * 2);
        const offset = view.getUint16(offsets + s * 2);
        for (let c = start; c <= end && c < 0xffff; c++) {
          const glyph =
            offset === 0 ? (c + delta) & 0xffff : view.getUint16(offsets + s * 2 + offset + (c - start) * 2);
          if (glyph) points.add(c);
        }
      }
    } else if (format === 12) {
      for (let g = 0, n = view.getUint32(sub + 12); g < n; g++) {
        const at = sub + 16 + g * 12;
        const start = view.getUint32(at);
        const end = view.getUint32(at + 4);
        const glyph = view.getUint32(at + 8);
        for (let c = start; c <= end; c++) if (glyph + (c - start)) points.add(c);
      }
    }
  }
  return points;
}

/** "U+0020-0040,U+0041-005A,…" for a set of code points. */
function unicodeRangeOf(points) {
  const sorted = [...points].sort((a, b) => a - b);
  const hex = (n) => `U+${n.toString(16).toUpperCase().padStart(4, '0')}`;
  const out = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(i === j ? hex(sorted[i]) : `${hex(sorted[i])}-${hex(sorted[j]).slice(2)}`);
    i = j + 1;
  }
  return out.join(',');
}

/**
 * The ASCII part of a Latin woff2 (written to `target`, next to it a `.range` file with what it holds, so a
 * later run reuses both): { unicodeRange } — null when the font has none of it. `axes` limits a variable
 * font's weight axis.
 */
async function writeBasic(source, target, { axes } = {}) {
  const rangeFile = `${target}.range`;
  if (existsSync(target) && existsSync(rangeFile)) return { unicodeRange: readFileSync(rangeFile, 'utf8') };
  const wanted = expand(BASIC_RANGES);
  const options = axes ? { variationAxes: { wght: axes } } : {};
  const input = readFileSync(source);
  const present = cmapPoints(
    await subsetFont(input, String.fromCodePoint(...wanted), { targetFormat: 'sfnt', ...options }),
  );
  const kept = wanted.filter((c) => present.has(c));
  if (!kept.length) return null;
  writeFileSync(
    target,
    await subsetFont(input, String.fromCodePoint(...kept), { targetFormat: 'woff2', ...options }),
  );
  const unicodeRange = unicodeRangeOf(kept);
  writeFileSync(rangeFile, unicodeRange);
  return { unicodeRange };
}

/** The code points of a `unicode-range` value. */
function pointsOfRange(range) {
  const out = [];
  for (const part of range.split(',')) {
    const m = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part.trim());
    if (!m) continue;
    const from = parseInt(m[1], 16);
    const to = m[2] ? parseInt(m[2], 16) : from;
    for (let c = from; c <= to; c++) out.push(c);
  }
  return out;
}

/**
 * A face's file with a narrower weight axis (for the host app's variable fonts): written to `target`
 * with the code points of its `unicode-range` that it has — the same face, lighter.
 */
async function writeNarrowed(source, target, unicodeRange, axes) {
  if (existsSync(target)) return;
  const input = readFileSync(source);
  const text = String.fromCodePoint(...pointsOfRange(unicodeRange));
  writeFileSync(
    target,
    await subsetFont(input, text, { targetFormat: 'woff2', variationAxes: { wght: axes } }),
  );
}

/**
 * The home page's text needs Hebrew and the ASCII letters and digits in the same font, which the font
 * sources ship as two files per family (a script each): the full font (scripts/font-sources, the OFL files of
 * Google Fonts), cut to both at once, is one file and one request. `pin`: a number picks one weight of a
 * variable font, {min,max} narrows its axis. Returns { unicodeRange } of what the file holds.
 */
async function writeCombined(source, target, hebrewRange, pin) {
  const rangeFile = `${target}.range`;
  if (existsSync(target) && existsSync(rangeFile)) return { unicodeRange: readFileSync(rangeFile, 'utf8') };
  const input = readFileSync(source);
  const options = { variationAxes: { wght: pin } };
  const wanted = [...new Set([...pointsOfRange(hebrewRange), ...expand(BASIC_RANGES)])].sort((a, b) => a - b);
  const present = cmapPoints(
    await subsetFont(input, String.fromCodePoint(...wanted), { targetFormat: 'sfnt', ...options }),
  );
  const kept = wanted.filter((c) => present.has(c));
  writeFileSync(
    target,
    await subsetFont(input, String.fromCodePoint(...kept), { targetFormat: 'woff2', ...options }),
  );
  const unicodeRange = unicodeRangeOf(kept);
  writeFileSync(rangeFile, unicodeRange);
  return { unicodeRange };
}

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

async function buildFamily(family, variants, wanted = PAIR_SUBSETS) {
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
      // the Latin face's ASCII part, as a file of its own (declared after it)
      if (subset === 'latin') {
        const name = face.file.replace(/-latin-/, `-latin-basic${BASIC_REV}-`);
        const cut = await writeBasic(join(dir, 'files', face.file), join(outDir, name));
        if (cut)
          faces.push({
            weight,
            style,
            subset: 'latin-basic',
            unicodeRange: cut.unicodeRange,
            url: `/fonts/${meta.id}/${version}/${name}`,
          });
      }
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

/**
 * A @fontsource-variable family (one weight-axis file per script) — its faces copied to /fonts, in the same
 * shape as buildFamily's. They are declared for the weights the app uses (WEIGHT_AXIS: 400–800, as the static
 * faces they replace were — a request for 300 or 900 lands on the nearest, as before), the Hebrew and the
 * ASCII Latin ones are cut to that axis, and the ASCII part is a face of its own after the whole Latin one.
 */
async function buildVariableFamily(family, wanted = PAIR_SUBSETS) {
  const id = familyId(family);
  const dir = join(fontsourceVariableDir, id);
  const cssFile = join(dir, 'wght.css');
  if (!existsSync(cssFile)) {
    throw new Error(`Missing @fontsource-variable/${id} for "${family}" — add it to devDependencies.`);
  }
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const css = readFileSync(cssFile, 'utf8');
  const weight = `${WEIGHT_AXIS.min} ${WEIGHT_AXIS.max}`;
  const outDir = join(publicDir, `${id}-variable`, version);
  mkdirSync(outDir, { recursive: true });
  const faces = [];
  for (const block of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const body = block[1];
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? null;
    const subset = file?.startsWith(`${id}-`)
      ? file.slice(id.length + 1).replace(/-wght-normal\.woff2$/, '')
      : null;
    if (!file || !subset || !wanted.includes(subset)) continue;
    const source = join(dir, 'files', file);
    // Hebrew is cut to the app's weights; the other scripts' files are rarely fetched: as they are
    let name = file;
    if (subset === 'hebrew' && range) {
      name = file.replace(/-wght-/, `-w${WEIGHT_AXIS.min}-${WEIGHT_AXIS.max}-`);
      await writeNarrowed(source, join(outDir, name), range, WEIGHT_AXIS);
    } else if (!existsSync(join(outDir, file))) copyFileSync(source, join(outDir, file));
    faces.push({
      weight,
      style: 'normal',
      subset,
      unicodeRange: range,
      url: `/fonts/${id}-variable/${version}/${name}`,
    });
    // the Latin file's ASCII part (letters, digits, punctuation) as a file of its own, after the whole one
    if (subset === 'latin') {
      const basic = file
        .replace(/-latin-/, `-latin-basic${BASIC_REV}-`)
        .replace(/-wght-/, `-w${WEIGHT_AXIS.min}-${WEIGHT_AXIS.max}-`);
      const cut = await writeBasic(source, join(outDir, basic), { axes: WEIGHT_AXIS });
      if (cut)
        faces.push({
          weight,
          style: 'normal',
          subset: 'latin-basic',
          unicodeRange: cut.unicodeRange,
          url: `/fonts/${id}-variable/${version}/${basic}`,
        });
    }
  }
  faces.sort((a, b) => a.subset.localeCompare(b.subset));
  const hebrew = faces.find((f) => f.subset === 'hebrew');
  if (COMBINED[family] && hebrew?.unicodeRange) {
    // Hebrew and the ASCII part in one file, declared last: the page's text is one request, not two
    const name = `${id}-hebrew-basic${BASIC_REV}-w${WEIGHT_AXIS.min}-${WEIGHT_AXIS.max}-normal.woff2`;
    const cut = await writeCombined(COMBINED[family], join(outDir, name), hebrew.unicodeRange, WEIGHT_AXIS);
    faces.splice(
      0,
      faces.length,
      ...faces.filter((f) => f.subset !== 'hebrew' && f.subset !== 'latin-basic'),
      {
        weight,
        style: 'normal',
        subset: 'hebrew-basic',
        unicodeRange: cut.unicodeRange,
        url: `/fonts/${id}-variable/${version}/${name}`,
      },
    );
  }
  return { id: `${id}-variable`, subsets: faces.map((f) => f.subset), sizeAdjust: null, faces };
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
  families[family] = await buildFamily(family, variants, [...subsets]);
}

const app = {};
for (const [family, variants] of Object.entries(APP_FAMILIES)) {
  app[family] = await buildFamily(
    family,
    variants.map(([w, s]) => `${w}:${s}`),
  );
  // the display font's Hebrew and ASCII parts as one file per weight (the headline is both)
  if (COMBINED[family]) {
    const entry = app[family];
    for (const weight of [...new Set(entry.faces.map((f) => f.weight))]) {
      const hebrew = entry.faces.find((f) => f.weight === weight && f.subset === 'hebrew');
      if (!hebrew?.unicodeRange) continue;
      const [, , , version] = hebrew.url.split('/');
      const name = `${entry.id}-hebrew-basic${BASIC_REV}-${weight}-normal.woff2`;
      const cut = await writeCombined(
        COMBINED[family],
        join(publicDir, entry.id, version, name),
        hebrew.unicodeRange,
        weight,
      );
      entry.faces = [
        ...entry.faces.filter(
          (f) => f.weight !== weight || (f.subset !== 'hebrew' && f.subset !== 'latin-basic'),
        ),
        {
          weight,
          style: 'normal',
          subset: 'hebrew-basic',
          unicodeRange: cut.unicodeRange,
          url: `/fonts/${entry.id}/${version}/${name}`,
        },
      ];
    }
    // per weight: the combined face after the rest of its weight
    entry.faces.sort(
      (a, b) =>
        a.weight - b.weight ||
        (a.subset === 'hebrew-basic') - (b.subset === 'hebrew-basic') ||
        a.subset.localeCompare(b.subset),
    );
  }
}
for (const [family, subsets] of Object.entries(APP_SCRIPT_FAMILIES)) {
  app[family] = await buildFamily(family, ['400:normal', '500:normal', '600:normal', '700:normal'], subsets);
}
for (const family of APP_VARIABLE_FAMILIES) app[`${family} Variable`] = await buildVariableFamily(family);

const json = `${JSON.stringify({ generatedBy: 'scripts/build-fonts.mjs', families }, null, 2)}\n`;
const css =
  `/* Generated by scripts/build-fonts.mjs — host app fonts (§9B.1). Do not edit. */\n` +
  Object.entries(app)
    .map(([family, entry]) => faceCss(family, entry))
    .join('\n') +
  '\n';

// the variable files by family and subset, for the layout's font preloads
const appJson = `${JSON.stringify(
  {
    generatedBy: 'scripts/build-fonts.mjs',
    static: Object.fromEntries(
      Object.keys(COMBINED)
        .filter((family) => app[family])
        .map((family) => [
          family,
          Object.fromEntries(
            app[family].faces
              .filter((f) => f.subset === 'hebrew-basic')
              .map((f) => [String(f.weight), f.url]),
          ),
        ]),
    ),
    variable: Object.fromEntries(
      APP_VARIABLE_FAMILIES.map((family) => [
        `${family} Variable`,
        Object.fromEntries(app[`${family} Variable`].faces.map((f) => [f.subset, f.url])),
      ]),
    ),
  },
  null,
  2,
)}\n`;

const changed = [
  writeIfChanged(jsonOut, json) && jsonOut,
  writeIfChanged(appCssOut, css) && appCssOut,
  writeIfChanged(appJsonOut, appJson) && appJsonOut,
].filter(Boolean);
const fileCount = Object.values({ ...families, ...app }).reduce((n, f) => n + f.faces.length, 0);
console.log(
  `✓ fonts: ${Object.keys(families).length} invitation families + ${Object.keys(app).length} app families, ` +
    `${fileCount} woff2 faces${changed.length ? ` (updated ${changed.map((f) => f.replace(root + '/', '')).join(', ')})` : ''}`,
);

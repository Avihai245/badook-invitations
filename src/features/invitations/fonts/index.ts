import type { FontPair, Locale, TemplateManifest } from '../contracts/types';
import { LOCALE_INFO, scriptsOf, type Script } from '../lib/locales';
import generated from './font-faces.generated.json';
import measured from './font-metrics.generated.json';
import { FONT_LIBRARY, findFontPair } from './library';
import scriptFonts from './scripts.json';

export type FontRole = 'display' | 'heading' | 'body' | 'ui';

interface FontFace {
  weight: number;
  style: string;
  subset: string;
  unicodeRange: string | null;
  url: string;
}
interface FamilyEntry {
  id: string;
  category: string;
  subsets: string[];
  sizeAdjust: string | null;
  faces: FontFace[];
}

const FAMILIES = generated.families as Record<string, FamilyEntry>;

const GENERIC: Record<string, string> = {
  serif: 'serif',
  'sans-serif': 'sans-serif',
  handwriting: 'cursive',
  display: 'serif',
  monospace: 'monospace',
};

// ─── the scripts a pair doesn't write (fonts/scripts.json, also read by scripts/build-fonts.mjs) ──

type FontStyle = 'script' | 'serif' | 'sans' | 'playful';
const SCRIPT_FONTS = scriptFonts as unknown as {
  classes: Record<string, FontStyle>;
  cyrillic: Record<string, string>;
  arabic: Record<FontStyle, { display: string; text: string }>;
  ethiopic: Record<FontStyle, { display: string; text: string }>;
};

/** The subsets of each script a page declares (the browser downloads a face only for text in it). */
const SCRIPT_SUBSETS: Record<Script, readonly string[]> = {
  latin: ['latin', 'latin-ext'],
  hebrew: ['hebrew'],
  cyrillic: ['cyrillic', 'cyrillic-ext'],
  arabic: ['arabic'],
  ethiopic: ['ethiopic'],
};

const hasSubset = (family: string, subset: string) => !!FAMILIES[family]?.subsets.includes(subset);

/**
 * The family that writes `script` for a Latin family in a role: the Latin family itself when it has
 * the Cyrillic letters, else its Cyrillic stand-in; the Arabic and Ethiopic faces of its style (a
 * calligraphic Ruqaa for script names, Amiri / Naskh for serifs, Kufi for sans, Cairo for playful
 * designs; Noto Serif / Sans Ethiopic). null for Latin and Hebrew (the pair's own).
 */
export function scriptFamily(latin: string, role: FontRole | 'monogram', script: Script): string | null {
  const style = SCRIPT_FONTS.classes[latin] ?? 'serif';
  const face = role === 'display' || role === 'monogram' ? 'display' : 'text';
  switch (script) {
    case 'cyrillic':
      return hasSubset(latin, 'cyrillic') ? null : (SCRIPT_FONTS.cyrillic[latin] ?? null);
    case 'arabic':
      return SCRIPT_FONTS.arabic[style][face];
    case 'ethiopic':
      return SCRIPT_FONTS.ethiopic[style][face];
    default:
      return null;
  }
}

/**
 * Whether a page set in the Latin family `latin` has a face for `script` in that role: its own
 * letters (Latin, Hebrew comes from the pair's Hebrew family, Cyrillic when the family has it) or
 * the fallback family of fonts/scripts.json — which must exist and write that script.
 */
export function writesScript(latin: string, role: FontRole | 'monogram', script: Script): boolean {
  if (script === 'latin' || script === 'hebrew') return true;
  if (script === 'cyrillic' && hasSubset(latin, 'cyrillic')) return true;
  const family = scriptFamily(latin, role, script);
  return !!family && hasSubset(family, SCRIPT_SUBSETS[script][0]!);
}

/** §5: `fontFor(role, locale)` → the family that writes the locale's script in that role. */
export function fontFor(pair: FontPair, role: FontRole, locale: Locale): string {
  const script = LOCALE_INFO[locale].script;
  if (script === 'hebrew') return pair[role].hebrew;
  return scriptFamily(pair[role].latin, role, script) ?? pair[role].latin;
}

/** The families a script's text is set in, first to last (before the other scripts' and a generic). */
function ownFamilies(latin: string, hebrew: string, role: FontRole | 'monogram', script: Script) {
  switch (script) {
    case 'hebrew':
      return [hebrew, latin];
    case 'latin':
      return [latin, hebrew];
    // the design's Latin face first (its Cyrillic when it has it), the stand-in for the letters it lacks
    case 'cyrillic':
      return [latin, scriptFamily(latin, role, script), hebrew];
    default:
      return [scriptFamily(latin, role, script), latin, hebrew];
  }
}

/**
 * CSS font-family stack: the locale's script first (the pair's own family, a Cyrillic stand-in, the
 * Arabic or Ethiopic face of the design's style), then the pair's Latin and Hebrew families, then the
 * faces of the document's other scripts (a Russian name in the Hebrew text keeps a designed face),
 * then a generic. Every face has a unicode-range: a character takes the first family that has it —
 * a stand-in, an Arabic or an Ethiopic family declares only its own script (pageFontFaces).
 */
export function fontStack(
  pair: FontPair,
  role: FontRole,
  locale: Locale,
  scripts: readonly Script[] = [LOCALE_INFO[locale].script],
): string {
  const { latin, hebrew } = pair[role];
  const own = LOCALE_INFO[locale].script;
  const families = [
    ...ownFamilies(latin, hebrew, role, own),
    ...scripts.filter((s) => s !== own).map((s) => scriptFamily(latin, role, s)),
  ].filter((f): f is string => !!f);
  const generic =
    role === 'ui'
      ? 'system-ui, sans-serif'
      : (GENERIC[FAMILIES[fontFor(pair, role, locale)]?.category ?? 'serif'] ?? 'serif');
  return [...new Set(families)].map((f) => `"${f}"`).join(', ') + `, ${generic}`;
}

export function monogramStack(
  template: TemplateManifest,
  locale: Locale,
  scripts: readonly Script[] = [LOCALE_INFO[locale].script],
): string {
  const { latin, hebrew } = template.cover.monogramFont;
  const own = LOCALE_INFO[locale].script;
  const families = [
    ...ownFamilies(latin, hebrew, 'monogram', own),
    ...scripts.filter((s) => s !== own).map((s) => scriptFamily(latin, 'monogram', s)),
  ].filter((f): f is string => !!f);
  return [...new Set(families)].map((f) => `"${f}"`).join(', ') + ', serif';
}

/** A pair's families: every role, both scripts. */
export function pairFontFamilies(pair: FontPair): string[] {
  const set = new Set<string>();
  for (const role of ['display', 'heading', 'body', 'ui'] as const) {
    set.add(pair[role].latin);
    set.add(pair[role].hebrew);
  }
  return [...set];
}

/**
 * Families a template can use: all its pairs (the editor can switch) — or only the pair `pairId`
 * names, one of its own or one from the font library — plus the monogram fonts.
 */
export function templateFontFamilies(template: TemplateManifest, pairId?: string): string[] {
  const found = pairId ? findFontPair(template, pairId) : undefined;
  const pairs = pairId ? (found ? [found] : []) : template.fontPairs;
  const set = new Set(pairs.flatMap(pairFontFamilies));
  set.add(template.cover.monogramFont.latin);
  set.add(template.cover.monogramFont.hebrew);
  return [...set];
}

/** A family and the subsets (and weights) of it a page declares. */
export interface FaceRequest {
  family: string;
  /** absent: every subset the family has */
  subsets?: readonly string[];
  /** absent: every weight */
  weights?: readonly number[];
}

/**
 * The faces an invitation page declares for its languages: the pair's (and the monogram's)
 * families in the subsets of those languages' scripts — and, for a script the pair doesn't write,
 * its stand-in / Arabic / Ethiopic families in that script only. A Hebrew + English page declares
 * what it always has; Cyrillic, Arabic or Ethiopic faces only appear with a language that needs them.
 */
export function pageFontFaces(
  template: TemplateManifest,
  pairId: string | undefined,
  locales: readonly Locale[],
): FaceRequest[] {
  const scripts = new Set<Script>(['latin', 'hebrew', ...scriptsOf(locales)]);
  // the pair's own families write Latin, Hebrew and (most of them) Cyrillic — never Arabic or Ethiopic
  const subsets = [...scripts]
    .filter((s) => s === 'latin' || s === 'hebrew' || s === 'cyrillic')
    .flatMap((s) => SCRIPT_SUBSETS[s]);
  const out = new Map<string, Set<string>>();
  const add = (family: string, list: readonly string[]) => {
    const set = out.get(family) ?? new Set<string>();
    for (const s of list) set.add(s);
    out.set(family, set);
  };
  for (const family of templateFontFamilies(template, pairId)) add(family, subsets);
  const found = pairId ? findFontPair(template, pairId) : undefined;
  const pairs = pairId ? (found ? [found] : []) : template.fontPairs;
  for (const script of scripts) {
    if (script === 'latin' || script === 'hebrew') continue;
    for (const pair of pairs)
      for (const role of ['display', 'heading', 'body', 'ui'] as const) {
        const f = scriptFamily(pair[role].latin, role, script);
        if (f) add(f, SCRIPT_SUBSETS[script]);
      }
    const mono = scriptFamily(template.cover.monogramFont.latin, 'monogram', script);
    if (mono) add(mono, SCRIPT_SUBSETS[script]);
  }
  return [...out].map(([family, set]) => ({ family, subsets: [...set] }));
}

/** The font library's display faces — what its pickers write each pair's name in. */
export function libraryDisplayFamilies(): string[] {
  return [...new Set(FONT_LIBRARY.flatMap((p) => [p.display.hebrew, p.display.latin]))];
}

/**
 * @font-face rules for the given families (only what a page needs, inlined into <head>): a family's
 * name for all its faces, or a FaceRequest for some subsets / weights; `weights` keeps only those
 * weights for every family (e.g. [400] for text that is never bold).
 */
/** A face's file (its woff2 under /fonts), or null when the build has no such face. */
export function faceUrl(family: string, subset: string, weight: number): string | null {
  return (
    FAMILIES[family]?.faces.find((f) => f.subset === subset && f.weight === weight && f.style === 'normal')
      ?.url ?? null
  );
}

export function fontFaceCss(families: Iterable<string | FaceRequest>, weights?: readonly number[]): string {
  const rules: string[] = [];
  for (const item of families) {
    const request = typeof item === 'string' ? { family: item } : item;
    const entry = FAMILIES[request.family];
    if (!entry) continue;
    const only = request.weights ?? weights;
    for (const f of entry.faces) {
      if (only && !only.includes(f.weight)) continue;
      if (request.subsets && !request.subsets.includes(f.subset)) continue;
      rules.push(
        `@font-face{font-family:'${request.family}';font-style:${f.style};font-weight:${f.weight};font-display:swap;` +
          `src:url(${f.url}) format('woff2');` +
          (f.unicodeRange ? `unicode-range:${f.unicodeRange};` : '') +
          (entry.sizeAdjust ? `size-adjust:${entry.sizeAdjust};` : '') +
          '}',
      );
    }
  }
  return rules.join('\n');
}

const METRICS = (measured as { emPerChar: Record<string, { latin: number; hebrew: number }> }).emPerChar;
/**
 * Average advance per character of the scripts measure-display-fonts doesn't cover, relative to the
 * font size: Cyrillic runs a little wider than Latin; joined Arabic narrower; each Ethiopic syllable
 * is a wide, square glyph. FitNames corrects the estimate once the fonts are in.
 */
const SCRIPT_EM: Partial<Record<Script, number>> = { arabic: 0.5, ethiopic: 0.82 };
const CYRILLIC_WIDER = 1.08;

/**
 * Average advance width (em per character) of the locale's display font, measured in a browser by
 * scripts/measure-display-fonts.ts — used to auto-fit long names (+5% safety margin).
 */
export function displayEmPerChar(pair: FontPair, locale: Locale): number {
  const script = LOCALE_INFO[locale].script;
  let em: number;
  if (script === 'hebrew') em = METRICS[pair.display.hebrew]?.hebrew ?? 0.55;
  else if (script === 'latin') em = METRICS[pair.display.latin]?.latin ?? 0.55;
  else if (script === 'cyrillic') em = (METRICS[pair.display.latin]?.latin ?? 0.55) * CYRILLIC_WIDER;
  else em = SCRIPT_EM[script] ?? 0.55;
  return Math.round(em * 1.05 * 1000) / 1000;
}

/** The subset a locale's text is mostly in (what its display font preloads). */
const PRELOAD_SUBSET: Record<Script, string> = {
  hebrew: 'hebrew',
  latin: 'latin',
  cyrillic: 'cyrillic',
  arabic: 'arabic',
  ethiopic: 'ethiopic',
};

/** Only the active locale's display font is preloaded (§5 Fonts) — in its script's subset. */
export function displayFontPreloads(pair: FontPair, locale: Locale): string[] {
  const script = LOCALE_INFO[locale].script;
  const entry = FAMILIES[fontFor(pair, 'display', locale)];
  if (!entry) return [];
  const subset = entry.subsets.includes(PRELOAD_SUBSET[script]) ? PRELOAD_SUBSET[script] : 'latin';
  const face =
    entry.faces.find((f) => f.subset === subset && f.weight === 400 && f.style === 'normal') ??
    entry.faces.find((f) => f.subset === subset);
  return face ? [face.url] : [];
}

/** A family's font files (woff2 URLs under /fonts, as served to browsers). */
export function fontFaceFiles(family: string): readonly FontFace[] {
  return FAMILIES[family]?.faces ?? [];
}

export function hasFamily(family: string): boolean {
  return family in FAMILIES;
}

import type { FontPair, Locale, TemplateManifest } from '../contracts/types';
import generated from './font-faces.generated.json';
import measured from './font-metrics.generated.json';
import { FONT_LIBRARY, findFontPair } from './library';

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

/** §5: `fontFor(role, locale)` → `pair[role].hebrew` for he, `.latin` otherwise. */
export function fontFor(pair: FontPair, role: FontRole, locale: Locale): string {
  return locale === 'he' ? pair[role].hebrew : pair[role].latin;
}

/** CSS font-family stack: the script's font, then the pair's other-script font, then a generic. */
export function fontStack(pair: FontPair, role: FontRole, locale: Locale): string {
  const primary = fontFor(pair, role, locale);
  const other = locale === 'he' ? pair[role].latin : pair[role].hebrew;
  const generic =
    role === 'ui' ? 'system-ui, sans-serif' : (GENERIC[FAMILIES[primary]?.category ?? 'serif'] ?? 'serif');
  return [...new Set([primary, other])].map((f) => `"${f}"`).join(', ') + `, ${generic}`;
}

export function monogramStack(template: TemplateManifest, locale: Locale): string {
  const { latin, hebrew } = template.cover.monogramFont;
  const primary = locale === 'he' ? hebrew : latin;
  return (
    [...new Set([primary, locale === 'he' ? latin : hebrew])].map((f) => `"${f}"`).join(', ') + ', serif'
  );
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

/** The font library's display faces — what its pickers write each pair's name in. */
export function libraryDisplayFamilies(): string[] {
  return [...new Set(FONT_LIBRARY.flatMap((p) => [p.display.hebrew, p.display.latin]))];
}

/**
 * @font-face rules for the given families (only what a page needs, inlined into <head>); `weights`
 * keeps only those weights (e.g. [400] for text that is never bold).
 */
export function fontFaceCss(families: Iterable<string>, weights?: readonly number[]): string {
  const rules: string[] = [];
  for (const family of families) {
    const entry = FAMILIES[family];
    if (!entry) continue;
    for (const f of entry.faces) {
      if (weights && !weights.includes(f.weight)) continue;
      rules.push(
        `@font-face{font-family:'${family}';font-style:${f.style};font-weight:${f.weight};font-display:swap;` +
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
 * Average advance width (em per character) of the locale's display font, measured in a browser by
 * scripts/measure-display-fonts.ts — used to auto-fit long names (+5% safety margin).
 */
export function displayEmPerChar(pair: FontPair, locale: Locale): number {
  const m = METRICS[fontFor(pair, 'display', locale)];
  const em = m ? (locale === 'he' ? m.hebrew : m.latin) : 0.55;
  return Math.round(em * 1.05 * 1000) / 1000;
}

/** Only the active locale's display font is preloaded (§5 Fonts). */
export function displayFontPreloads(pair: FontPair, locale: Locale): string[] {
  const entry = FAMILIES[fontFor(pair, 'display', locale)];
  if (!entry) return [];
  const subset = locale === 'he' && entry.subsets.includes('hebrew') ? 'hebrew' : 'latin';
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

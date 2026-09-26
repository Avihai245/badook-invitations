/**
 * Font pairing suggestions (the editor's Fonts panel): three pairs — from the template's own and the
 * font library — that fit the invitation's colors (their mood) and its kind of event. Each pair's
 * character is read from its display face (the names and titles: what sets the tone) and softened
 * by its text face; the target character comes from the event type and the palette. Three different
 * styles are offered, not three shades of one. Pure and isomorphic.
 */
import type { EventType, FontPair, Palette, TemplateManifest } from '../contracts/types';
import { FONT_LIBRARY, type LibraryFontPair } from '../fonts/library';
import { hexToOklch } from './photo-palette';
import { relativeLuminance } from './contrast';

/** A face's character: how formal, playful and heavy it reads, and its family of styles. */
export interface FontCharacter {
  style: 'script' | 'serif' | 'sans' | 'display' | 'hand' | 'mono';
  formal: number;
  playful: number;
  bold: number;
}

/** The display faces the templates and the library use (a face not listed: by its category). */
const FACES: Record<string, FontCharacter> = {
  'Great Vibes': { style: 'script', formal: 0.85, playful: 0.25, bold: 0.15 },
  'Pinyon Script': { style: 'script', formal: 0.9, playful: 0.2, bold: 0.1 },
  'Petit Formal Script': { style: 'script', formal: 0.9, playful: 0.2, bold: 0.1 },
  Allura: { style: 'script', formal: 0.8, playful: 0.3, bold: 0.1 },
  Italianno: { style: 'script', formal: 0.8, playful: 0.3, bold: 0.05 },
  Ballet: { style: 'script', formal: 0.75, playful: 0.35, bold: 0.2 },
  'Cormorant Garamond': { style: 'serif', formal: 0.85, playful: 0.1, bold: 0.15 },
  'EB Garamond': { style: 'serif', formal: 0.8, playful: 0.1, bold: 0.2 },
  Cinzel: { style: 'serif', formal: 0.95, playful: 0.05, bold: 0.4 },
  'Cinzel Decorative': { style: 'serif', formal: 0.9, playful: 0.15, bold: 0.45 },
  'Bodoni Moda': { style: 'serif', formal: 0.85, playful: 0.1, bold: 0.45 },
  'Playfair Display': { style: 'serif', formal: 0.8, playful: 0.15, bold: 0.45 },
  'DM Serif Display': { style: 'serif', formal: 0.7, playful: 0.2, bold: 0.6 },
  Marcellus: { style: 'serif', formal: 0.85, playful: 0.1, bold: 0.3 },
  Italiana: { style: 'serif', formal: 0.85, playful: 0.15, bold: 0.05 },
  Fraunces: { style: 'serif', formal: 0.6, playful: 0.35, bold: 0.55 },
  'Young Serif': { style: 'serif', formal: 0.55, playful: 0.35, bold: 0.55 },
  Gloock: { style: 'serif', formal: 0.65, playful: 0.25, bold: 0.65 },
  'IM Fell English': { style: 'serif', formal: 0.75, playful: 0.2, bold: 0.35 },
  'Yeseva One': { style: 'display', formal: 0.6, playful: 0.35, bold: 0.7 },
  'Abril Fatface': { style: 'display', formal: 0.45, playful: 0.5, bold: 0.9 },
  Limelight: { style: 'display', formal: 0.5, playful: 0.45, bold: 0.7 },
  Monoton: { style: 'display', formal: 0.2, playful: 0.8, bold: 0.7 },
  Righteous: { style: 'display', formal: 0.25, playful: 0.7, bold: 0.75 },
  'Titan One': { style: 'display', formal: 0.1, playful: 0.9, bold: 0.95 },
  Atma: { style: 'display', formal: 0.15, playful: 0.85, bold: 0.6 },
  'Big Shoulders Display': { style: 'display', formal: 0.35, playful: 0.4, bold: 0.85 },
  'Bebas Neue': { style: 'display', formal: 0.35, playful: 0.45, bold: 0.85 },
  Unbounded: { style: 'sans', formal: 0.25, playful: 0.6, bold: 0.9 },
  Syne: { style: 'sans', formal: 0.4, playful: 0.5, bold: 0.7 },
  Jost: { style: 'sans', formal: 0.55, playful: 0.3, bold: 0.4 },
  Outfit: { style: 'sans', formal: 0.45, playful: 0.45, bold: 0.5 },
  Quicksand: { style: 'sans', formal: 0.3, playful: 0.7, bold: 0.35 },
  Fredoka: { style: 'sans', formal: 0.05, playful: 0.95, bold: 0.6 },
  'Amatic SC': { style: 'hand', formal: 0.1, playful: 0.9, bold: 0.2 },
  Caveat: { style: 'hand', formal: 0.1, playful: 0.85, bold: 0.3 },
  'Shantell Sans': { style: 'hand', formal: 0.1, playful: 0.9, bold: 0.45 },
  'Special Elite': { style: 'mono', formal: 0.3, playful: 0.5, bold: 0.3 },
  'Space Mono': { style: 'mono', formal: 0.35, playful: 0.45, bold: 0.4 },
};

const BY_CATEGORY: Record<string, FontCharacter> = {
  serif: { style: 'serif', formal: 0.75, playful: 0.2, bold: 0.35 },
  'sans-serif': { style: 'sans', formal: 0.45, playful: 0.4, bold: 0.45 },
  handwriting: { style: 'hand', formal: 0.35, playful: 0.7, bold: 0.25 },
  display: { style: 'display', formal: 0.35, playful: 0.55, bold: 0.75 },
  monospace: { style: 'mono', formal: 0.35, playful: 0.45, bold: 0.35 },
};

/** A pair's character: its Latin display face's (the one the scale knows), else a serif's. */
export function characterOf(pair: Pick<FontPair, 'display'>, category?: (family: string) => string | null) {
  return (
    FACES[pair.display.latin] ??
    FACES[pair.display.hebrew] ??
    BY_CATEGORY[category?.(pair.display.latin) ?? 'serif'] ??
    BY_CATEGORY.serif!
  );
}

/** What the invitation asks for: formal, playful, bold (0..1). */
export interface Mood {
  formal: number;
  playful: number;
  bold: number;
}

const EVENT_MOOD: Record<EventType, Mood> = {
  wedding: { formal: 0.82, playful: 0.2, bold: 0.2 },
  engagement: { formal: 0.72, playful: 0.3, bold: 0.25 },
  save_the_date: { formal: 0.75, playful: 0.28, bold: 0.25 },
  henna: { formal: 0.55, playful: 0.45, bold: 0.5 },
  bar_mitzvah: { formal: 0.55, playful: 0.4, bold: 0.55 },
  bat_mitzvah: { formal: 0.55, playful: 0.45, bold: 0.4 },
  brit: { formal: 0.55, playful: 0.4, bold: 0.25 },
  baby_shower: { formal: 0.35, playful: 0.65, bold: 0.3 },
  birthday: { formal: 0.3, playful: 0.7, bold: 0.6 },
  corporate: { formal: 0.6, playful: 0.2, bold: 0.5 },
  other: { formal: 0.5, playful: 0.4, bold: 0.4 },
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The mood of an invitation: its event type's, moved by its colors — a dark palette is an evening
 * (more formal, heavier), a vivid accent is playful, near-grey colors are quiet luxury.
 */
export function moodOf(eventType: EventType, palette: Pick<Palette, 'bg' | 'accent'>): Mood {
  const m = { ...EVENT_MOOD[eventType] };
  const accent = hexToOklch(palette.accent);
  const bg = hexToOklch(palette.bg);
  if (relativeLuminance(palette.bg) < 0.2) {
    m.formal += 0.08;
    m.bold += 0.15;
  }
  if (accent.C > 0.13) {
    m.playful += 0.2;
    m.formal -= 0.1;
  } else if (accent.C < 0.05 && bg.C < 0.03) {
    m.formal += 0.12;
    m.playful -= 0.12;
  }
  return { formal: clamp01(m.formal), playful: clamp01(m.playful), bold: clamp01(m.bold) };
}

/** The word the editor shows for a suggestion's character. */
export type MoodLabel = 'elegant' | 'classic' | 'modern' | 'playful' | 'bold';

export function moodLabel(c: FontCharacter): MoodLabel {
  if (c.playful >= 0.7) return 'playful';
  if (c.bold >= 0.75) return 'bold';
  if (c.style === 'script' || (c.formal >= 0.8 && c.bold <= 0.2)) return 'elegant';
  if (c.style === 'serif' && c.formal >= 0.6) return 'classic';
  return 'modern';
}

export interface FontSuggestion {
  pair: FontPair | LibraryFontPair;
  /** the template's own pair, or one from the font library */
  source: 'template' | 'library';
  label: MoodLabel;
  score: number;
}

/**
 * Three pairs for the invitation, best first and of different styles; the pair it already uses
 * isn't suggested. `category`: a family's category (fonts/font-faces.generated.json) for faces the
 * scale doesn't know.
 */
export function suggestFontPairs(
  template: Pick<TemplateManifest, 'fontPairs'>,
  input: { eventType: EventType; palette: Pick<Palette, 'bg' | 'accent'>; current?: string | null },
  { count = 3, category }: { count?: number; category?: (family: string) => string | null } = {},
): FontSuggestion[] {
  const mood = moodOf(input.eventType, input.palette);
  const candidates = [
    ...template.fontPairs.map((pair) => ({ pair, source: 'template' as const })),
    ...FONT_LIBRARY.map((pair) => ({ pair, source: 'library' as const })),
  ].filter((c) => c.pair.id !== input.current);
  const scored = candidates.map((c) => {
    const ch = characterOf(c.pair, category);
    const d =
      (ch.formal - mood.formal) ** 2 + (ch.playful - mood.playful) ** 2 + 0.6 * (ch.bold - mood.bold) ** 2;
    // the design's own pairs were drawn for it: a small head start
    const score = -d + (c.source === 'template' ? 0.03 : 0);
    return { ...c, ch, score };
  });
  const out: FontSuggestion[] = [];
  const styles = new Map<string, number>();
  while (out.length < count && scored.length) {
    // a style already offered counts a little against the next of its kind
    let best = 0;
    let bestScore = -Infinity;
    for (const [i, c] of scored.entries()) {
      const s = c.score - 0.06 * (styles.get(c.ch.style) ?? 0);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    const [c] = scored.splice(best, 1);
    if (!c) break;
    styles.set(c.ch.style, (styles.get(c.ch.style) ?? 0) + 1);
    out.push({
      pair: c.pair,
      source: c.source,
      label: moodLabel(c.ch),
      score: Math.round(c.score * 1000) / 1000,
    });
  }
  return out;
}

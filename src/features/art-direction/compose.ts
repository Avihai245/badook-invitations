/**
 * Three design concepts without the AI (no key, an error, the day's limit reached): composed from the
 * photos' colors (lib/photo-palette), the font pairs that suit the event and the palette
 * (lib/font-suggest) and the templates made for the event, scored by how well they fit the photos and
 * the host's mood — so the studio always answers. Deterministic: the same photos and words give the
 * same three concepts. Pure and isomorphic.
 */
import type { Palette, TemplateManifest } from '../invitations/contracts/types';
import { dictFor, fmt } from '@/lib/i18n/app';
import {
  hexToOklch,
  hueDistance,
  photoPalettes,
  type PhotoPaletteId,
  type Swatch,
} from '../invitations/lib/photo-palette';
import { moodLabel, characterOf, suggestFontPairs } from '../invitations/lib/font-suggest';
import { findFontPair } from '../invitations/fonts/library';
import { getTemplate, type TemplateEntry } from '../invitations/templates/registry';
import {
  candidateTemplates,
  photographic,
  toneOf,
  type MotionMood,
  type PhotoSlot,
  type Tone as PaletteTone,
} from './catalog';
import { headlineCopy, type Tone } from './copy';
import type { Concept, ConceptInput, ConceptPlacement } from './model';
import { conceptPalette } from './model';

/** The three profiles the composer designs in: a classic, a lively and a calm one. */
interface Profile {
  tone: Tone;
  motion: MotionMood;
  palettes: readonly PhotoPaletteId[];
  slots: readonly { slot: PhotoSlot; layout: ConceptPlacement['layout'] }[];
}
const PROFILES: readonly Profile[] = [
  {
    tone: 'classic',
    motion: 'gentle',
    palettes: ['light', 'tinted', 'dark'],
    slots: [
      { slot: 'story', layout: 'split_start' },
      { slot: 'quote', layout: 'full_bleed' },
      { slot: 'band', layout: 'parallax' },
      { slot: 'rsvp', layout: 'stack' },
    ],
  },
  {
    tone: 'warm',
    motion: 'lively',
    palettes: ['tinted', 'dark', 'light'],
    slots: [
      { slot: 'quote', layout: 'parallax' },
      { slot: 'story', layout: 'full_bleed' },
      { slot: 'when', layout: 'full_bleed' },
      { slot: 'band', layout: 'parallax' },
    ],
  },
  {
    tone: 'playful',
    motion: 'calm',
    palettes: ['dark', 'light', 'tinted'],
    slots: [
      { slot: 'story', layout: 'stack' },
      { slot: 'when', layout: 'split_end' },
      { slot: 'band', layout: 'full_bleed' },
      { slot: 'quote', layout: 'full_bleed' },
    ],
  },
];

/**
 * A mood's words → what they ask of a design: words in its name and description (`traits`), maybe a
 * tone. A mood word matches when it starts with one of `words` (so "beaches" and "שקיעות" count).
 */
const MOOD_WORDS: readonly { words: readonly string[]; traits: readonly string[]; tone?: PaletteTone }[] = [
  {
    words: ['beach', 'sea', 'ocean', 'shore', 'ים', 'חוף', 'ימי'],
    traits: ['sea', 'shore', 'waves', 'ocean', 'mediterranean', 'tropical'],
  },
  {
    words: ['sunset', 'dusk', 'golden hour', 'שקיע', 'שעת זהב', 'דמדומ'],
    traits: ['dusk', 'sunset', 'golden hour', 'evening'],
  },
  {
    words: ['garden', 'nature', 'flower', 'bloom', 'botanic', 'גן', 'גינ', 'טבע', 'פרח', 'פריח', 'בוטני'],
    traits: ['garden', 'bloom', 'blossom', 'meadow', 'almond', 'vineyard', 'flowers', 'leaves'],
  },
  {
    words: ['night', 'evening', 'dark', 'moody', 'לילה', 'ערב', 'כהה'],
    traits: ['night', 'midnight', 'dusk', 'onyx'],
    tone: 'dark',
  },
  {
    words: ['light', 'airy', 'bright', 'white', 'בהיר', 'אוורירי', 'לבן'],
    traits: ['airy', 'white', 'light', 'minimal'],
    tone: 'light',
  },
  {
    words: ['gold', 'glam', 'luxur', 'זהב', 'יוקר', 'נוצץ'],
    traits: ['gold', 'golden', 'gatsby', 'deco', 'sparkl'],
  },
  {
    words: ['modern', 'minimal', 'clean', 'מודרני', 'מינימל', 'נקי'],
    traits: ['minimal', 'modern', 'clean', 'gallery', 'bauhaus'],
  },
  { words: ['romantic', 'love', 'רומנט', 'אהבה'], traits: ['rose', 'bloom', 'love', 'romantic', 'hearts'] },
  {
    words: ['vintage', 'retro', 'רטרו', 'וינטג'],
    traits: ['retro', 'vintage', 'vinyl', 'deco', '80s', 'twenties'],
  },
  {
    words: ['jerusalem', 'tradition', 'ירושלים', 'מסורת'],
    traits: ['jerusalem', 'stone', 'torah', 'tallit', 'scroll'],
  },
  { words: ['desert', 'rustic', 'מדבר', 'כפרי'], traits: ['ramon', 'desert', 'dusk', 'rustic', 'harvest'] },
  {
    words: ['city', 'urban', 'rooftop', 'עיר', 'אורבני', 'גג'],
    traits: ['rooftop', 'city', 'urban', 'skyline'],
  },
  {
    words: ['fun', 'playful', 'party', 'color', 'colour', 'כיף', 'שמח', 'צבעוני', 'מסיב'],
    traits: ['party', 'confetti', 'balloons', 'neon', 'disco'],
  },
];

/** The mood's words, lower case (a Hebrew prefix letter — ו ה ב ל מ ש כ — off a longer word too). */
function moodTokens(mood: string): string[] {
  const words = mood
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const out = new Set<string>();
  for (const w of words) {
    out.add(w);
    if (/^[והבלמשכ]\p{L}{2,}$/u.test(w)) out.add(w.slice(1));
  }
  // two-word wishes ("golden hour", "שעת זהב") count as one
  for (let i = 0; i + 1 < words.length; i++) out.add(`${words[i]} ${words[i + 1]}`);
  return [...out];
}

const fnv = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The photos' colors together, the lead photo (the hero's) counting double. */
function allSwatches(input: ConceptInput): Swatch[] {
  const out: Swatch[] = [];
  input.photos.forEach((p, i) => {
    const weight = (i === 0 ? 2 : 1) / (input.photos.length + 1);
    for (const s of p.swatches) out.push({ ...s, share: s.share * weight });
  });
  return out.sort((a, b) => b.share - a.share);
}

/** How the photos read: dark (an evening) or light, and their most vivid hue. */
function photoMood(swatches: readonly Swatch[]) {
  const total = swatches.reduce((n, s) => n + s.share, 0) || 1;
  const L = swatches.reduce((n, s) => n + s.L * s.share, 0) / total;
  const vivid = swatches.filter((s) => s.C >= 0.05).sort((a, b) => b.C * b.share - a.C * a.share)[0];
  return { tone: (L < 0.45 ? 'dark' : 'light') as PaletteTone, hue: vivid?.h ?? null, chroma: vivid?.C ?? 0 };
}

/** How well a design fits the photos, the event and the host's words (higher is better). */
export function scoreTemplate(
  entry: TemplateEntry,
  input: ConceptInput,
  swatches: readonly Swatch[],
): number {
  const m = entry.manifest;
  const mood = photoMood(swatches);
  let score = m.categories[0] === input.eventType ? 0.3 : 0.1;
  if (photographic(m)) score += 0.35;
  const accent = hexToOklch(m.tokens.palette.accent);
  if (mood.hue !== null)
    score += 0.4 * (1 - hueDistance(accent.h, mood.hue) / 180) * Math.min(1, mood.chroma * 8);
  if (toneOf(m.tokens.palette) === mood.tone) score += mood.tone === 'dark' ? 0.15 : 0.1;
  const text = `${m.id} ${m.name.en ?? ''} ${m.name.he ?? ''} ${m.description.en ?? ''}`.toLowerCase();
  const tokens = moodTokens(input.mood);
  let words = 0;
  for (const w of MOOD_WORDS) {
    if (!tokens.some((t) => w.words.some((x) => t.startsWith(x)))) continue;
    // the host asked for it: stronger than any hint the photos give
    if (w.traits.some((x) => text.includes(x))) words += 0.45;
    if (w.tone && toneOf(m.tokens.palette) === w.tone) words += 0.25;
  }
  score += Math.min(0.9, words);
  // ties: the same photos always break them the same way
  const sig = swatches
    .slice(0, 3)
    .map((s) => s.hex)
    .join('');
  return score + (fnv(`${m.id}:${sig}`) % 1000) / 100_000;
}

/**
 * Designs of different character where the event has them: each pick after the first loses a little
 * for every earlier pick of the same tone and cover — a clearly better fit still wins.
 */
function pickTemplates(ranked: readonly { e: TemplateEntry; s: number }[], count: number): TemplateEntry[] {
  const picked: TemplateEntry[] = [];
  const pool = [...ranked];
  while (picked.length < count && pool.length) {
    const like = (e: TemplateEntry) =>
      picked.filter(
        (p) =>
          toneOf(p.manifest.tokens.palette) === toneOf(e.manifest.tokens.palette) &&
          p.manifest.cover.style === e.manifest.cover.style,
      ).length;
    let best = 0;
    for (let i = 1; i < pool.length; i++)
      if (pool[i]!.s - 0.25 * like(pool[i]!.e) > pool[best]!.s - 0.25 * like(pool[best]!.e)) best = i;
    picked.push(pool[best]!.e);
    pool.splice(best, 1);
  }
  return picked;
}

/** The opening a profile gets for an event: the design's own, a door or curtain, a burst of light. */
function openingFor(k: number, m: TemplateManifest, input: ConceptInput): Concept['opening'] {
  if (!input.cinematic) return 'envelope';
  if (k === 0) return m.cover.opening?.preset ?? 'envelope';
  const festive = ['birthday', 'corporate', 'other'].includes(input.eventType);
  if (k === 1) return festive ? 'curtain' : 'gate';
  return festive ? 'fireworks' : 'gold_dust';
}

/**
 * `count` concepts (three by default) — avoiding the templates of `avoid` (concepts already chosen)
 * where the event has others. In the host's language (names, reasons).
 */
export function composeConcepts(
  input: ConceptInput,
  count = 3,
  avoid: readonly Pick<Concept, 'templateId' | 'fontPairId'>[] = input.avoid ?? [],
): Concept[] {
  const swatches = allSwatches(input);
  let pool = candidateTemplates(input.eventType, input.locales, input.access);
  if (!pool.length && input.current) {
    const own = getTemplate(input.current.templateId);
    if (own) pool = [own];
  }
  if (!pool.length) return [];
  const taken = new Set(avoid.map((c) => c.templateId));
  const fresh = pool.filter((e) => !taken.has(e.manifest.id));
  const ranked = (fresh.length ? fresh : pool)
    .map((e) => ({ e, s: scoreTemplate(e, input, swatches) }))
    .sort((a, b) => b.s - a.s || a.e.manifest.id.localeCompare(b.e.manifest.id));
  const templates = pickTemplates(ranked, count);
  // fewer designs than concepts: the best one again, differently
  while (templates.length < count)
    templates.push(templates[templates.length % Math.max(1, templates.length)]!);

  const t = dictFor(input.uiLocale).studio.composer;
  const lead = input.photos[0]?.swatches ?? swatches;
  const usedFonts = new Set<string>(avoid.map((c) => c.fontPairId));
  const out: Concept[] = [];
  templates.forEach((entry, i) => {
    const k = (avoid.length + i) % PROFILES.length;
    const profile = PROFILES[k]!;
    const m = entry.manifest;
    const editable = m.tokens.editablePaletteKeys;
    const options = lead.length ? photoPalettes(lead, { palette: m.tokens.palette, editable }) : [];
    const option = profile.palettes.map((id) => options.find((o) => o.id === id)).find(Boolean) ?? null;
    const palette: Palette = option ? option.palette : conceptPalette(undefined, m.id);
    const suggestions = suggestFontPairs(m, {
      eventType: input.eventType,
      palette,
      current: input.current?.fontPairId ?? null,
    });
    const font =
      suggestions.find((s) => !usedFonts.has(s.pair.id))?.pair ?? suggestions[0]?.pair ?? m.fontPairs[0]!;
    usedFonts.add(font.id);
    const placements: ConceptPlacement[] = [];
    if (input.cinematic) {
      let photo = 1;
      for (const s of profile.slots) {
        if (photo >= input.photos.length) break;
        placements.push({ slot: s.slot, photo, layout: s.layout });
        photo++;
      }
    }
    const opening = openingFor(k, m, input);
    const character = moodLabel(characterOf(findFontPair(m, font.id) ?? font));
    out.push({
      id: `c${avoid.length + i + 1}`,
      name: fmt(t.name, {
        template: m.name[input.uiLocale] ?? m.name.en ?? m.id,
        palette: t.palettes[option?.id ?? 'design'],
      }),
      rationale: fmt(t.rationale, {
        palette: t.paletteWhy[option?.id ?? 'design'],
        fonts: t.fonts[character],
        opening: t.openings[opening],
        motion: t.motions[profile.motion],
      }),
      templateId: m.id,
      palette,
      fontPairId: font.id,
      opening,
      motion: profile.motion,
      heroPhoto: 0,
      placements,
      copy: headlineCopy(input.eventType, profile.tone, input.locales),
      source: 'composer',
    });
  });
  return out;
}

/**
 * A design concept (feature `art_direction`): a complete look for an invitation — a template, a
 * palette (repaired to WCAG AA), a font pair, an opening, where each photo goes and in which layout,
 * how much it moves, a short headline in the invitation's languages — with a one-line reason. Made by
 * the AI (its JSON answer, validated here and held to what the product really has) or by the composer
 * (compose.ts) when there is no AI. Pure and isomorphic.
 */
import { z } from 'zod';
import {
  OPENING_PRESETS,
  PALETTE_KEYS,
  type EventType,
  type L10n,
  type Locale,
  type OpeningPreset,
  type Palette,
  type SectionLayout,
} from '../invitations/contracts/types';
import { CAPS } from '../invitations/contracts/validate';
import { findFontPair } from '../invitations/fonts/library';
import { repairPalette, type Swatch } from '../invitations/lib/photo-palette';
import { getTemplate } from '../invitations/templates/registry';
import { ART_DIRECTION } from './config';
import {
  MOTION_MOODS,
  PHOTO_SLOTS,
  candidateTemplates,
  slotLayouts,
  type Access,
  type MotionMood,
  type PhotoSlot,
} from './catalog';

export interface ConceptPlacement {
  slot: PhotoSlot;
  /** index into the photos */
  photo: number;
  layout: SectionLayout;
}

export interface Concept {
  /** 'c1' | 'c2' | 'c3' */
  id: string;
  /** a short name (the host's language) */
  name: string;
  /** why it fits, in one line (the host's language) */
  rationale: string;
  templateId: string;
  /** every key; the template's editable ones take it */
  palette: Palette;
  fontPairId: string;
  opening: OpeningPreset;
  motion: MotionMood;
  /** the photo the hero shows */
  heroPhoto: number;
  placements: ConceptPlacement[];
  /** the hero's eyebrow and the footer's closing line, in every language of the invitation (null: as is) */
  copy: { eyebrow: L10n | null; closing: L10n | null };
  source: 'ai' | 'composer';
}

/** What the device learned about a photo (lib/photo-palette) — the photo itself stays out of it. */
export interface PhotoInfo {
  swatches: Swatch[];
  focal: { x: number; y: number };
  /** the scrim light text needs over it */
  scrim: number;
  width: number;
  height: number;
}

/** What a set of concepts is made for. */
export interface ConceptInput {
  eventType: EventType;
  locales: Locale[];
  /** the host's app language: the concepts' names and reasons */
  uiLocale: 'he' | 'en';
  /** the host's mood in a few words ('' = none) */
  mood: string;
  photos: PhotoInfo[];
  access: Access;
  /** the event has `cinematic`: sections' photos, layouts, motion and openings may be used */
  cinematic: boolean;
  /** the editor: the invitation's design now (the concepts differ from it) */
  current?: { templateId: string; fontPairId: string } | null;
}

// ─── the wire: what the API takes and answers ────────────────────────────────────────────────────

const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const SwatchSchema = z.strictObject({
  hex: Hex,
  share: z.number().min(0).max(1),
  L: z.number().min(0).max(1.01),
  C: z.number().min(0).max(0.5),
  h: z.number().min(0).max(360),
});
export const PhotoInfoSchema = z.strictObject({
  swatches: z.array(SwatchSchema).max(8),
  focal: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  scrim: z.number().min(0).max(1),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
});

const L10nOut = z.record(z.string(), z.string());

/** A concept as it travels back to the browser (and is checked again before use). */
export const ConceptSchema = z.strictObject({
  id: z.string().min(1).max(8),
  name: z.string().max(ART_DIRECTION.nameMax * 2),
  rationale: z.string().max(ART_DIRECTION.rationaleMax * 2),
  templateId: z.string().min(1),
  palette: z.strictObject(
    Object.fromEntries(PALETTE_KEYS.map((k) => [k, Hex])) as Record<keyof Palette, typeof Hex>,
  ),
  fontPairId: z.string().min(1),
  opening: z.enum(OPENING_PRESETS),
  motion: z.enum(MOTION_MOODS),
  heroPhoto: z.number().int().min(0),
  placements: z.array(
    z.strictObject({
      slot: z.enum(PHOTO_SLOTS),
      photo: z.number().int().min(0),
      layout: z.enum(['stack', 'full_bleed', 'split_start', 'split_end', 'parallax', 'video_bg']),
    }),
  ),
  copy: z.strictObject({ eyebrow: L10nOut.nullable(), closing: L10nOut.nullable() }),
  source: z.enum(['ai', 'composer']),
});

// ─── the AI's answer ─────────────────────────────────────────────────────────────────────────────

/** Lenient on shape (the checks that matter come after): whatever looks like the concepts. */
const AnswerConcept = z.object({
  name: z.string().optional(),
  rationale: z.string().optional(),
  templateId: z.string().optional(),
  palette: z.record(z.string(), z.unknown()).optional(),
  fontPairId: z.string().optional(),
  opening: z.string().optional(),
  motion: z.string().optional(),
  heroPhoto: z.number().optional(),
  placements: z
    .array(z.object({ slot: z.string(), photo: z.number(), layout: z.string() }).loose())
    .optional(),
  copy: z
    .object({
      eyebrow: z.record(z.string(), z.unknown()).nullable().optional(),
      closing: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .loose()
    .optional(),
});
export const AnswerSchema = z.object({ concepts: z.array(AnswerConcept).min(1).max(6) });
export type Answer = z.infer<typeof AnswerSchema>;

/** The model's text → its JSON answer (the whole text, or the outermost {...} in it); null when not. */
export function parseAnswer(text: string): Answer | null {
  const candidates = [text.trim()];
  const brace = /\{[\s\S]*\}/.exec(text);
  if (brace) candidates.push(brace[0]);
  for (const c of candidates) {
    try {
      const parsed = AnswerSchema.safeParse(JSON.parse(c));
      if (parsed.success) return parsed.data;
    } catch {
      // not JSON: the next
    }
  }
  return null;
}

// ─── holding a concept to what the product has ───────────────────────────────────────────────────

const clampText = (s: string | undefined, max: number) =>
  (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

/** Every language of the invitation, trimmed and within `max` — else null (the line stays as it is). */
function copyLine(raw: Record<string, unknown> | null | undefined, locales: readonly Locale[], max: number) {
  if (!raw) return null;
  const out: L10n = {};
  for (const l of locales) {
    const v = raw[l];
    if (typeof v !== 'string') return null;
    const t = v.replace(/\s+/g, ' ').trim();
    if (!t || [...t].length > max) return null;
    out[l] = t;
  }
  return out;
}

/** A concept's palette: the template's own where the AI left a key out; every text pair at AA. */
export function conceptPalette(raw: Record<string, unknown> | undefined, templateId: string): Palette {
  const t = getTemplate(templateId)!.manifest;
  const base = t.tokens.palette;
  const merged = Object.fromEntries(
    PALETTE_KEYS.map((k) => {
      const v = raw?.[k];
      return [k, typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : base[k]];
    }),
  ) as unknown as Palette;
  // the template's fixed colors are its own; what may change is repaired around them
  const editable = new Set(t.tokens.editablePaletteKeys);
  const fixed = Object.fromEntries(
    PALETTE_KEYS.map((k) => [k, editable.has(k) ? merged[k] : base[k]]),
  ) as unknown as Palette;
  return repairPalette(fixed, editable);
}

/**
 * One concept of the AI's answer, held to the product: a template open to the host (else null — the
 * composer fills its place), a palette repaired to AA, a font pair the design can take, an opening,
 * placements in slots and layouts that exist (one per slot but the bands, photos that exist), the copy
 * in every language within its length, the texts short.
 */
export function sanitizeConcept(
  raw: Answer['concepts'][number],
  index: number,
  input: ConceptInput,
): Concept | null {
  const allowed = new Set(
    candidateTemplates(input.eventType, input.locales, input.access).map((e) => e.manifest.id),
  );
  const templateId = raw.templateId?.trim() ?? '';
  if (!allowed.has(templateId)) return null;
  const manifest = getTemplate(templateId)!.manifest;
  const photos = input.photos.length;
  const inRange = (n: number | undefined) =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < photos;
  const fontPairId =
    raw.fontPairId && findFontPair(manifest, raw.fontPairId) ? raw.fontPairId : manifest.fontPairs[0]!.id;
  const opening = (OPENING_PRESETS as readonly string[]).includes(raw.opening ?? '')
    ? (raw.opening as OpeningPreset)
    : 'envelope';
  const motion = (MOTION_MOODS as readonly string[]).includes(raw.motion ?? '')
    ? (raw.motion as MotionMood)
    : 'gentle';
  const heroPhoto = inRange(raw.heroPhoto) ? raw.heroPhoto! : 0;
  const seen = new Set<string>();
  let bands = 0;
  const placements: ConceptPlacement[] = [];
  for (const p of raw.placements ?? []) {
    if (!(PHOTO_SLOTS as readonly string[]).includes(p.slot) || !inRange(p.photo)) continue;
    const slot = p.slot as PhotoSlot;
    if (slot === 'band' ? bands >= ART_DIRECTION.maxBands : seen.has(slot)) continue;
    const layouts = slotLayouts(slot);
    const layout = (layouts as readonly string[]).includes(p.layout)
      ? (p.layout as SectionLayout)
      : (layouts[1] ?? layouts[0] ?? 'stack');
    if (slot === 'band') bands++;
    seen.add(slot);
    placements.push({ slot, photo: p.photo, layout });
    if (placements.length >= 6) break;
  }
  return {
    id: `c${index + 1}`,
    name: clampText(raw.name, ART_DIRECTION.nameMax) || manifest.name[input.uiLocale] || manifest.id,
    rationale: clampText(raw.rationale, ART_DIRECTION.rationaleMax),
    templateId,
    palette: conceptPalette(raw.palette, templateId),
    fontPairId,
    // without the `cinematic` feature: the design's own cover, no photos in sections
    opening: input.cinematic ? opening : 'envelope',
    motion,
    heroPhoto,
    placements: input.cinematic ? placements : [],
    copy: {
      eyebrow: copyLine(raw.copy?.eyebrow, input.locales, CAPS.eyebrow),
      closing: copyLine(raw.copy?.closing, input.locales, CAPS.subtitle),
    },
    source: 'ai',
  };
}

/**
 * Three concepts from the AI's answer: the valid ones, each on a template of its own when the event
 * has three to choose from (a repeat is dropped); `fill` makes the missing ones (the composer).
 */
export function conceptsFromAnswer(
  answer: Answer,
  input: ConceptInput,
  fill: (count: number, avoid: readonly Concept[]) => Concept[],
): Concept[] {
  const variety = candidateTemplates(input.eventType, input.locales, input.access).length >= 3;
  const kept: Concept[] = [];
  for (const raw of answer.concepts) {
    if (kept.length === 3) break;
    const c = sanitizeConcept(raw, kept.length, input);
    if (!c) continue;
    if (variety && kept.some((k) => k.templateId === c.templateId)) continue;
    if (kept.some((k) => sameLook(k, c))) continue;
    kept.push(c);
  }
  if (kept.length < 3) kept.push(...fill(3 - kept.length, kept));
  return kept.slice(0, 3).map((c, i) => ({ ...c, id: `c${i + 1}` }));
}

/** Two concepts a host couldn't tell apart. */
export const sameLook = (a: Concept, b: Concept) =>
  a.templateId === b.templateId &&
  a.palette.accent === b.palette.accent &&
  a.palette.bg === b.palette.bg &&
  a.opening === b.opening &&
  a.fontPairId === b.fontPairId;

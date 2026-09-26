/**
 * What the product really has to design with — the templates an invitation may use, their openings,
 * layouts, font pairs and motion — as the design studio (the AI's brief and the composer) sees it.
 * Pure and isomorphic.
 */
import {
  OPENING_PRESETS,
  type EventType,
  type Locale,
  type OpeningPreset,
  type Palette,
  type SectionLayout,
  type SectionType,
  type TemplateManifest,
} from '../invitations/contracts/types';
import { LAYOUTS_BY_TYPE } from '../invitations/editor/presentation';
import { FONT_LIBRARY } from '../invitations/fonts/library';
import { relativeLuminance } from '../invitations/lib/contrast';
import { characterOf, moodLabel, type MoodLabel } from '../invitations/lib/font-suggest';
import { TEMPLATES, type TemplateEntry } from '../invitations/templates/registry';
import { isPremiumTemplate } from '../invitations/templates/tier';

/** Where a concept may put a photo besides the hero ("band": a picture band it adds). */
export const PHOTO_SLOTS = [
  'story',
  'quote',
  'when',
  'where',
  'venues',
  'countdown',
  'parents',
  'rsvp',
  'band',
] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

/** The section type each slot is (story: the text section of kind story; band: a picture band). */
export const SLOT_TYPE: Record<PhotoSlot, SectionType> = {
  story: 'text',
  quote: 'quote',
  when: 'when',
  where: 'where',
  venues: 'venues',
  countdown: 'countdown',
  parents: 'parents',
  rsvp: 'rsvp',
  band: 'custom',
};

/** The layouts a photo may take in a slot (a photo: never the video background). */
export const slotLayouts = (slot: PhotoSlot): readonly SectionLayout[] =>
  LAYOUTS_BY_TYPE[SLOT_TYPE[slot]].filter((l) => l !== 'video_bg');

/** How much the invitation moves: calm (little), gentle (as designed), lively (more). */
export const MOTION_MOODS = ['calm', 'gentle', 'lively'] as const;
export type MotionMood = (typeof MOTION_MOODS)[number];

export const OPENINGS: readonly OpeningPreset[] = OPENING_PRESETS;

/** Who may use what: the unlisted designs are the admins'; premium ones need a plan that has them. */
export interface Access {
  admin: boolean;
  premium: boolean;
}

/**
 * The templates an invitation of `eventType` in `locales` may use: made for that event, in those
 * languages, and open to this host. Gallery order.
 */
export function candidateTemplates(
  eventType: EventType,
  locales: readonly Locale[],
  access: Access,
): TemplateEntry[] {
  return [...TEMPLATES.values()].filter(
    ({ manifest: m }) =>
      m.categories.includes(eventType) &&
      locales.every((l) => m.supportsLocales.includes(l)) &&
      (m.listed || access.admin) &&
      (!isPremiumTemplate(m) || access.premium),
  );
}

/** A design's own photographs: a photographic design (Lumière) is made to carry photos. */
export const photographic = (m: Pick<TemplateManifest, 'sectionDefaults' | 'cover'>): boolean =>
  Object.values(m.sectionDefaults.presentation ?? {}).some((p) => !!p.media) ||
  m.cover.opening?.backdrop === 'hero';

export type Tone = 'light' | 'dark';
export const toneOf = (p: Pick<Palette, 'bg'>): Tone => (relativeLuminance(p.bg) < 0.2 ? 'dark' : 'light');

/** A template as the AI's brief lists it. */
export interface TemplateBrief {
  id: string;
  name: string;
  description: string;
  categories: EventType[];
  tier: 'standard' | 'premium';
  tone: Tone;
  palette: Palette;
  /** the colors the host may change (the others are the design's) */
  editableColors: (keyof Palette)[];
  fontPairs: { id: string; character: MoodLabel }[];
  /** its own cover (the `envelope` opening) */
  cover: string;
  /** made to carry photos */
  photographic: boolean;
}

export function templateBrief(m: TemplateManifest, lang: 'he' | 'en' = 'en'): TemplateBrief {
  return {
    id: m.id,
    name: m.name[lang] ?? m.name.en ?? m.id,
    description: m.description.en ?? m.description[lang] ?? '',
    categories: m.categories,
    tier: m.tier,
    tone: toneOf(m.tokens.palette),
    palette: m.tokens.palette,
    editableColors: m.tokens.editablePaletteKeys,
    fontPairs: m.fontPairs.map((p) => ({ id: p.id, character: moodLabel(characterOf(p)) })),
    cover: m.cover.style,
    photographic: photographic(m),
  };
}

/** The font library (pairs any design may use), as the brief lists it. */
export const libraryBrief = () =>
  FONT_LIBRARY.map((p) => ({ id: p.id, name: p.name.en, character: moodLabel(characterOf(p)) }));

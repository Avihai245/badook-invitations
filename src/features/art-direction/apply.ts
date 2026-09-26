/**
 * Using a design concept: the invitation moves to the concept's template while keeping everything the
 * host wrote (names, dates, places, texts, RSVP) — only what belongs to a design is carried over or
 * reset (its palette keys, fonts, seal, cover hint, music, pictures) — then the concept's palette,
 * fonts, opening, photos, layouts, motion and headline are applied. Pure: the editor applies the
 * result as one undo step; the wizard applies it to the new invitation's seeded draft.
 */
import type {
  AssetRef,
  InvitationDocument,
  L10n,
  Locale,
  Palette,
  Section,
  SectionLayout,
  TemplateDefaults,
  TemplateManifest,
} from '../invitations/contracts/types';
import {
  applyDocPalette,
  seededHints,
  setOpening,
  setSectionAnimation,
  setSectionLayout,
  setSectionMedia,
  setThemeTokens,
  type AnimationPatch,
} from '../invitations/editor/presentation';
import { insertAt, uniqueId } from '../invitations/editor/paths';
import { findFontPair } from '../invitations/fonts/library';
import { graphemes, visibleGlyphCount } from '../invitations/lib/text';
import type { TemplateEntry } from '../invitations/templates/registry';
import { resolveEventDefaults, v2Section } from '../invitations/templates/seed-document';
import { ART_DIRECTION } from './config';
import { SLOT_TYPE, type MotionMood, type PhotoSlot } from './catalog';
import type { Concept } from './model';

/** A photo a concept places: where it is (an upload, a template picture, or a `blob:` preview). */
export interface ConceptPhoto {
  ref: AssetRef;
  focal: { x: number; y: number };
  /** the scrim light text needs over it (lib/photo-palette scrimForPhoto) */
  scrim: number;
}

const isTemplateRef = (ref: string | null | undefined) => !!ref && ref.startsWith('template:');

/** Every language's text of `value` equals `other`'s (the design's seeded copy, left as it was). */
function sameText(
  value: L10n | null | undefined,
  other: L10n | null | undefined,
  locales: readonly Locale[],
) {
  if (!value || !other) return false;
  return locales.every((l) => (value[l] ?? '').trim() === (other[l] ?? '').trim());
}

const pick = (value: L10n, locales: readonly Locale[]): L10n =>
  Object.fromEntries(locales.flatMap((l) => (value[l] !== undefined ? [[l, value[l]]] : []))) as L10n;

/** The monogram within the new cover's glyphs (a ticket's name is cut, a seal keeps its initials). */
function fitMonogram(monogram: L10n | null, max: number): L10n | null {
  if (!monogram) return null;
  const out: L10n = {};
  for (const [l, text] of Object.entries(monogram) as [Locale, string | undefined][]) {
    if (text === undefined) continue;
    out[l] = visibleGlyphCount(text) <= max ? text : graphemes(text).slice(0, max).join('').trim();
  }
  return out;
}

/**
 * The document on another design: the host's content stays; the palette keeps only the keys the new
 * design lets change, the font pair and the seal color move to the new design's when they aren't its,
 * the seeded cover hint, eyebrow and closing line become the new design's (a line the host wrote
 * stays), the music becomes its track, and the old design's own pictures go (a picture the host
 * uploaded stays; the hero takes the new design's picture when it had the old one's).
 */
export function rethemeDocument(
  doc: InvitationDocument,
  from: TemplateEntry,
  to: TemplateEntry,
): InvitationDocument {
  if (doc.templateId === to.manifest.id) return doc;
  const t = to.manifest;
  const hasAsset = (ref: AssetRef | null | undefined) => !isTemplateRef(ref) || ref!.slice(9) in t.assets;
  const next = structuredClone(doc);
  const { locales } = doc;
  const fromCopy = resolveEventDefaults(from.defaults, doc.eventType).defaults;
  const toCopy = resolveEventDefaults(to.defaults, doc.eventType).defaults;
  next.templateId = t.id;

  const editable = new Set(t.tokens.editablePaletteKeys);
  const palette = Object.fromEntries(
    Object.entries(doc.theme.palette ?? {}).filter(([k]) => editable.has(k as keyof Palette)),
  ) as Partial<Palette>;
  next.theme = {
    ...next.theme,
    palette: Object.keys(palette).length ? palette : null,
    fontPairId: findFontPair(t, doc.theme.fontPairId) ? doc.theme.fontPairId : t.fontPairs[0]!.id,
  };

  const seal = doc.cover.sealColor;
  next.cover = {
    ...next.cover,
    sealColor: t.cover.overlay.recolor
      ? seal && t.cover.sealColors.includes(seal)
        ? seal
        : (t.cover.sealColors[0] ?? null)
      : null,
    monogram: fitMonogram(doc.cover.monogram, t.cover.overlay.text.maxGlyphs),
    hint:
      doc.cover.hint && seededHints(from.defaults).some((h) => sameText(doc.cover.hint, h, locales))
        ? pick(toCopy.coverHint, locales)
        : doc.cover.hint,
  };

  if (!doc.music.customUrl && !t.music.tracks.some((x) => x.id === doc.music.trackId)) {
    next.music = {
      ...next.music,
      trackId: t.music.defaultTrackId,
      enabled: doc.music.enabled && t.music.defaultTrackId !== null,
    };
  }
  if (!hasAsset(doc.share.ogImage)) next.share = { ...next.share, ogImage: null };

  const variants = t.sectionDefaults.variants;
  next.sections = next.sections.map((s): Section => {
    const variant = variants[s.type];
    let out = { ...s } as Section;
    if (variant) out.variant = variant;
    else delete out.variant;
    if (out.type === 'hero') {
      const m = out.data.media;
      const own = !hasAsset(m.src) || !hasAsset(m.poster);
      out = {
        ...out,
        data: {
          ...out.data,
          media: own ? t.hero.options[0]!.media : m,
          overlayOpacity:
            out.data.overlayOpacity === from.manifest.hero.defaultOverlay
              ? t.hero.defaultOverlay
              : out.data.overlayOpacity,
          eyebrow: sameText(out.data.eyebrow, fromCopy.eyebrow, locales)
            ? pick(toCopy.eyebrow, locales)
            : out.data.eyebrow,
        },
      };
    } else if (out.media && (!hasAsset(out.media.src) || !hasAsset(out.media.poster))) {
      // the old design's own picture: the section goes back to its plain look
      delete out.media;
      delete out.layout;
    }
    if (out.type === 'text' && !hasAsset(out.data.illustration))
      out = { ...out, data: { ...out.data, illustration: null } };
    if (out.type === 'gallery')
      out = { ...out, data: { ...out.data, images: out.data.images.filter((i) => hasAsset(i.src)) } };
    if (out.type === 'footer' && sameText(out.data.closingLine, fromCopy.closingLine, locales))
      out = { ...out, data: { ...out.data, closingLine: pick(toCopy.closingLine, locales) } };
    return out;
  });
  return next;
}

// ─── the concept itself ──────────────────────────────────────────────────────────────────────────

/** The invitation's motion scale for each mood (theme.tokens.motion). */
const MOTION_SCALE: Record<MotionMood, number> = { calm: 0.6, gentle: 1, lively: 1.4 };

/** A photo section's entrance and scroll effect for the concept's mood. */
function motionFor(mood: MotionMood, layout: SectionLayout, slot: PhotoSlot): AnimationPatch {
  const behind = layout === 'full_bleed' || layout === 'parallax';
  if (mood === 'calm') return { enter: { preset: 'fade', duration: 1300, easing: 'gentle' }, scroll: 'none' };
  if (mood === 'gentle')
    return {
      enter: { preset: 'rise', duration: 1100, distance: 28, easing: 'gentle' },
      scroll: behind && layout !== 'parallax' ? 'ken_burns' : 'none',
      text: slot === 'quote' ? 'words' : 'none',
    };
  return {
    enter: { preset: layout.startsWith('split') ? 'slide_start' : 'zoom', duration: 1000, easing: 'spring' },
    scroll: behind && layout !== 'parallax' ? 'ken_burns' : 'none',
    text: slot === 'quote' || slot === 'story' ? 'words' : 'none',
  };
}

/** The first enabled section a slot means (story: the text of kind story), or -1. */
function slotIndex(doc: InvitationDocument, slot: PhotoSlot): number {
  if (slot === 'band') return -1;
  return doc.sections.findIndex(
    (s) =>
      s.enabled &&
      s.type === SLOT_TYPE[slot] &&
      (slot !== 'story' || (s.type === 'text' && s.data.kind === 'story')),
  );
}

/** Where a new picture band goes: after the story (else after the second section), and before the RSVP. */
function bandIndex(doc: InvitationDocument, n: number): number {
  const rsvp = doc.sections.findIndex((s) => s.type === 'rsvp');
  const footer = doc.sections.findIndex((s) => s.type === 'footer');
  const end = rsvp >= 0 ? rsvp : footer >= 0 ? footer : doc.sections.length;
  if (n > 0) return end;
  const story = doc.sections.findIndex((s) => s.type === 'text' && s.data.kind === 'story');
  return Math.min(end, story >= 0 ? story + 1 : Math.min(2, end));
}

/**
 * The concept on `doc` (already on the concept's template — see `conceptDocument`): its palette
 * (the design's editable keys), font pair, headline and hero photo; with the `cinematic` feature also
 * its opening, motion, and each photo in its section and layout (a slot the invitation lacks becomes
 * a picture band). `defaults`: the template's copy (the opening clears the design's seeded hint).
 */
export function applyConcept(
  doc: InvitationDocument,
  concept: Concept,
  template: TemplateManifest,
  defaults: TemplateDefaults,
  photos: readonly ConceptPhoto[],
  cinematic: boolean,
): InvitationDocument {
  let next = applyDocPalette(doc, concept.palette, template.tokens.editablePaletteKeys);
  if (findFontPair(template, concept.fontPairId))
    next = { ...next, theme: { ...next.theme, fontPairId: concept.fontPairId } };

  // the headline, where the concept has it in every language
  next = {
    ...next,
    sections: next.sections.map((s): Section => {
      if (s.type === 'hero') {
        const hero = photos[concept.heroPhoto];
        return {
          ...s,
          data: {
            ...s.data,
            eyebrow: concept.copy.eyebrow ?? s.data.eyebrow,
            media: hero
              ? { kind: 'image', src: hero.ref, poster: null, focalPoint: hero.focal }
              : s.data.media,
            overlayOpacity: hero
              ? Math.round(Math.min(0.7, Math.max(template.hero.defaultOverlay, hero.scrim * 0.85)) * 100) /
                100
              : s.data.overlayOpacity,
          },
        };
      }
      if (s.type === 'footer' && concept.copy.closing)
        return { ...s, data: { ...s.data, closingLine: concept.copy.closing } };
      return s;
    }),
  };
  if (!cinematic) return next;

  // the opening: the design's own is no choice of the host's
  const own = template.cover.opening?.preset ?? 'envelope';
  next = setOpening(next, concept.opening === own ? null : concept.opening, seededHints(defaults));
  next = setThemeTokens(next, { motion: MOTION_SCALE[concept.motion] });

  let bands = 0;
  for (const p of concept.placements) {
    const photo = photos[p.photo];
    if (!photo) continue;
    let slot: PhotoSlot = p.slot;
    let layout = p.layout;
    let index = slotIndex(next, slot);
    if (index < 0 || next.sections[index]!.media) {
      // no such section (or it has a picture already): a picture band instead, while there's room
      if (bands >= ART_DIRECTION.maxBands) continue;
      const id = uniqueId(
        bands ? 'band-2' : 'band',
        next.sections.map((s) => s.id),
      );
      const band = v2Section('custom', id, {
        eventType: next.eventType,
        locales: next.locales,
        startTime: next.event.startTime,
        endTime: next.event.endTime,
        defaults: null,
      });
      index = bandIndex(next, bands);
      next = insertAt(next, 'sections', band, index);
      bands++;
      if (slot !== 'band') {
        slot = 'band';
        if (layout === 'split_start' || layout === 'split_end' || layout === 'stack') layout = 'full_bleed';
      }
    }
    const behind = layout === 'full_bleed' || layout === 'parallax';
    next = setSectionMedia(next, index, {
      kind: 'image',
      src: photo.ref,
      poster: null,
      focalPoint: photo.focal,
      ...(behind ? { overlay: Math.round(Math.min(0.85, Math.max(0.3, photo.scrim)) * 100) / 100 } : {}),
    });
    next = setSectionLayout(next, index, layout);
    next = setSectionAnimation(next, index, motionFor(concept.motion, layout, slot));
  }
  return next;
}

/**
 * The document a concept makes of `doc`: moved to the concept's template (when it is another), then
 * the concept applied. `from` is the document's template now.
 */
export function conceptDocument(
  doc: InvitationDocument,
  from: TemplateEntry,
  to: TemplateEntry,
  concept: Concept,
  photos: readonly ConceptPhoto[],
  cinematic: boolean,
): InvitationDocument {
  return applyConcept(rethemeDocument(doc, from, to), concept, to.manifest, to.defaults, photos, cinematic);
}

/**
 * The cinematic controls' changes to the document (v2 — feature `cinematic`): a section's media,
 * layout, motion and colors, the cover's opening and the invitation's type scale, spacing and motion.
 * Pure functions of the document — the panels call them through the editor's `apply`, so each is one
 * undo step, autosaved like any change, and what they write is what validate.ts reads. They keep the
 * document tidy: a value back at its default is removed rather than stored.
 */
import {
  DEFAULT_SECTION_ANIMATION,
  type EnterPreset,
  type InvitationDocument,
  type L10n,
  type OpeningPreset,
  type Palette,
  type Section,
  type SectionAnimation,
  type SectionLayout,
  type SectionMedia,
  type SectionType,
  type TemplateDefaults,
  type ThemeOverrides,
  type ThemeTokens,
} from '../contracts/types';
import { updateAt } from './paths';

// ─── which layouts a section may take ────────────────────────────────────────────────────────────

/**
 * The layouts the editor offers per section type: text-led sections take them all; sections with a
 * form, a list or a map beside a picture would be cramped, so they get the full-bleed ones only; the
 * hero always fills the screen and a gallery shows its own pictures.
 */
const ALL: readonly SectionLayout[] = [
  'stack',
  'full_bleed',
  'split_start',
  'split_end',
  'parallax',
  'video_bg',
];
const OVER: readonly SectionLayout[] = ['stack', 'full_bleed', 'parallax', 'video_bg'];
export const LAYOUTS_BY_TYPE: Record<SectionType, readonly SectionLayout[]> = {
  hero: [],
  gallery: [],
  countdown: ALL,
  text: ALL,
  quote: ALL,
  custom: ALL,
  when: ALL,
  parents: ALL,
  where: ALL,
  reveal: ALL,
  footer: ALL,
  venues: OVER,
  timeline: OVER,
  faq: OVER,
  gifts: OVER,
  rsvp: OVER,
};

/** Sections with a picture / video of their own (not the hero — its media is its data — nor a gallery). */
export const takesMedia = (type: SectionType) => LAYOUTS_BY_TYPE[type].length > 0;

export type LayoutState = 'ok' | 'needs_media' | 'needs_video';

/** Whether a layout can be picked now: every layout but the stack needs media, video_bg a video. */
export function layoutState(section: Pick<Section, 'media'>, layout: SectionLayout): LayoutState {
  if (layout === 'stack') return 'ok';
  if (!section.media) return 'needs_media';
  if (layout === 'video_bg' && section.media.kind !== 'video') return 'needs_video';
  return 'ok';
}

/** The section's layout as the editor shows it (absent → stack). */
export const layoutOf = (section: Pick<Section, 'layout'>): SectionLayout => section.layout ?? 'stack';

// ─── helpers ─────────────────────────────────────────────────────────────────────────────────────

const updateSection = (
  doc: InvitationDocument,
  index: number,
  fn: (s: Section) => Section,
): InvitationDocument => updateAt(doc, `sections.${index}`, (s) => fn(s as Section));

/** A copy of `obj` without the keys whose value is undefined. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

const isEmpty = (o: object | null | undefined) => !o || Object.keys(o).length === 0;

// ─── media ───────────────────────────────────────────────────────────────────────────────────────

/**
 * A section's picture or video (null removes it). Without media a layout that needs it goes back to
 * the stack; a picture where a video background was becomes full-bleed.
 */
export function setSectionMedia(
  doc: InvitationDocument,
  index: number,
  media: SectionMedia | null,
): InvitationDocument {
  return updateSection(doc, index, (s) => {
    if (s.type === 'hero') return s;
    let layout = s.layout;
    if (!media) layout = undefined;
    else if (layout === 'video_bg' && media.kind !== 'video') layout = 'full_bleed';
    return compact({ ...s, media: media ?? undefined, layout } as Section);
  });
}

/** Part of a section's media (focal point, overlay, alt, poster) — nothing without media. */
export function patchSectionMedia(
  doc: InvitationDocument,
  index: number,
  patch: Partial<SectionMedia>,
): InvitationDocument {
  return updateSection(doc, index, (s) =>
    s.type === 'hero' || !s.media ? s : ({ ...s, media: compact({ ...s.media, ...patch }) } as Section),
  );
}

// ─── layout ──────────────────────────────────────────────────────────────────────────────────────

/** A section's layout; one it can't take now (no media, not a video) is refused (unchanged). */
export function setSectionLayout(
  doc: InvitationDocument,
  index: number,
  layout: SectionLayout,
): InvitationDocument {
  return updateSection(doc, index, (s) => {
    if (!LAYOUTS_BY_TYPE[s.type].includes(layout) || layoutState(s, layout) !== 'ok') return s;
    return compact({ ...s, layout: layout === 'stack' ? undefined : layout } as Section);
  });
}

// ─── motion ──────────────────────────────────────────────────────────────────────────────────────

export type AnimationPatch = Partial<Omit<SectionAnimation, 'enter'>> & {
  enter?: Partial<SectionAnimation['enter']>;
};

const sameAnimation = (a: SectionAnimation, b: SectionAnimation) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A section's motion, changed in part (the rest as it was, or the defaults); null — or a motion back
 * at every default (the template's own reveal, no scroll effect, no text reveal) — removes it.
 */
export function setSectionAnimation(
  doc: InvitationDocument,
  index: number,
  patch: AnimationPatch | null,
): InvitationDocument {
  return updateSection(doc, index, (s) => {
    if (!patch) return compact({ ...s, animation: undefined } as Section);
    const current = s.animation ?? DEFAULT_SECTION_ANIMATION;
    const next: SectionAnimation = {
      ...current,
      ...compact(patch),
      enter: { ...current.enter, ...compact(patch.enter ?? {}) },
    } as SectionAnimation;
    const plain = sameAnimation(next, DEFAULT_SECTION_ANIMATION as SectionAnimation);
    return compact({ ...s, animation: plain ? undefined : next } as Section);
  });
}

/** How long a section's motion takes to play in full (the preview's "play" lasts that long). */
export function motionMs(section: Pick<Section, 'animation'>, blocks = 5): number {
  const a = section.animation ?? DEFAULT_SECTION_ANIMATION;
  const enter = a.enter.preset === 'none' ? 0 : a.enter.duration + a.enter.delay;
  const text = a.text === 'none' ? 0 : 1600;
  return 1200 + enter + a.stagger * blocks + text;
}

/** The enter presets the editor offers, in its order ('auto' = the design's own). */
export const ENTER_CHOICES: readonly EnterPreset[] = [
  'auto',
  'fade',
  'rise',
  'sink',
  'zoom',
  'zoom_out',
  'slide_start',
  'slide_end',
  'tilt',
  'none',
];

// ─── colors & tokens ─────────────────────────────────────────────────────────────────────────────

/**
 * A section's own colors (`themeOverrides.palette`), changed in part: a key set to null goes; no
 * palette left and nothing else of its own → no overrides at all.
 */
export function setSectionColors(
  doc: InvitationDocument,
  index: number,
  patch: Partial<Record<keyof Palette, string | null>> | null,
): InvitationDocument {
  return updateSection(doc, index, (s) => {
    const own: ThemeOverrides = { ...(s.themeOverrides ?? {}) };
    if (!patch) delete own.palette;
    else {
      const palette: Partial<Palette> = { ...(own.palette ?? {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v) palette[k as keyof Palette] = v;
        else delete palette[k as keyof Palette];
      }
      if (isEmpty(palette)) delete own.palette;
      else own.palette = palette;
    }
    return compact({ ...s, themeOverrides: isEmpty(own) ? undefined : own } as Section);
  });
}

/**
 * A section's own type size, spacing and picture corners (`themeOverrides` typography.display.size,
 * spacing.section, radius.media): a value back at the design's (null) goes.
 */
export function setSectionTokens(
  doc: InvitationDocument,
  index: number,
  patch: { titleSize?: number | null; sectionSpacing?: number | null; mediaRadius?: number | null },
): InvitationDocument {
  return updateSection(doc, index, (s) => {
    const own: ThemeOverrides = structuredClone(s.themeOverrides ?? {});
    if ('titleSize' in patch) {
      const display = { ...(own.typography?.display ?? {}) };
      if (patch.titleSize === null || patch.titleSize === undefined || patch.titleSize === 1)
        delete display.size;
      else display.size = patch.titleSize;
      const typography: NonNullable<ThemeOverrides['typography']> = { ...(own.typography ?? {}) };
      if (isEmpty(display)) delete typography.display;
      else typography.display = display;
      if (isEmpty(typography)) delete own.typography;
      else own.typography = typography;
    }
    if ('sectionSpacing' in patch) {
      const spacing = { ...(own.spacing ?? {}) };
      if (patch.sectionSpacing === null || patch.sectionSpacing === undefined || patch.sectionSpacing === 1)
        delete spacing.section;
      else spacing.section = patch.sectionSpacing;
      if (isEmpty(spacing)) delete own.spacing;
      else own.spacing = spacing;
    }
    if ('mediaRadius' in patch) {
      const radius = { ...(own.radius ?? {}) };
      if (patch.mediaRadius === null || patch.mediaRadius === undefined) delete radius.media;
      else radius.media = patch.mediaRadius;
      if (isEmpty(radius)) delete own.radius;
      else own.radius = radius;
    }
    return compact({ ...s, themeOverrides: isEmpty(own) ? undefined : own } as Section);
  });
}

/** A section without any presentation of its own (media, layout, motion, colors). */
export const withoutPresentation = <S extends Section>(s: S): S =>
  compact({
    ...s,
    media: undefined,
    layout: undefined,
    animation: undefined,
    themeOverrides: undefined,
  } as S);

/** Everything a section has of its own presentation removed (media, layout, motion, colors). */
export function resetSectionPresentation(doc: InvitationDocument, index: number): InvitationDocument {
  return updateSection(doc, index, withoutPresentation);
}

/**
 * The invitation's type scale, spacing density and motion intensity (`theme.tokens`): a value back
 * at 1 (as designed) goes; none left → no tokens.
 */
export function setThemeTokens(
  doc: InvitationDocument,
  patch: Partial<ThemeTokens> | null,
): InvitationDocument {
  const tokens: ThemeTokens = patch ? { ...(doc.theme.tokens ?? {}), ...patch } : {};
  for (const key of Object.keys(tokens) as (keyof ThemeTokens)[]) {
    const v = tokens[key];
    if (v === undefined || v === 1) delete tokens[key];
  }
  const theme = { ...doc.theme };
  if (isEmpty(tokens)) delete theme.tokens;
  else theme.tokens = tokens;
  return { ...doc, theme };
}

/**
 * The invitation's palette from a photo: only the keys the template lets the host change (the
 * others are the design's), one step.
 */
export function applyDocPalette(
  doc: InvitationDocument,
  palette: Palette,
  editable: readonly (keyof Palette)[],
): InvitationDocument {
  const next: Partial<Palette> = {};
  for (const key of editable) next[key] = palette[key];
  return { ...doc, theme: { ...doc.theme, palette: isEmpty(next) ? null : next } };
}

/**
 * A section in a photo's colors: its own palette (every key: a band of its own) and, when the
 * picture is behind its text, the scrim that picture needs.
 */
export function applySectionPalette(
  doc: InvitationDocument,
  index: number,
  palette: Palette,
  overlay: number | null,
): InvitationDocument {
  let next = setSectionColors(doc, index, palette);
  if (overlay !== null) next = patchSectionMedia(next, index, { overlay });
  return next;
}

// ─── the cover's opening ─────────────────────────────────────────────────────────────────────────

/** Every cover hint the template seeds (all its event types): the ones that speak of its own cover. */
export function seededHints(defaults: TemplateDefaults): L10n[] {
  return Object.values(defaults.defaults).flatMap((d) => (d ? [d.coverHint] : []));
}

/**
 * The host's opening (null: the design's own choice). The hint the template seeded speaks of its own
 * cover ("tap to open the envelope"): picking another opening clears it, so the opening's own call to
 * action shows; a hint the host wrote stays.
 */
export function setOpening(
  doc: InvitationDocument,
  preset: OpeningPreset | null,
  hints: readonly L10n[],
): InvitationDocument {
  const hint = doc.cover.hint;
  const seeded =
    !!hint &&
    hints.some((h) =>
      Object.entries(hint).every(([locale, text]) => !text?.trim() || h[locale as keyof L10n] === text),
    );
  const cover = { ...doc.cover, hint: seeded ? null : hint };
  if (preset === null) delete cover.opening;
  else cover.opening = preset;
  return { ...doc, cover };
}

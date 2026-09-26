import type { InvitationDocument, Section, SectionLayout, TemplateManifest } from '../../contracts/types';
import { relativeLuminance } from '../../lib/contrast';
import { parseVideoLink } from '../../lib/video-links';
import type { RenderContext } from '../context-core';
import { motionAttributes, motionConfig, type MotionConfig } from '../motion/engine';
import { resolvePalette, scrimOf, sectionThemeVars } from '../theme';

/**
 * How a section renders under the v2 presentation (feature `cinematic`): its effective layout, its
 * media resolved to URLs, its motion and its own tokens, as the attributes and custom properties of
 * the wrapper CineSection draws. `null` — no presentation, or the feature is off — is the plain v1
 * rendering, byte for byte.
 */

export interface CineMedia {
  kind: 'image' | 'video';
  /** the video file, or the picture */
  src: string;
  /** what shows before a video plays (and instead of it: data saver, reduced motion); a picture: itself */
  still: string | null;
  focal: { x: number; y: number };
  /** '' — decorative (every background) */
  alt: string;
}

export interface CinePresentation {
  /** effective: a layout that needs media falls back to `stack` without it; `video_bg` with a picture is `full_bleed` */
  layout: SectionLayout;
  media: CineMedia | null;
  /** the text sits on the media (full_bleed, parallax, video_bg) */
  onMedia: boolean;
  /** media beside the text (split layouts) */
  split: boolean;
  motion: MotionConfig;
  attrs: Record<string, string>;
  vars: Record<string, string>;
  /**
   * The section is a band of its own (media, or colors of its own): the text-after-text tightening
   * doesn't reach across it.
   */
  band: boolean;
}

const ON_MEDIA: readonly SectionLayout[] = ['full_bleed', 'parallax', 'video_bg'];

/** Whether a section carries any v2 presentation at all. */
export function hasPresentation(section: Section): boolean {
  return !!(
    section.media ||
    (section.layout && section.layout !== 'stack' && section.type !== 'hero') ||
    section.animation ||
    (section.themeOverrides && Object.keys(section.themeOverrides).length)
  );
}

/** Whether the document uses the v2 presentation anywhere (sections or the host's opening). */
export function usesCinematic(doc: Pick<InvitationDocument, 'sections' | 'cover'>): boolean {
  return !!doc.cover.opening || doc.sections.some((s) => s.enabled && hasPresentation(s));
}

function resolveMedia(section: Section, ctx: RenderContext): CineMedia | null {
  const m = section.type === 'hero' ? null : section.media;
  if (!m) return null;
  const focal = { x: m.focalPoint.x, y: m.focalPoint.y };
  const alt = ctx.text(m.alt ?? null);
  const still = ctx.asset(m.poster);
  if (m.kind === 'video') {
    // a section plays files only (a YouTube / Vimeo link can't be a section's background): its still
    const file = parseVideoLink(m.src) ? null : ctx.asset(m.src);
    if (file) return { kind: 'video', src: file, still, focal, alt };
    return still ? { kind: 'image', src: still, still, focal, alt } : null;
  }
  const src = ctx.asset(m.src);
  return src ? { kind: 'image', src, still: src, focal, alt } : null;
}

/** The scrim's color: the template's (dark) one under light text; a light one under dark text. */
function scrimColor(template: TemplateManifest, heroText: string): string {
  const light = /^#[0-9A-Fa-f]{6}$/.test(heroText) ? relativeLuminance(heroText) > 0.45 : true;
  return light ? scrimOf(template).color : '#FFFFFF';
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function sectionPresentation(section: Section, ctx: RenderContext): CinePresentation | null {
  if (!ctx.cinematic || !hasPresentation(section)) return null;
  const { template, doc } = ctx;
  const hero = section.type === 'hero';
  const media = resolveMedia(section, ctx);
  let layout: SectionLayout = hero ? 'full_bleed' : (section.layout ?? 'stack');
  if (!hero) {
    if (!media && layout !== 'stack') layout = 'stack';
    if (layout === 'video_bg' && media?.kind !== 'video') layout = 'full_bleed';
  }
  const onMedia = !hero && ON_MEDIA.includes(layout) && !!media;
  const split = layout === 'split_start' || layout === 'split_end';
  const motion = motionConfig(section.animation, template, layout);
  const { attrs, vars } = motionAttributes(motion);
  const theme = section.themeOverrides ? sectionThemeVars(template, doc, section.themeOverrides) : null;
  Object.assign(vars, theme?.vars);
  attrs['data-layout'] = layout;
  if (theme?.dark !== null && theme?.dark !== undefined) {
    attrs['data-palette'] = '';
    attrs['data-theme'] = theme.dark ? 'dark' : 'light';
  }
  if (media) {
    vars['--fx'] = pct(media.focal.x);
    vars['--fy'] = pct(media.focal.y);
  }
  if (onMedia) {
    attrs['data-on-media'] = '';
    const heroText = theme?.vars['--inv-hero-text'] ?? resolvePalette(template, doc).heroText;
    vars['--scrim'] = scrimColor(template, heroText);
    const own = section.media?.overlay;
    if (own !== null && own !== undefined) vars['--scrim-a'] = String(own);
  }
  return {
    layout,
    media,
    onMedia,
    split,
    motion,
    attrs,
    vars,
    band: !!media || (theme?.dark ?? null) !== null,
  };
}

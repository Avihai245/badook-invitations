import type {
  AmbientKind,
  InvitationDocument,
  Palette,
  SceneDrift,
  SceneParticles,
  SceneZoom,
  Section,
  TemplateManifest,
  TemplateScene,
} from '../../contracts/types';
import { relativeLuminance } from '../../lib/contrast';
import { darkScrim, lightText } from '../cinematic/presentation';
import type { AssetBases } from '../assets';
import { resolveAsset } from '../assets';
import { ambientFor, fxTheme } from '../fx/theme';
import { imageSet, type ImageSet } from '../images';
import { resolvePalette } from '../theme';

/**
 * The scroll scene (renderer/scene — v2, feature `cinematic`): the invitation as one continuous film.
 * A backdrop is pinned behind the page (position: sticky — never `background-attachment: fixed`, which
 * iOS ignores) and the sections scroll over it with transparent backgrounds. The backdrop is a stack of
 * pictures, one per stretch of sections, told as one journey: as the guest moves from one stretch to the
 * next the next picture cross-fades in, and each picture slowly zooms (Ken Burns, 1 → 1.08) — or drifts
 * — while its sections scroll by. A dark gradient keeps the light texts readable, a few particles drift
 * over it all (one canvas), and every text rises into view out of a soft blur.
 *
 * Pure and isomorphic: the server renders the model (SceneBackdrop), the browser drives it
 * (SceneDriver), the unit tests read it.
 */

/** A picture of the backdrop and how it moves. */
export interface SceneLayer {
  /** the section it starts at (stable across renders) */
  key: string;
  /** the picture in the screen's width (null: the design's own art — the hero's placeholder sky) */
  picture: (ImageSet & { position: string }) | null;
  zoom: SceneZoom;
  drift: SceneDrift | null;
  /** the gradient's strength, 0..0.85 (0.5: the scene's standard shade) */
  overlay: number;
}

/** The scene's reveal of a section's texts (its `animation.enter`, read for the scene). */
export type SceneReveal = 'rise_blur' | 'rise' | 'fade' | 'none';

export interface SceneModel {
  layers: SceneLayer[];
  /** each enabled section's layer, by section id */
  layerOf: Record<string, number>;
  /** each enabled section's reveal and its stagger (ms), by section id */
  revealOf: Record<string, { preset: SceneReveal; stagger: number }>;
  particles: SceneParticles;
  /** the particles' colors */
  particleColors: string[];
  /** the gradient's dark tone (hex) */
  shade: string;
  /** the texts' light tone over the backdrop (hex) */
  text: string;
  /** extra letter spacing of the section titles, em */
  tracking: number;
  /** the hero's own media stays in the hero (a video, a YouTube / Vimeo film): the scene starts under it */
  heroInline: boolean;
}

/** The scene's standard shade — the spec's gradient at full strength. */
export const SCENE_OVERLAY = 0.5;
/** Ken Burns: the zoom a picture reaches over its sections. */
export const SCENE_ZOOM = 0.08;
/** A drifting picture's travel each way, a share of the screen's height. */
export const SCENE_DRIFT = 0.035;
/** The cross-fade: the next picture starts as its section's top reaches 65% of the screen, ends at 35%. */
export const FADE_FROM = 0.65;
export const FADE_TO = 0.35;
/** The texts' default stagger in the scene, ms. */
export const SCENE_STAGGER = 90;

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** A design's ambient particles, told as the scene's (few, slow, elegant) kinds. */
function particlesFor(ambient: AmbientKind): SceneParticles {
  switch (ambient) {
    case 'none':
      return 'none';
    case 'petals':
    case 'leaves':
      return 'petals';
    default:
      return 'gold_dust';
  }
}

/** The design's scene: its own (manifest `scene`), else what a page gets when its host makes it a scene. */
export function templateScene(template: TemplateManifest): TemplateScene {
  return (
    template.scene ?? {
      enabled: false,
      particles: particlesFor(ambientFor(template)),
      shade: null,
      tracking: 0,
    }
  );
}

/**
 * Whether the invitation is a scroll scene: the event has the `cinematic` feature, and the host turned
 * it on — or left the design's own choice (a design made as a scene starts as one).
 */
export function sceneOn(
  doc: Pick<InvitationDocument, 'theme'>,
  template: Pick<TemplateManifest, 'scene'>,
  cinematic: boolean,
): boolean {
  if (!cinematic) return false;
  return doc.theme.scene?.enabled ?? template.scene?.enabled ?? false;
}

/** Colors the particles take: the design's scene tone (light, with its accent's gold), per kind. */
function particleColors(kind: SceneParticles, palette: Palette, ambientColors: string[]): string[] {
  switch (kind) {
    case 'butterflies':
      return ['#FFFFFF', '#FBF6EA', '#E6F0FA', '#F6E7C8'];
    case 'gold_dust':
      return ['#FFF4D6', '#F6E3A6', '#FFFFFF', '#E9C98A'];
    case 'petals':
      return ambientColors.length ? ambientColors : ['#FFFFFF', '#FBEFF1', '#F6E7D8'];
    case 'none':
      return [];
  }
  return [palette.accent];
}

function sceneReveal(section: Section): { preset: SceneReveal; stagger: number } {
  const a = section.animation;
  const stagger = a ? Math.max(0, Math.min(600, Math.round(a.stagger))) : SCENE_STAGGER;
  switch (a?.enter.preset) {
    case 'none':
      return { preset: 'none', stagger };
    case 'fade':
      return { preset: 'fade', stagger };
    case 'rise':
    case 'sink':
      return { preset: 'rise', stagger };
    default:
      // the scene's own reveal: the design's, rise_blur, and every other preset
      return { preset: 'rise_blur', stagger };
  }
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

interface ModelInput {
  doc: InvitationDocument;
  template: TemplateManifest;
  bases: AssetBases;
}

/**
 * The scene of an invitation (null when it isn't one). The layers follow the enabled sections: the
 * hero's picture first (its photo, a video's still — or, with neither, the design's own art); then a
 * section with media of its own starts a new picture, and one without continues the picture before it.
 */
export function sceneModel({ doc, template, bases }: ModelInput): SceneModel {
  const own = templateScene(template);
  const palette = resolvePalette(template, doc);
  const fx = fxTheme(template, doc);
  const particles = doc.theme.scene?.particles ?? own.particles;
  const layers: SceneLayer[] = [];
  const layerOf: Record<string, number> = {};
  const revealOf: Record<string, { preset: SceneReveal; stagger: number }> = {};
  const asset = (ref: string | null | undefined) => resolveAsset(ref, template, bases);
  let heroInline = false;

  for (const section of doc.sections) {
    if (!section.enabled) continue;
    revealOf[section.id] = sceneReveal(section);
    let layer: SceneLayer | null = null;
    if (section.type === 'hero') {
      const m = section.data.media;
      // a video (a file, or a YouTube / Vimeo link) stays in the hero; the backdrop shows its still —
      // a design's own video not produced yet is its art, in the backdrop
      heroInline = m.kind === 'video' && !!asset(m.src);
      const src = m.kind === 'image' ? asset(m.src) : asset(m.poster);
      const overlay = Math.min(
        0.85,
        (SCENE_OVERLAY * section.data.overlayOpacity) / Math.max(0.05, template.hero.defaultOverlay),
      );
      layer = {
        key: section.id,
        picture: src
          ? {
              ...imageSet(src, '100vw'),
              position: `${pct(m.focalPoint.x)} ${pct(m.focalPoint.y)}`,
            }
          : null,
        zoom: 'in',
        drift: null,
        overlay: Math.round(overlay * 100) / 100,
      };
    } else if (section.media) {
      const m = section.media;
      const src = m.kind === 'image' ? asset(m.src) : asset(m.poster);
      if (src)
        layer = {
          key: section.id,
          picture: { ...imageSet(src, '100vw'), position: `${pct(m.focalPoint.x)} ${pct(m.focalPoint.y)}` },
          zoom: m.kenBurns ?? 'in',
          drift: m.drift ?? null,
          overlay: m.overlay ?? SCENE_OVERLAY,
        };
    }
    const last = layers.at(-1);
    // the same picture again is no new picture: the stretch goes on
    if (layer && !(last && (last.picture?.src ?? null) === (layer.picture?.src ?? null))) layers.push(layer);
    // no hero: the design's own art until a section brings a picture
    if (!layers.length)
      layers.push({ key: section.id, picture: null, zoom: 'in', drift: null, overlay: SCENE_OVERLAY });
    layerOf[section.id] = layers.length - 1;
  }

  const shade = own.shade && HEX.test(own.shade) ? own.shade : darkScrim(template, palette);
  const text = relativeLuminance(palette.heroText) > 0.45 ? palette.heroText : lightText(palette);
  return {
    layers,
    layerOf,
    revealOf,
    particles,
    particleColors: particleColors(particles, palette, fx.ambientColors),
    shade,
    text,
    tracking: own.tracking,
    heroInline,
  };
}

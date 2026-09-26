import {
  DEFAULT_SECTION_ANIMATION,
  type EnterPreset,
  type MotionEasing,
  type ScrollEffect,
  type SectionAnimation,
  type SectionLayout,
  type TemplateManifest,
  type TextReveal,
} from '../../contracts/types';

/**
 * The Scroll Timeline Engine, declarative half: a section's `animation` JSON → what its wrapper
 * carries (data attributes + CSS custom properties). invitation.css turns them into scroll-driven
 * animations (`animation-timeline: view()`) where the browser has them, and into once-per-view
 * transitions elsewhere (the one IntersectionObserver of ScrollEngine.client.tsx adds `.in`). Pure and
 * isomorphic — the server renders the result, the unit tests read it.
 *
 * Only transform and opacity ever move. With reduced motion, or `<html data-motion="none">`, the CSS
 * shows every element in its final state at once.
 */

/** Scroll distance per millisecond of animation where the scroll drives it: 900ms ≈ 270px. */
export const PX_PER_MS = 0.3;
/** Parallax travel, % of the section's height each way, at intensity 1. */
export const PARALLAX_DEPTH = 9;
/** Ken Burns zoom at intensity 1 (the media ends 14% larger). */
export const KEN_BURNS_ZOOM = 0.14;

export interface MotionConfig {
  /** null: the template's own reveal (`auto`) — the section's blocks keep their v1 motion */
  enter: {
    preset: Exclude<EnterPreset, 'auto'>;
    duration: number;
    delay: number;
    /** px, already × intensity */
    distance: number;
    easing: MotionEasing;
  } | null;
  /** what the section's media does while it scrolls by (a `parallax` layout implies `parallax`) */
  scroll: ScrollEffect[];
  text: TextReveal;
  stagger: number;
  /** section × template */
  intensity: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const finite = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);

/**
 * The effective motion of a section. `animation` may be partial or come from an older editor: every
 * field falls back to DEFAULT_SECTION_ANIMATION and is clamped to the contract's range.
 */
export function motionConfig(
  animation: Partial<SectionAnimation> | null | undefined,
  template: Pick<TemplateManifest, 'motion'>,
  layout: SectionLayout,
): MotionConfig {
  const d = DEFAULT_SECTION_ANIMATION;
  const a = animation ?? {};
  const e: Partial<SectionAnimation['enter']> = a.enter ?? {};
  // `preset: none` turns the template's motion off entirely — the engine follows it
  const calm = template.motion.preset === 'none';
  const intensity = calm
    ? 0
    : clamp(finite(a.intensity, d.intensity), 0, 2) * clamp(finite(template.motion.intensity, 1), 0, 2);
  const preset = e.preset ?? d.enter.preset;
  const scroll = new Set<ScrollEffect>();
  if (layout === 'parallax') scroll.add('parallax');
  if (a.scroll && a.scroll !== 'none') scroll.add(a.scroll);
  return {
    enter:
      preset === 'auto'
        ? null
        : {
            preset: calm ? 'none' : preset,
            duration: Math.round(clamp(finite(e.duration, d.enter.duration), 150, 4000)),
            delay: Math.round(clamp(finite(e.delay, d.enter.delay), 0, 3000)),
            distance: Math.round(clamp(finite(e.distance, d.enter.distance), 0, 240) * intensity),
            easing: e.easing ?? d.enter.easing,
          },
    scroll: intensity > 0 ? [...scroll] : [],
    text: calm ? 'none' : (a.text ?? d.text),
    stagger: Math.round(clamp(finite(a.stagger, d.stagger), 0, 600)),
    intensity,
  };
}

const EASING: Record<MotionEasing, string> = {
  smooth: 'var(--ease-out)',
  spring: 'var(--spring)',
  gentle: 'var(--ease)',
  linear: 'linear',
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * The wrapper's attributes (`data-enter`, `data-scroll`, `data-tr`) and custom properties: the enter
 * preset's timing both as time (the fallback's transitions) and as scroll distance (the scroll-driven
 * animation's `animation-range`), its travel, the parallax depth and the Ken Burns zoom. Nothing when
 * the section keeps the template's motion.
 */
export function motionAttributes(config: MotionConfig): {
  attrs: Record<string, string>;
  vars: Record<string, string>;
} {
  const attrs: Record<string, string> = {};
  const vars: Record<string, string> = {};
  const { enter } = config;
  if (enter) {
    attrs['data-enter'] = enter.preset;
    vars['--en-dur'] = `${enter.duration}ms`;
    vars['--en-delay'] = `${enter.delay}ms`;
    vars['--en-stagger'] = `${config.stagger}ms`;
    vars['--en-ease'] = EASING[enter.easing];
    vars['--en-dist'] = `${enter.distance}px`;
    // the zoom and tilt presets' amounts follow the intensity too
    vars['--en-zoom-in'] = String(round(1 - 0.08 * config.intensity, 3));
    vars['--en-zoom-out'] = String(round(1 + 0.08 * config.intensity, 3));
    vars['--en-tilt'] = `${round(12 * config.intensity, 1)}deg`;
    // the same timing as scroll distance: where the scroll drives the animation
    vars['--en-len'] = `${Math.round(enter.duration * PX_PER_MS)}px`;
    vars['--en-off'] = `${Math.round(enter.delay * PX_PER_MS)}px`;
    vars['--en-step'] = `${Math.round(config.stagger * PX_PER_MS)}px`;
  }
  if (config.scroll.length) {
    attrs['data-scroll'] = config.scroll.join(' ');
    if (config.scroll.includes('parallax'))
      vars['--px-depth'] = String(round(PARALLAX_DEPTH * config.intensity, 1));
    if (config.scroll.includes('ken_burns'))
      vars['--kb-zoom'] = String(round(1 + KEN_BURNS_ZOOM * config.intensity, 3));
  }
  if (config.text !== 'none') {
    attrs['data-tr'] = config.text;
    vars['--tr-step'] =
      `${Math.max(12, Math.round((config.text === 'letters' ? 0.45 : 1) * config.stagger))}ms`;
  }
  return { attrs, vars };
}

/** Elements whose text a text reveal animates (titles, subtitles, texts, quotes, a when's date). */
export const TEXT_REVEAL_TARGETS = '.sec-title, .sec-sub, .sec-body, .q-text, .q-by, .pa-names, .wh-note';

/** Pieces of one text reveal: letters stop at 90 (then words), words at 140 (then lines). */
export const TEXT_REVEAL_LIMITS = { letters: 90, words: 140 } as const;

/** How a text is revealed given its length: long texts step down to words, then lines. */
export function revealGranularity(mode: TextReveal, text: string): TextReveal {
  if (mode === 'none') return 'none';
  const letters = [...text.replace(/\s+/g, '')].length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (mode === 'letters' && letters > TEXT_REVEAL_LIMITS.letters) mode = 'words';
  if (mode === 'words' && words > TEXT_REVEAL_LIMITS.words) mode = 'lines';
  return mode;
}

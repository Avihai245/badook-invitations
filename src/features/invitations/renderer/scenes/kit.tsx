import { useId, type CSSProperties, type ReactNode } from 'react';

/**
 * Building blocks of the scenes (placeholder art drawn in SVG + CSS). A scene is a set of pieces laid
 * out on its root, a `container-type: size` box: positions in % of the box, sizes in container units
 * (`cqmin` = the box's shorter side), so one composition scales from a 150px gallery poster to a
 * phone hero and spreads out on a landscape desktop hero or the cover's card. Everything is static
 * and deterministic (server-rendered, never random).
 */

export type ScenePlace = 'hero' | 'poster' | 'card';

export interface SceneProps {
  place: ScenePlace;
  /** the event date (ISO), for scenes that write it large (a scoreboard, oversized numerals) */
  date?: string | null;
}

/** Day and month of an ISO date ('2027-06-17' → ['17', '06']); null without one. */
export function dayMonth(date: string | null | undefined): [string, string] | null {
  const m = date ? /^\d{4}-(\d{2})-(\d{2})$/.exec(date) : null;
  return m ? [m[2]!, m[1]!] : null;
}

/** `n` hundredths of the scene's shorter side. */
export const cm = (n: number) => `${n}cqmin`;
/**
 * `n` hundredths of the shorter side, at most what they are on a 9:16 portrait: the same on phones
 * and posters, smaller on a landscape hero, where a crown ornament or a centrepiece sized by the
 * shorter side (the height there) would reach the text.
 */
export const cmh = (n: number) => `min(${n}cqmin, ${Math.round(n * 56.25) / 100}cqh)`;
export const cw = (n: number) => `${n}cqw`;
export const ch = (n: number) => `${n}cqh`;

type ViewBox = readonly [number, number, number, number];

/**
 * The hero's loops (invitation.css): float up and down, sway on the base, drift sideways, twinkle /
 * flicker (opacity), sweep (a light fan on its corner), spin (a slow turn); and livelier ones for
 * playful scenes — bounce (a ball: up, down, squash), pop (a heartbeat), orbit (a small circle, a
 * planet or a bee), rise (up and fading, a balloon or a bubble — it comes back from below), swing (a
 * pendulum from its top: bunting, lanterns, a mirror ball), pulse (a glow breathing), wiggle (a quick
 * shake now and then), turn (a record or a wheel, a full turn every few seconds).
 */
export type SceneAnim =
  | 'float'
  | 'sway'
  | 'drift'
  | 'twinkle'
  | 'flicker'
  | 'sweep'
  | 'spin'
  | 'bounce'
  | 'pop'
  | 'orbit'
  | 'rise'
  | 'swing'
  | 'pulse'
  | 'wiggle'
  | 'turn';

/**
 * One SVG piece of a scene. `vb` is its drawing's viewBox; give it a position and a width (the height
 * follows the drawing's aspect ratio) or both width and height with a `fit` (preserveAspectRatio).
 */
export function Piece({
  vb,
  style,
  fit = 'xMidYMid meet',
  flip = false,
  anim,
  children,
}: {
  vb: ViewBox;
  style: CSSProperties;
  fit?: string;
  /** mirrored horizontally (the same corner art on the other side) */
  flip?: boolean;
  /** a gentle loop in the hero (invitation.css `.scene [data-anim]`), off with reduced motion */
  anim?: SceneAnim;
  children: ReactNode;
}) {
  const [, , w, h] = vb;
  return (
    <svg
      viewBox={vb.join(' ')}
      preserveAspectRatio={fit}
      data-anim={anim}
      style={{
        position: 'absolute',
        display: 'block',
        overflow: 'visible',
        aspectRatio: `${w} / ${h}`,
        ...(flip ? { scale: '-1 1' } : null),
        ...style,
      }}
    >
      {children}
    </svg>
  );
}

/**
 * An SVG in px units covering the scene minus `inset` on every side — for borders and frames whose
 * corners must stay round at any aspect (draw `<rect width="100%" height="100%">`; stroke widths and
 * dashes may use container units through `style`).
 */
export function Frame({ inset, children }: { inset: string; children: ReactNode }) {
  return (
    <svg
      style={{
        position: 'absolute',
        left: inset,
        top: inset,
        width: `calc(100% - 2 * ${inset})`,
        height: `calc(100% - 2 * ${inset})`,
        overflow: 'visible',
      }}
    >
      {children}
    </svg>
  );
}

/** A full-bleed (or positioned) HTML layer: CSS gradients, patterns, arches. */
export function Layer({
  style,
  anim,
  children,
}: {
  style: CSSProperties;
  anim?: SceneAnim;
  children?: ReactNode;
}) {
  return (
    <div data-anim={anim} style={{ position: 'absolute', inset: 0, ...style }}>
      {children}
    </div>
  );
}

/**
 * Unique ids for a scene's gradients / patterns / filters (the same scene can be on a page twice —
 * a hero and its cover card, a list of posters). `ref('x')` → the id, `url('x')` → `url(#id)`.
 */
export function useIds() {
  const base = `sc${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return { ref: (name: string) => `${base}-${name}`, url: (name: string) => `url(#${base}-${name})` };
}

/** Deterministic pseudo-random numbers (mulberry32) — for scattered details that must render identically everywhere. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rounds SVG coordinates (smaller markup). */
export const r1 = (n: number) => Math.round(n * 10) / 10;

/** Point on a circle. */
export const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r1(cx + r * Math.cos(a)), r1(cy + r * Math.sin(a))];
};

/**
 * A petal: a closed teardrop from (x, y) outward at `deg`, `len` long and `wid` wide (quadratic
 * curves) — the unit of most flowers here.
 */
export function petalPath(x: number, y: number, deg: number, len: number, wid: number, round = 0.62): string {
  const [tx, ty] = polar(x, y, len, deg);
  const [l1x, l1y] = polar(x, y, len * round, deg - (wid / len) * 57);
  const [r1x, r1y] = polar(x, y, len * round, deg + (wid / len) * 57);
  const [c1x, c1y] = polar(x, y, len * 1.02, deg - (wid / len) * 28);
  const [c2x, c2y] = polar(x, y, len * 1.02, deg + (wid / len) * 28);
  return `M${r1(x)} ${r1(y)}Q${l1x} ${l1y} ${c1x} ${c1y}Q${tx} ${ty} ${c2x} ${c2y}Q${r1x} ${r1y} ${r1(x)} ${r1(y)}Z`;
}

/** A leaf blade from (x, y) at `deg`: two arcs meeting at the tip, `bend` curls it. */
export function leafPath(x: number, y: number, deg: number, len: number, wid: number, bend = 0): string {
  const [tx, ty] = polar(x, y, len, deg + bend);
  const [a1x, a1y] = polar(x, y, len * 0.5, deg - (wid / len) * 70 + bend * 0.5);
  const [a2x, a2y] = polar(x, y, len * 0.5, deg + (wid / len) * 70 + bend * 0.5);
  return `M${r1(x)} ${r1(y)}Q${a1x} ${a1y} ${tx} ${ty}Q${a2x} ${a2y} ${r1(x)} ${r1(y)}Z`;
}

/** Dots along a rounded rectangle / line are drawn with a dash trick: zero-length dashes, round caps. */
export const dotted = (gap: number, size: number): Partial<Record<string, string | number>> => ({
  strokeDasharray: `0 ${gap}`,
  strokeLinecap: 'round',
  strokeWidth: size,
});

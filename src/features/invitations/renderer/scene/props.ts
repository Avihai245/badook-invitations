import type { SceneProp } from '../../contracts/types';
import type { BurstKind } from '../fx/theme';

/**
 * The scene's props (renderer/scene): one thing that travels across the whole invitation as the guest
 * scrolls — pinned to the screen with the backdrop, from the first screen to the last — and arrives at
 * its target at the very end, where a finale plays: a basketball thrown in one long arc drops through
 * the hoop, a football curls into the top corner of the net, a rocket lands on the moon, a hot-air
 * balloon rises to the moon.
 *
 * Pure: the flight is a smooth curve through a few key poses (a cubic Hermite spline, Catmull-Rom
 * tangents), in lengths of the backdrop's box — hundredths of its width (cqw) plus hundredths of its
 * height (cqh) — so it fits every screen. SceneProp renders it as CSS keyframes that the scroll plays
 * (scroll-driven animations); SceneDriver plays the same poses frame by frame where the browser can't.
 */

/** A length on the backdrop: so many hundredths of its width (cqw) plus so many of its height (cqh). */
export type Len = readonly [w: number, h: number];

/** The prop at one point of its flight: its centre, its turn (deg) and its size (1: `size`). */
export interface PropPose {
  x: Len;
  y: Len;
  rotate: number;
  scale: number;
}

interface Key extends PropPose {
  /** 0..1: how far through the scroll */
  t: number;
}

export interface PropSpec {
  /** the prop's width at scale 1 (cqw) and its height over its width */
  size: number;
  aspect: number;
  /** the flight's key poses, t from 0 to 1 */
  keys: readonly Key[];
  /** the target: its centre and width (cqw), its height over its width, and when it fades in (t) */
  target: { x: Len; y: Len; width: number; aspect: number; reveal: readonly [number, number] };
  /** the finale's burst: where on the target (0..1 of its box), what, in which colors */
  burst: { kind: BurstKind; at: { x: number; y: number }; colors: readonly string[]; scale: number };
}

export const PROPS: Record<SceneProp, PropSpec> = {
  // one long shot from the lower left, over the top, down through the hoop in the upper right
  basketball: {
    size: 20,
    aspect: 1,
    keys: [
      { t: 0, x: [18, 0], y: [0, 84], rotate: 0, scale: 1 },
      { t: 0.25, x: [31, 0], y: [0, 47], rotate: -150, scale: 0.87 },
      { t: 0.5, x: [44, 0], y: [0, 25.3], rotate: -300, scale: 0.74 },
      { t: 0.72, x: [55.4, 0], y: [0, 19.2], rotate: -432, scale: 0.63 },
      { t: 0.88, x: [63.8, 0], y: [0, 22.4], rotate: -528, scale: 0.54 },
      { t: 1, x: [70, 0], y: [-1, 30], rotate: -600, scale: 0.48 },
    ],
    // the hoop's box: its rim (170, 230 of 340 × 360) on (70cqw, 30cqh)
    target: { x: [70, 0], y: [-5, 30], width: 34, aspect: 360 / 340, reveal: [0.35, 0.55] },
    burst: {
      kind: 'confetti',
      at: { x: 0.5, y: 0.64 },
      colors: ['#F26B1D', '#FFFFFF', '#9CC3FF', '#FFD166'],
      scale: 1,
    },
  },
  // kicked from the penalty spot, bent left then back, into the top right corner of the net
  football: {
    size: 18,
    aspect: 1,
    keys: [
      { t: 0, x: [50, 0], y: [0, 86], rotate: 0, scale: 1 },
      { t: 0.25, x: [36, 0], y: [-4, 72], rotate: 270, scale: 0.85 },
      { t: 0.5, x: [35, 0], y: [-9, 59], rotate: 540, scale: 0.71 },
      { t: 0.75, x: [52, 0], y: [-14, 49], rotate: 810, scale: 0.56 },
      { t: 1, x: [74, 0], y: [-19, 42], rotate: 1080, scale: 0.42 },
    ],
    // the goal's box (640 × 260), standing on the goal line (42% down the last picture): its top
    // right corner inside the net (560, 70) on the ball's end
    target: { x: [50, 0], y: [-13, 42], width: 64, aspect: 260 / 640, reveal: [0.4, 0.6] },
    burst: {
      kind: 'confetti',
      at: { x: 0.875, y: 0.27 },
      colors: ['#FFFFFF', '#C6F432', '#3E9A42', '#FFD166'],
      scale: 1,
    },
  },
  // lift-off at the bottom, up in a long curve past the moon, over it, and down onto it, upright
  rocket: {
    size: 14,
    aspect: 150 / 60,
    keys: [
      { t: 0, x: [50, 0], y: [0, 82], rotate: 0, scale: 1 },
      { t: 0.2, x: [57, 0], y: [0, 64], rotate: 14, scale: 0.9 },
      { t: 0.42, x: [70, 0], y: [0, 44], rotate: 18, scale: 0.78 },
      { t: 0.6, x: [80, 0], y: [-12, 32], rotate: 4, scale: 0.66 },
      // over the moon — high, but on the screen of a tablet too
      { t: 0.76, x: [74, 0], y: [-30, 28], rotate: -24, scale: 0.56 },
      { t: 0.9, x: [57, 0], y: [-30, 30], rotate: -12, scale: 0.5 },
      // landed: its fins (37 of its 150 below its centre, at 0.45) on the moon's top
      { t: 1, x: [46, 0], y: [-24, 32], rotate: 0, scale: 0.45 },
    ],
    // the moon's box (200 × 200): its disc (r 80) centred, its top 20cqw above (46cqw, 32cqh)
    target: { x: [46, 0], y: [0, 32], width: 50, aspect: 1, reveal: [0.45, 0.65] },
    burst: { kind: 'stars', at: { x: 0.5, y: 0.14 }, colors: ['#FFFFFF', '#5FD4F4', '#FFE066'], scale: 0.9 },
  },
  // from the lower left, swaying gently up to the crescent moon in the upper right
  balloon: {
    size: 18,
    aspect: 140 / 100,
    keys: [
      { t: 0, x: [22, 0], y: [0, 84], rotate: -4, scale: 1 },
      { t: 0.25, x: [34, 0], y: [0, 67], rotate: 5, scale: 0.92 },
      { t: 0.5, x: [29, 0], y: [0, 50], rotate: -5, scale: 0.84 },
      { t: 0.75, x: [43, 0], y: [0, 35], rotate: 4, scale: 0.73 },
      { t: 1, x: [54, 0], y: [0, 23], rotate: 0, scale: 0.62 },
    ],
    target: { x: [76, 0], y: [0, 18], width: 30, aspect: 1, reveal: [0.5, 0.7] },
    burst: { kind: 'stars', at: { x: 0.45, y: 0.5 }, colors: ['#FFF3CF', '#FFFFFF', '#F4B6C2'], scale: 0.8 },
  },
};

type Channels = [xw: number, xh: number, yw: number, yh: number, rotate: number, scale: number];
const channels = (k: PropPose): Channels => [k.x[0], k.x[1], k.y[0], k.y[1], k.rotate, k.scale];

/** The prop's pose `t` (0..1) of the way through the scroll: a smooth curve through the key poses. */
export function poseAt(spec: PropSpec, t: number): PropPose {
  const keys = spec.keys;
  const u = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1]!.t) i++;
  const k0 = keys[i]!;
  const k1 = keys[i + 1]!;
  const kp = keys[i - 1] ?? k0;
  const kn = keys[i + 2] ?? k1;
  const d = Math.max(1e-6, k1.t - k0.t);
  const s = (u - k0.t) / d;
  const [a, b, before, after] = [channels(k0), channels(k1), channels(kp), channels(kn)];
  // Catmull-Rom tangents over the keys' times, scaled to this segment
  const tangent = (p: number[], q: number[], tp: number, tq: number, c: number) =>
    tq > tp ? ((q[c]! - p[c]!) / (tq - tp)) * d : 0;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;
  const v = a.map((_, c) => {
    const m0 = tangent(before, b, kp.t, k1.t, c);
    const m1 = tangent(a, after, k0.t, kn.t, c);
    return h00 * a[c]! + h10 * m0 + h01 * b[c]! + h11 * m1;
  });
  return { x: [v[0]!, v[1]!], y: [v[2]!, v[3]!], rotate: v[4]!, scale: v[5]! };
}

const n2 = (n: number) => Math.round(n * 100) / 100;
/** A length in CSS: calc(w·1cqw + h·1cqh), less `minus` (the box's own half, to centre it). */
export const cssLen = (l: Len, minus = '') =>
  `calc(${n2(l[0])}cqw + ${n2(l[1])}cqh${minus ? ` - ${minus}` : ''})`;

/** The pose as the mover's individual transform properties (its centre on the point). */
export const poseCss = (p: PropPose) => ({
  translate: `${cssLen(p.x, '50%')} ${cssLen(p.y, '50%')}`,
  rotate: `${n2(p.rotate)}deg`,
  scale: `${Math.round(p.scale * 1000) / 1000}`,
});

/** The flight as keyframes, `samples` + 1 poses along the curve (linear between them). */
export function propKeyframes(kind: SceneProp, samples = 40): string {
  const spec = PROPS[kind];
  const frames = Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const c = poseCss(poseAt(spec, t));
    return `${n2(t * 100)}%{translate:${c.translate};rotate:${c.rotate};scale:${c.scale}}`;
  });
  return `@keyframes scProp-${kind}{${frames.join('')}}`;
}

/** The target's box on the backdrop (its centre on its point), as CSS. */
export function targetBox(kind: SceneProp) {
  const t = PROPS[kind].target;
  const w = t.width;
  const h = w * t.aspect;
  return {
    left: cssLen([t.x[0] - w / 2, t.x[1]]),
    top: cssLen([t.y[0] - h / 2, t.y[1]]),
    width: `${n2(w)}cqw`,
  };
}

/** In px, on a backdrop `width` × `height` (the fallback without scroll-driven animations). */
export const lenPx = (l: Len, width: number, height: number) => (l[0] * width + l[1] * height) / 100;

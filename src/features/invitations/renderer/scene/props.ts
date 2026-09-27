import type { SceneProp } from '../../contracts/types';
import type { BurstKind } from '../fx/theme';

/**
 * The scene's props (renderer/scene): one thing that travels across the whole invitation as the guest
 * scrolls — pinned to the screen with the backdrop, from the first screen to the last — and arrives at
 * its target at the very end, where a finale plays: a basketball thrown in one long arc drops through
 * the hoop, a football curls into the top corner of the net, a rocket lands on the moon, a hot-air
 * balloon rises to the moon, the head tefillin come to rest on the bar mitzvah boy's head.
 *
 * Pure: the flight is a smooth curve through a few key poses (a cubic Hermite spline, Catmull-Rom
 * tangents), in lengths of the backdrop's box — hundredths of its width (cqw) plus hundredths of its
 * height (cqh) — so it fits every screen. SceneProp renders it as CSS keyframes that the scroll plays
 * (scroll-driven animations); SceneDriver plays the same poses frame by frame where the browser can't.
 */

/**
 * The prop's box: the backdrop — or, on a screen wider than this share of its height (a phone on its
 * side, a short window), a column this wide in its middle, so the flight and its target keep their
 * portrait shape (invitation.css: `.sc-prop`, 62cqh).
 */
export const PROP_COLUMN = 0.62;

/** A length on the prop's box: so many hundredths of its width (cqw) plus so many of its height (cqh). */
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

/** A box on the backdrop: its centre, its width (cqw) and its height over its width. */
interface Box {
  x: Len;
  y: Len;
  width: number;
  aspect: number;
}

/**
 * A point of the scroll: a share of it (0..1) — or so many screens (the backdrop's height) after its
 * start or before its end, the same on an invitation of any length.
 */
export type Mark = number | { readonly after: number } | { readonly before: number };

/** A stretch of the flight with key poses of its own (t from 0 to 1), played over its own stretch of the scroll. */
interface Phase {
  range: readonly [Mark, Mark];
  keys: readonly Key[];
}

export interface PropSpec {
  /** the prop's width at scale 1 (cqw) and its height over its width */
  size: number;
  aspect: number;
  /** the flight's key poses, t from 0 to 1: over the whole scroll — or, with a `lift` or a `land`, between them */
  keys: readonly Key[];
  /**
   * The flight's first and last moments, when they must play at the same pace on an invitation of any
   * length: `lift` from the scroll's start (its last pose is the flight's first), `land` to its end (its
   * first pose is the flight's last).
   */
  lift?: Phase;
  land?: Phase;
  /** the target, and when it fades in */
  target: Box & { reveal: readonly [Mark, Mark] };
  /** what holds the prop at the start (the tefillin's bag, behind it and in front of it), and when it goes */
  origin?: Box & { fade: readonly [Mark, Mark] };
  /**
   * The part of the mover that only travels with it (the head tefillin's strap, hanging from the box):
   * when it comes (`in`) and when it goes (`out`) — at the target the target's own art takes its place.
   */
  trail?: { in: readonly [Mark, Mark]; out: readonly [Mark, Mark] };
  /** screens of film after the last text: the finale's own stage, with nothing over it */
  stage?: number;
  /**
   * With reduced motion (or the host's motion at 0): `target` — the prop rests at its target from the
   * start (the default); `end` — it rests there too, but comes in with the target (on the stage, at the
   * end), and the target comes in by fading alone.
   */
  rest?: 'target' | 'end';
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
  // the head tefillin: lifted out of their velvet bag at the lower left, they float up through the
  // whole invitation, and on the film's last screen — its own stage — come down onto the boy's head as he
  // comes into the light: the base's front edge on his hairline, centred on the line of his face. Their
  // art (100 × 140): the box's front 40 wide, the base's front edge centred at (58, 68), 8 right of and 2
  // above the art's centre. The boy (400 × 600, 92cqw wide, standing on the bottom of the screen): his
  // hairline at (226, 144), where the box's front is 36 of his 400 — a quarter of his head's width.
  tefillin: {
    size: 30,
    aspect: 1.4,
    // out of the bag in the first half screen, whatever the invitation's length
    lift: {
      range: [0, { after: 0.42 }],
      keys: [
        // in the bag: the base's front edge on (70, 72) of the bag
        { t: 0, x: [19.6, 0], y: [-8.63, 94], rotate: 0, scale: 1 },
        { t: 0.55, x: [20.2, 0], y: [-27, 94], rotate: -2, scale: 0.99 },
        { t: 1, x: [24, 0], y: [-36, 91], rotate: -5, scale: 0.97 },
      ],
    },
    keys: [
      { t: 0, x: [24, 0], y: [-36, 91], rotate: -5, scale: 0.97 },
      { t: 0.14, x: [36, 0], y: [0, 56], rotate: -8, scale: 0.92 },
      { t: 0.34, x: [62, 0], y: [0, 40], rotate: 6, scale: 0.86 },
      { t: 0.54, x: [40, 0], y: [0, 31], rotate: -5, scale: 0.81 },
      { t: 0.74, x: [60, 0], y: [0, 27], rotate: 4, scale: 0.77 },
      // above where his head will be
      { t: 1, x: [52, 0], y: [-104.47, 70], rotate: -3, scale: 0.74 },
    ],
    // the stage: lowered onto his head, straightening, slowing as it settles
    land: {
      range: [{ before: 1 }, { before: 0.06 }],
      keys: [
        { t: 0, x: [52, 0], y: [-104.47, 70], rotate: -3, scale: 0.74 },
        { t: 0.5, x: [53.6, 0], y: [-104.47, 88], rotate: -1.2, scale: 0.71 },
        { t: 0.8, x: [54.2, 0], y: [-104.47, 97.5], rotate: -0.2, scale: 0.694 },
        { t: 1, x: [54.32, 0], y: [-104.47, 100], rotate: 0, scale: 0.69 },
      ],
    },
    // the boy: 92cqw wide, his feet — his shirt's hem — on the bottom of the screen
    target: { x: [50, 0], y: [-69, 100], width: 92, aspect: 1.5, reveal: [{ before: 1 }, { before: 0.4 }] },
    // the bag (140 × 110) on the table, at the lower left: gone before the first picture changes
    origin: {
      x: [22, 0],
      y: [-13.36, 94],
      width: 34,
      aspect: 110 / 140,
      fade: [{ after: 0.2 }, { after: 0.45 }],
    },
    // the strap comes out of the bag once the box is clear of its bottom, and goes as it lands
    trail: { in: [{ after: 0.16 }, { after: 0.32 }], out: [{ before: 0.95 }, { before: 0.6 }] },
    stage: 1,
    rest: 'end',
    burst: {
      kind: 'sparkles',
      at: { x: 0.565, y: 0.24 },
      colors: ['#FFE7A8', '#FFFFFF', '#E2C37E', '#F7D98B'],
      scale: 0.9,
    },
  },
};

type Channels = [xw: number, xh: number, yw: number, yh: number, rotate: number, scale: number];
const channels = (k: PropPose): Channels => [k.x[0], k.x[1], k.y[0], k.y[1], k.rotate, k.scale];

/** The pose `t` (0..1) of the way along key poses: a smooth curve through them. */
function curveAt(keys: readonly Key[], t: number): PropPose {
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

/** The prop's pose `t` (0..1) of the way along its flight's key poses (`keys`: between the lift and the landing). */
export const poseAt = (spec: PropSpec, t: number): PropPose => curveAt(spec.keys, t);

/** A mark as a share of a scroll `screens` screens long. */
export function markAt(m: Mark, screens: number): number {
  if (typeof m === 'number') return m;
  const n = 'after' in m ? m.after : m.before;
  const share = screens > 0 ? n / screens : 1;
  return 'after' in m ? share : 1 - share;
}

/** The flight's stretches in order — the lift, the flight, the landing — each with its keys and its scroll range. */
export function flightPhases(spec: PropSpec) {
  const phases: { suffix: '' | '-lift' | '-land'; keys: readonly Key[]; range: readonly [Mark, Mark] }[] = [];
  if (spec.lift) phases.push({ suffix: '-lift', ...spec.lift });
  phases.push({ suffix: '', keys: spec.keys, range: [spec.lift?.range[1] ?? 0, spec.land?.range[0] ?? 1] });
  if (spec.land) phases.push({ suffix: '-land', ...spec.land });
  return phases;
}

/**
 * The prop's pose at `u` (0..1) of a scroll `screens` screens long: in its lift, its flight or its
 * landing, wherever the scroll is — before the first it is at its first pose, after the last at its last.
 */
export function propPose(spec: PropSpec, u: number, screens: number): PropPose {
  const phases = flightPhases(spec);
  // the last stretch that has begun
  let k = 0;
  while (k < phases.length - 1 && u >= markAt(phases[k + 1]!.range[0], screens)) k++;
  const p = phases[k]!;
  const [a, b] = [markAt(p.range[0], screens), markAt(p.range[1], screens)];
  return curveAt(p.keys, b > a ? (u - a) / (b - a) : u >= b ? 1 : 0);
}

/** The prop where it starts, and where it comes to rest. */
export const firstPose = (spec: PropSpec) => curveAt((spec.lift ?? spec).keys, 0);
export const lastPose = (spec: PropSpec) => curveAt((spec.land ?? spec).keys, 1);

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

/** The flight as keyframes — each of its stretches, `samples` + 1 poses along its curve (linear between them). */
export function propKeyframes(kind: SceneProp, samples = 40): string {
  return flightPhases(PROPS[kind])
    .map((p) => {
      const frames = Array.from({ length: samples + 1 }, (_, i) => {
        const t = i / samples;
        const c = poseCss(curveAt(p.keys, t));
        return `${n2(t * 100)}%{translate:${c.translate};rotate:${c.rotate};scale:${c.scale}}`;
      });
      return `@keyframes scProp-${kind}${p.suffix}{${frames.join('')}}`;
    })
    .join('');
}

/** A mark as a point of a scroll timeline, in CSS (a screen: the backdrop's height, --sc-h). */
export function markCss(m: Mark): string {
  if (typeof m === 'number') return `${n2(m * 100)}%`;
  return 'after' in m
    ? `calc(${n2(m.after)} * var(--sc-h, 100vh))`
    : `calc(100% - ${n2(m.before)} * var(--sc-h, 100vh))`;
}

/**
 * The mover's flight as CSS declarations: one animation per stretch, each over its own range of the
 * scroll. The first fills both ways; each after it takes over from where it begins (it only fills
 * forwards), so the landing holds the prop on its target to the very end.
 */
export function flightCss(kind: SceneProp): string {
  const phases = flightPhases(PROPS[kind]);
  if (phases.length === 1) return `animation:scProp-${kind} linear both;animation-timeline:scroll(nearest)`;
  return (
    `animation:${phases.map((p, i) => `scProp-${kind}${p.suffix} linear ${i ? 'forwards' : 'both'}`).join(',')};` +
    `animation-timeline:${phases.map(() => 'scroll(nearest)').join(',')};` +
    `animation-range:${phases.map((p) => `${markCss(p.range[0])} ${markCss(p.range[1])}`).join(',')}`
  );
}

/** A box on the backdrop (its centre on its point), as CSS. */
function boxCss(b: Box) {
  const w = b.width;
  const h = w * b.aspect;
  return {
    left: cssLen([b.x[0] - w / 2, b.x[1]]),
    top: cssLen([b.y[0] - h / 2, b.y[1]]),
    width: `${n2(w)}cqw`,
  };
}

/** The target's box on the backdrop, as CSS. */
export const targetBox = (kind: SceneProp) => boxCss(PROPS[kind].target);

/** The origin's box on the backdrop, as CSS (null: the prop has none). */
export function originBox(kind: SceneProp) {
  const o = PROPS[kind].origin;
  return o ? boxCss(o) : null;
}

/**
 * The scroll ranges the prop's parts play over, as the custom properties SceneProp puts on it: the
 * target's fade-in (--sc-ta → --sc-tb), the origin's fade-out (--sc-oa → --sc-ob), the trail's coming
 * in (--sc-ia → --sc-ib) and its going (--sc-ra → --sc-rb).
 */
export function propRanges(kind: SceneProp): Record<string, string> {
  const s = PROPS[kind];
  const out: Record<string, string> = {
    '--sc-ta': markCss(s.target.reveal[0]),
    '--sc-tb': markCss(s.target.reveal[1]),
  };
  if (s.origin)
    Object.assign(out, { '--sc-oa': markCss(s.origin.fade[0]), '--sc-ob': markCss(s.origin.fade[1]) });
  if (s.trail)
    Object.assign(out, {
      '--sc-ia': markCss(s.trail.in[0]),
      '--sc-ib': markCss(s.trail.in[1]),
      '--sc-ra': markCss(s.trail.out[0]),
      '--sc-rb': markCss(s.trail.out[1]),
    });
  return out;
}

/**
 * How far each part's fade has gone (0..1) at `u` (0..1) of a scroll `screens` screens long — for the
 * driver, where the browser can't play them: the target's reveal, the origin's going, the trail's
 * coming and its going.
 */
export function propFades(spec: PropSpec, u: number, screens: number) {
  const k = (r: readonly [Mark, Mark] | undefined) => {
    if (!r) return 0;
    const [a, b] = [markAt(r[0], screens), markAt(r[1], screens)];
    return Math.min(1, Math.max(0, b > a ? (u - a) / (b - a) : u >= b ? 1 : 0));
  };
  return {
    target: k(spec.target.reveal),
    origin: k(spec.origin?.fade),
    trailIn: k(spec.trail?.in),
    trailOut: k(spec.trail?.out),
  };
}

/** In px, on a backdrop `width` × `height` (the fallback without scroll-driven animations). */
export const lenPx = (l: Len, width: number, height: number) => (l[0] * width + l[1] * height) / 100;

import type { SceneDrift, SceneZoom } from '../../contracts/types';

/**
 * The scroll scene's timeline (renderer/scene): where each picture of the backdrop is, for a scroll
 * position. Pure — the driver (SceneDriver.client.tsx) calls it every frame the page moves, the unit
 * tests read it.
 */

/** A picture's stretch of the page, in the track's coordinates (px), and how it moves. */
export interface LayerGeometry {
  /** its first section's top (0 for the first picture) */
  start: number;
  /** the next picture's start (the page's end for the last) */
  end: number;
  zoom: SceneZoom;
  drift: SceneDrift | null;
}

export interface LayerState {
  /** 0..1 — the cross-fade (the first picture is always 1: it is the ground) */
  opacity: number;
  /** the Ken Burns zoom, 1..1+zoom */
  scale: number;
  /** the drift, px (+: down) */
  shift: number;
  /** 0..1 — how far through its stretch the page is (the zoom's and the drift's progress) */
  progress: number;
}

export interface TimelineOptions {
  /** the cross-fade starts when the picture's first section's top reaches this share of the screen… */
  from: number;
  /** …and ends when it reaches this one */
  to: number;
  /** the zoom a picture gains over its stretch (0.08: 1 → 1.08) */
  zoom: number;
  /** a drifting picture's travel each way, a share of the screen */
  drift: number;
}

/**
 * Where a picture's scroll-driven animations run (the browser plays them from the scroll — SceneDriver
 * measures these once per layout, never per frame): px of scroll in the track's coordinates, and the
 * zoom and the drift at either end of the passage.
 */
export interface LayerRanges {
  /** the cross-fade, from its start to its end (null for the first picture: it is the ground) */
  fade: [number, number] | null;
  /** the passage (the zoom, the drift), from its start to its end */
  move: [number, number];
  /** the zoom at the passage's start and end */
  scale: [number, number];
  /** the drift (px, +: down) at the passage's start and end */
  shift: [number, number];
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
/** Eased at both ends: the cross-fade starts and settles gently. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The picture's cross-fade and its passage, px from the track's top. */
function spans(layer: LayerGeometry, k: number, h: number, o: TimelineOptions) {
  const fadeFrom = layer.start - o.from * h;
  const fadeLength = Math.max(1, (o.from - o.to) * h);
  // its passage: from its cross-fade's start to the end of the next one's
  const enter = k === 0 ? 0 : fadeFrom;
  const leave = Math.max(enter + 1, layer.end - o.to * h);
  return { fadeFrom, fadeLength, enter, leave };
}

/** The zoom and the drift `progress` (0..1) of the way through the passage. */
function motionAt(layer: LayerGeometry, progress: number, h: number, o: TimelineOptions) {
  // a picture behind a long stretch (a design's one picture behind the whole invitation) goes further,
  // at the same slow pace: 1.08 per screen and a half, up to 1.2
  const reach = Math.min(2.5, Math.max(1, (layer.end - layer.start) / (1.5 * h)));
  const zoom = o.zoom * reach;
  const scale =
    layer.zoom === 'in' ? 1 + zoom * progress : layer.zoom === 'out' ? 1 + zoom * (1 - progress) : 1;
  const travel = o.drift * h;
  const shift =
    layer.drift === 'up'
      ? (progress * 2 - 1) * travel
      : layer.drift === 'down'
        ? (1 - progress * 2) * travel
        : 0;
  return { scale, shift };
}

/**
 * The picture `k` at scroll position `y` (px from the track's top) on a screen `height` px tall. The
 * next picture fades in as its first section's top crosses the middle band of the screen (from 65% to
 * 35% of its height: ~30% of a screen of overlap); a picture zooms (and drifts) over its whole passage —
 * from the moment it starts fading in until the next one has covered it.
 */
export function layerState(
  layer: LayerGeometry,
  k: number,
  y: number,
  height: number,
  o: TimelineOptions,
): LayerState {
  const h = Math.max(1, height);
  const { fadeFrom, fadeLength, enter, leave } = spans(layer, k, h, o);
  const opacity = k === 0 ? 1 : smooth(clamp01((y - fadeFrom) / fadeLength));
  const progress = clamp01((y - enter) / (leave - enter));
  return { opacity, ...motionAt(layer, progress, h, o), progress };
}

/**
 * The same timeline as scroll ranges, for the browser to play (scroll-driven animations): the picture's
 * cross-fade (eased at both ends, like layerState's) and its passage, with the zoom and the drift at
 * either end — linear in between, as in layerState.
 */
export function layerRanges(
  layer: LayerGeometry,
  k: number,
  height: number,
  o: TimelineOptions,
): LayerRanges {
  const h = Math.max(1, height);
  const { fadeFrom, fadeLength, enter, leave } = spans(layer, k, h, o);
  const from = motionAt(layer, 0, h, o);
  const to = motionAt(layer, 1, h, o);
  return {
    fade: k === 0 ? null : [fadeFrom, fadeFrom + fadeLength],
    move: [enter, leave],
    scale: [from.scale, to.scale],
    shift: [from.shift, to.shift],
  };
}

/**
 * Whether picture `k` can be seen from scroll position `y`, give or take `margin` px: from its
 * cross-fade's start until the next picture has covered it. Outside that it is hidden (never painted),
 * and the margin keeps it ready while the scroll that the browser runs on its own is near either end.
 */
export function layerShown(ranges: readonly LayerRanges[], k: number, y: number, margin: number): boolean {
  const from = ranges[k]?.fade?.[0] ?? -Infinity;
  const to = ranges[k + 1]?.fade?.[1] ?? Infinity;
  return y + margin >= from && y - margin <= to;
}

/**
 * layerShown as bands around the screen, for an IntersectionObserver on the sections in front of each
 * picture (its stretch of the page): with `margin` screens either side, a picture is in play exactly
 * while one of its sections is within `top` screens above the screen or `bottom` screens below it.
 */
export function inPlayMargins(o: Pick<TimelineOptions, 'from' | 'to'>, margin: number) {
  return { top: margin - o.to, bottom: o.from + margin - 1 };
}

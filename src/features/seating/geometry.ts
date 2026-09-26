import {
  LIMITS,
  type Landmark,
  type LandmarkKind,
  type Layout,
  type Plan,
  type PrefZone,
  type SeatingTable,
  type TableShape,
} from './model';

/**
 * Seating geometry — pure, in meters (x right, y down; rotation in degrees clockwise, as SVG draws it).
 * Unit-tested in tests/unit/seating-geometry.test.ts.
 */

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** A seat's share of a table's edge (a chair and elbow room), meters. */
export const SEAT_PITCH = 0.6;
/** How far a chair's center sits from the table's edge, and its radius (drawing only). */
export const CHAIR_OFFSET = 0.32;
export const CHAIR_RADIUS = 0.22;

/** The usual capacity of a new table of each shape. */
export const DEFAULT_CAPACITY: Record<TableShape, number> = { round: 10, rect: 8, knights: 20 };

/**
 * A table's size for its shape and seats — what venues use: round tables whose edge gives each seat
 * ~0.56 m (10 seats → 1.8 m, 12 → 2.1 m); rectangular tables 0.9 m deep with 0.6 m per seat along both
 * long sides (a small one is square); knights (banquet) tables 1 m deep, seats along both long sides.
 */
export function defaultTableSize(shape: TableShape, capacity: number): { w: number; h: number } {
  const n = Math.max(1, Math.round(capacity));
  if (shape === 'round') {
    const d = Math.max(0.8, round1((n * 0.56) / Math.PI));
    return { w: d, h: d };
  }
  if (shape === 'rect') {
    if (n <= 4) return { w: 0.9, h: 0.9 };
    return { w: round1(Math.ceil(n / 2) * SEAT_PITCH), h: 0.9 };
  }
  return { w: round1(Math.max(2, Math.ceil(n / 2) * SEAT_PITCH)), h: 1 };
}

/** Rotates p around the origin by `deg` degrees clockwise (y down). */
export function rotate(p: Point, deg: number): Point {
  if (!deg) return p;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/**
 * Where a table's chairs go, relative to its center before rotation: evenly around a round table;
 * along the two long sides of a rectangular one (a small square table: one per side; an odd seat goes
 * to an end); along the long sides only for a knights table.
 */
export function chairPositions(t: Pick<SeatingTable, 'shape' | 'capacity' | 'w' | 'h'>): Point[] {
  const n = Math.max(0, Math.round(t.capacity));
  if (n === 0) return [];
  if (t.shape === 'round') {
    const r = t.w / 2 + CHAIR_OFFSET;
    return Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      return { x: round2(r * Math.cos(a)), y: round2(r * Math.sin(a)) };
    });
  }
  const hw = t.w / 2;
  const hh = t.h / 2;
  const along = (count: number, y: number): Point[] =>
    Array.from({ length: count }, (_, i) => ({ x: round2(-hw + (t.w * (i + 0.5)) / count), y }));
  if (t.shape === 'rect' && n <= 4) {
    const sides: Point[] = [
      { x: 0, y: -hh - CHAIR_OFFSET },
      { x: 0, y: hh + CHAIR_OFFSET },
      { x: -hw - CHAIR_OFFSET, y: 0 },
      { x: hw + CHAIR_OFFSET, y: 0 },
    ];
    return sides.slice(0, n);
  }
  const top = Math.ceil(n / 2);
  const bottom = Math.floor(n / 2);
  return [...along(top, round2(-hh - CHAIR_OFFSET)), ...along(bottom, round2(hh + CHAIR_OFFSET))];
}

/** The four corners of a (rotated) rectangle centered at (x, y), in world coordinates. */
export function corners(r: { x: number; y: number; w: number; h: number; rotation: number }): Point[] {
  return [
    { x: -r.w / 2, y: -r.h / 2 },
    { x: r.w / 2, y: -r.h / 2 },
    { x: r.w / 2, y: r.h / 2 },
    { x: -r.w / 2, y: r.h / 2 },
  ].map((p) => {
    const q = rotate(p, r.rotation);
    return { x: r.x + q.x, y: r.y + q.y };
  });
}

/** The axis-aligned box around a table with its chairs (or a landmark). */
export function bounds(item: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape?: TableShape;
}): Rect {
  const pad = item.shape ? CHAIR_OFFSET + CHAIR_RADIUS : 0;
  if (item.shape === 'round') {
    const r = item.w / 2 + pad;
    return { x: item.x - r, y: item.y - r, w: 2 * r, h: 2 * r };
  }
  const pts = corners({ ...item, w: item.w + 2 * pad, h: item.h + 2 * pad });
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function union(a: Rect | null, b: Rect): Rect {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** The plan's scale: calibrated, or a typical hall's width assumed across the image. */
export function planScale(layout: Pick<Layout, 'background' | 'metersPerPixel'>): number | null {
  const b = layout.background;
  if (!b?.width) return null;
  return layout.metersPerPixel ?? LIMITS.assumedPlanWidth / b.width;
}

/** The floor plan's size in meters (null: no plan image yet) — it sits at (0, 0). */
export function planSize(
  layout: Pick<Layout, 'background' | 'metersPerPixel'>,
): { w: number; h: number } | null {
  const b = layout.background;
  const s = planScale(layout);
  if (!b?.width || !b.height || !s) return null;
  return { w: b.width * s, h: b.height * s };
}

/** Everything there is to see: the plan (or an empty room), the tables and the landmarks. */
export function contentBounds(plan: Pick<Plan, 'layout' | 'tables'>): Rect {
  const size = planSize(plan.layout);
  let box: Rect = { x: 0, y: 0, w: size?.w ?? LIMITS.roomW, h: size?.h ?? LIMITS.roomH };
  for (const t of plan.tables) box = union(box, bounds(t));
  for (const m of plan.layout.landmarks) box = union(box, bounds(m));
  return box;
}

/** The tables and landmarks with some room around them (null: there are none) — a print without a plan. */
export function itemsBounds(plan: Pick<Plan, 'layout' | 'tables'>, margin = 1.5): Rect | null {
  let box: Rect | null = null;
  for (const t of plan.tables) box = union(box, bounds(t));
  for (const m of plan.layout.landmarks) box = union(box, bounds(m));
  return box && { x: box.x - margin, y: box.y - margin, w: box.w + 2 * margin, h: box.h + 2 * margin };
}

export const snap = (v: number, grid: number) => (grid > 0 ? Math.round(v / grid) * grid : v);
export const snapPoint = (p: Point, grid: number): Point => ({
  x: round2(snap(p.x, grid)),
  y: round2(snap(p.y, grid)),
});
export const clampCoord = (v: number) => Math.min(LIMITS.maxCoord, Math.max(LIMITS.minCoord, round2(v)));
export const normalizeRotation = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/** Distance from a point to a (rotated) rectangle: 0 inside it. */
export function distanceToRect(
  p: Point,
  r: { x: number; y: number; w: number; h: number; rotation: number },
): number {
  const q = rotate({ x: p.x - r.x, y: p.y - r.y }, -r.rotation);
  const dx = Math.max(Math.abs(q.x) - r.w / 2, 0);
  const dy = Math.max(Math.abs(q.y) - r.h / 2, 0);
  return Math.hypot(dx, dy);
}

/** Which landmarks count for a zone: the stage, the dance floor, the exits and entrances. */
const ZONE_LANDMARKS: Record<PrefZone, readonly LandmarkKind[]> = {
  stage: ['stage'],
  dance: ['dance'],
  exit: ['exit', 'entrance'],
};
/** "Near": within NEAR_M meters of the table's edge counts fully; by FAR_M it doesn't count at all. */
export const NEAR_M = 2;
export const FAR_M = 12;

/**
 * How near a table is to a zone, 0–1: 1 when the host marked it so; otherwise from the landmarks drawn
 * on the plan — 1 within 2 m of its edge, fading to 0 at 12 m; 0 when there is nothing to measure from.
 */
export function proximity(table: SeatingTable, landmarks: readonly Landmark[], zone: PrefZone): number {
  if (table.zones.includes(zone)) return 1;
  const kinds = ZONE_LANDMARKS[zone];
  let best = Infinity;
  const edge = table.shape === 'round' ? table.w / 2 : Math.min(table.w, table.h) / 2;
  for (const m of landmarks) {
    if (!kinds.includes(m.kind)) continue;
    best = Math.min(best, Math.max(0, distanceToRect(table, m) - edge));
  }
  if (best === Infinity) return 0;
  if (best <= NEAR_M) return 1;
  if (best >= FAR_M) return 0;
  return round2(1 - (best - NEAR_M) / (FAR_M - NEAR_M));
}

// ─── calibration ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calibration: a line drawn on the plan from `a` to `b` (meters at the current scale) is really
 * `meters` long. Returns the plan's new meters-per-pixel, or null for a line too short to measure.
 */
export function calibrate(a: Point, b: Point, meters: number, currentScale: number): number | null {
  const drawn = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(meters > 0) || !(currentScale > 0) || drawn / currentScale < 4) return null;
  return meters / (drawn / currentScale);
}

/**
 * A new scale for the plan keeps everything on the same spot of the image: table positions and the
 * landmarks (drawn over the plan's own stage, bar…) scale with it; tables keep their real size.
 */
export function rescalePlan<P extends Pick<Plan, 'tables' | 'layout'>>(plan: P, factor: number): P {
  if (!(factor > 0) || factor === 1) return plan;
  return {
    ...plan,
    tables: plan.tables.map((t) => ({ ...t, x: clampCoord(t.x * factor), y: clampCoord(t.y * factor) })),
    layout: {
      ...plan.layout,
      landmarks: plan.layout.landmarks.map((m) => ({
        ...m,
        x: clampCoord(m.x * factor),
        y: clampCoord(m.y * factor),
        w: Math.min(500, round2(m.w * factor)),
        h: Math.min(500, round2(m.h * factor)),
      })),
    },
  };
}

// ─── the view (zoom and pan) ─────────────────────────────────────────────────────────────────────

/** The canvas view: screen pixels per meter, and the screen position of the world's origin. */
export interface View {
  scale: number;
  tx: number;
  ty: number;
}
export const MIN_SCALE = 2;
export const MAX_SCALE = 400;

export const toScreen = (v: View, p: Point): Point => ({ x: p.x * v.scale + v.tx, y: p.y * v.scale + v.ty });
export const toWorld = (v: View, p: Point): Point => ({
  x: (p.x - v.tx) / v.scale,
  y: (p.y - v.ty) / v.scale,
});

/** Zooms by `factor` keeping the world point under the screen point `at` in place (wheel, pinch). */
export function zoomAt(v: View, factor: number, at: Point): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const f = scale / v.scale;
  return { scale, tx: at.x - (at.x - v.tx) * f, ty: at.y - (at.y - v.ty) * f };
}

/** The view that shows `box` whole in a viewport of `vw` × `vh` pixels, with a margin. */
export function fitView(box: Rect, vw: number, vh: number, margin = 24): View {
  const w = Math.max(1, box.w);
  const h = Math.max(1, box.h);
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min((vw - 2 * margin) / w, (vh - 2 * margin) / h)),
  );
  return { scale, tx: (vw - w * scale) / 2 - box.x * scale, ty: (vh - h * scale) / 2 - box.y * scale };
}

/** A pinch: two pointers moved from (a0, b0) to (a1, b1) — zoom by the change in their distance, pan by
 * the move of their midpoint. */
export function pinch(v: View, a0: Point, b0: Point, a1: Point, b1: Point): View {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const zoomed = d0 > 0 ? zoomAt(v, d1 / d0, m0) : v;
  return { ...zoomed, tx: zoomed.tx + m1.x - m0.x, ty: zoomed.ty + m1.y - m0.y };
}

/** A free spot for a new table near `near`: the first place along a spiral that doesn't overlap. */
export function freeSpot(
  near: Point,
  size: { w: number; h: number },
  taken: readonly Rect[],
  grid: number,
): Point {
  const step = Math.max(grid, 0.5);
  const fits = (p: Point) => {
    const r = { x: p.x - size.w / 2 - 0.6, y: p.y - size.h / 2 - 0.6, w: size.w + 1.2, h: size.h + 1.2 };
    return taken.every((t) => r.x + r.w <= t.x || t.x + t.w <= r.x || r.y + r.h <= t.y || t.y + t.h <= r.y);
  };
  const start = snapPoint(near, grid);
  if (fits(start)) return start;
  for (let ring = 1; ring < 60; ring++) {
    for (let i = 0; i < ring * 8; i++) {
      const a = (2 * Math.PI * i) / (ring * 8);
      const p = snapPoint(
        { x: start.x + Math.cos(a) * ring * step * 2, y: start.y + Math.sin(a) * ring * step * 2 },
        grid,
      );
      if (p.x >= 0 && p.y >= 0 && fits(p)) return p;
    }
  }
  return start;
}

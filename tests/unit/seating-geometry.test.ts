import { describe, expect, it } from 'vitest';
import {
  bounds,
  calibrate,
  chairPositions,
  contentBounds,
  defaultTableSize,
  distanceToRect,
  fitView,
  freeSpot,
  pinch,
  planScale,
  planSize,
  proximity,
  rescalePlan,
  rotate,
  snapPoint,
  toScreen,
  toWorld,
  zoomAt,
} from '@/features/seating/geometry';
import { DEFAULT_SETTINGS, type Landmark, type Plan, type SeatingTable } from '@/features/seating/model';

// Seating geometry (src/features/seating/geometry.ts): table sizes and chairs, rotation, snapping,
// proximity to the stage, calibration of the floor plan, and the canvas's zoom / pan / pinch.

const table = (over: Partial<SeatingTable> = {}): SeatingTable => ({
  id: 't',
  number: 1,
  label: null,
  shape: 'round',
  capacity: 10,
  x: 5,
  y: 5,
  w: 1.8,
  h: 1.8,
  rotation: 0,
  zones: [],
  locked: false,
  ...over,
});
const landmark = (over: Partial<Landmark> = {}): Landmark => ({
  id: 'l',
  kind: 'stage',
  x: 5,
  y: 0,
  w: 6,
  h: 2,
  rotation: 0,
  label: null,
  ...over,
});
const layout = (over: Partial<Plan['layout']> = {}): Plan['layout'] => ({
  background: null,
  metersPerPixel: null,
  source: null,
  gridM: 0.5,
  landmarks: [],
  settings: DEFAULT_SETTINGS,
  ...over,
});

describe('tables', () => {
  it('sizes a table for its seats like venues do', () => {
    expect(defaultTableSize('round', 10)).toEqual({ w: 1.8, h: 1.8 });
    expect(defaultTableSize('round', 12)).toEqual({ w: 2.1, h: 2.1 });
    expect(defaultTableSize('rect', 4)).toEqual({ w: 0.9, h: 0.9 });
    expect(defaultTableSize('rect', 8)).toEqual({ w: 2.4, h: 0.9 });
    expect(defaultTableSize('knights', 20)).toEqual({ w: 6, h: 1 });
  });

  it('puts a chair per seat: around a round table, along the long sides of the others', () => {
    const round = chairPositions(table({ capacity: 8 }));
    expect(round).toHaveLength(8);
    // all at the same distance from the center, the first straight up
    for (const p of round) expect(Math.hypot(p.x, p.y)).toBeCloseTo(0.9 + 0.32, 1);
    expect(round[0]).toEqual({ x: 0, y: -1.22 });
    const knights = chairPositions(table({ shape: 'knights', capacity: 7, w: 2.4, h: 1 }));
    expect(knights.filter((p) => p.y < 0)).toHaveLength(4);
    expect(knights.filter((p) => p.y > 0)).toHaveLength(3);
    expect(chairPositions(table({ shape: 'rect', capacity: 3, w: 0.9, h: 0.9 }))).toHaveLength(3);
  });

  it('rotates clockwise (y down), and bounds a rotated table with its chairs', () => {
    const p = rotate({ x: 1, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
    const b = bounds(table({ shape: 'rect', w: 2, h: 1, rotation: 90, x: 0, y: 0 }));
    // rotated a quarter: 1 m wide and 2 m tall, plus the chairs' room on each side
    expect(b.w).toBeCloseTo(1 + 2 * 0.54, 5);
    expect(b.h).toBeCloseTo(2 + 2 * 0.54, 5);
  });

  it('snaps to the grid, and finds a free spot next to other tables', () => {
    expect(snapPoint({ x: 1.26, y: 3.74 }, 0.5)).toEqual({ x: 1.5, y: 3.5 });
    const taken = [bounds(table({ x: 5, y: 5 }))];
    const spot = freeSpot({ x: 5, y: 5 }, { w: 1.8, h: 1.8 }, taken, 0.5);
    expect(Math.hypot(spot.x - 5, spot.y - 5)).toBeGreaterThan(2);
    expect(spot.x % 0.5).toBeCloseTo(0);
  });
});

describe('proximity', () => {
  it('is 1 when the host marked the table, else measured from the landmarks: near 1, far 0', () => {
    expect(proximity(table({ zones: ['stage'] }), [], 'stage')).toBe(1);
    expect(proximity(table(), [], 'stage')).toBe(0);
    // the stage's edge is at y = 1; the table's edge at y = 4.1 → 3.1 m apart
    const near = proximity(table(), [landmark()], 'stage');
    expect(near).toBeGreaterThan(0.8);
    expect(near).toBeLessThan(1);
    expect(proximity(table({ y: 30 }), [landmark()], 'stage')).toBe(0);
    expect(proximity(table({ y: 2 }), [landmark()], 'stage')).toBe(1);
    // an entrance counts as a way out
    expect(proximity(table({ y: 2 }), [landmark({ kind: 'entrance' })], 'exit')).toBe(1);
  });

  it('measures to a rotated rectangle', () => {
    expect(distanceToRect({ x: 0, y: 0 }, { x: 0, y: 0, w: 2, h: 2, rotation: 45 })).toBe(0);
    expect(distanceToRect({ x: 3, y: 0 }, { x: 0, y: 0, w: 2, h: 2, rotation: 0 })).toBeCloseTo(2);
    expect(distanceToRect({ x: 3, y: 0 }, { x: 0, y: 0, w: 2, h: 2, rotation: 45 })).toBeCloseTo(
      3 - Math.SQRT2,
    );
  });
});

describe('the floor plan and calibration', () => {
  it('sits at the origin, sized by its scale (a typical hall until calibrated)', () => {
    const bg = { path: 'a/b/c.png', type: 'image/png' as const, width: 2000, height: 1000 };
    expect(planScale(layout({ background: bg }))).toBeCloseTo(30 / 2000);
    expect(planSize(layout({ background: bg, metersPerPixel: 0.02 }))).toEqual({ w: 40, h: 20 });
    expect(planSize(layout())).toBeNull();
    expect(contentBounds({ layout: layout(), tables: [] })).toEqual({ x: 0, y: 0, w: 30, h: 20 });
  });

  it('a line of known length gives the meters per pixel', () => {
    // at 0.015 m/px, a 6 m line on screen is 400 px of the image; it is really 10 m
    expect(calibrate({ x: 0, y: 0 }, { x: 6, y: 0 }, 10, 0.015)).toBeCloseTo(0.025);
    expect(calibrate({ x: 0, y: 0 }, { x: 3, y: 4 }, 10, 0.01)).toBeCloseTo(0.02);
    // too short to measure, or nonsense
    expect(calibrate({ x: 0, y: 0 }, { x: 0.01, y: 0 }, 10, 0.015)).toBeNull();
    expect(calibrate({ x: 0, y: 0 }, { x: 6, y: 0 }, 0, 0.015)).toBeNull();
  });

  it('a new scale keeps tables on their spots of the plan, at their real size; landmarks scale with it', () => {
    const plan = {
      tables: [table({ x: 10, y: 4 })],
      layout: layout({ landmarks: [landmark({ x: 6, y: 2, w: 6, h: 2 })] }),
    };
    const next = rescalePlan(plan, 1.5);
    expect(next.tables[0]).toMatchObject({ x: 15, y: 6, w: 1.8, h: 1.8 });
    expect(next.layout.landmarks[0]).toMatchObject({ x: 9, y: 3, w: 9, h: 3 });
    expect(rescalePlan(plan, 1)).toBe(plan);
  });
});

describe('the view', () => {
  it('maps world to screen and back', () => {
    const v = { scale: 20, tx: 100, ty: 50 };
    expect(toScreen(v, { x: 2, y: 3 })).toEqual({ x: 140, y: 110 });
    expect(toWorld(v, { x: 140, y: 110 })).toEqual({ x: 2, y: 3 });
  });

  it('zooms around the pointer: the point under it stays put', () => {
    const v = { scale: 20, tx: 100, ty: 50 };
    const at = { x: 300, y: 200 };
    const before = toWorld(v, at);
    const z = zoomAt(v, 2, at);
    expect(z.scale).toBe(40);
    const after = toWorld(z, at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    // clamped
    expect(zoomAt(v, 1e6, at).scale).toBe(400);
  });

  it('fits a box in the viewport, centered', () => {
    const v = fitView({ x: 0, y: 0, w: 30, h: 20 }, 648, 448, 24);
    expect(v.scale).toBe(20);
    expect(toScreen(v, { x: 15, y: 10 })).toEqual({ x: 324, y: 224 });
  });

  it('pinch: fingers apart zoom in around their middle; moving together pans', () => {
    const v = { scale: 10, tx: 0, ty: 0 };
    const z = pinch(v, { x: 100, y: 100 }, { x: 200, y: 100 }, { x: 50, y: 100 }, { x: 250, y: 100 });
    expect(z.scale).toBe(20);
    expect(toWorld(z, { x: 150, y: 100 })).toEqual(toWorld(v, { x: 150, y: 100 }));
    const p = pinch(v, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 10, y: 5 }, { x: 110, y: 5 });
    expect(p).toEqual({ scale: 10, tx: 10, ty: 5 });
  });
});

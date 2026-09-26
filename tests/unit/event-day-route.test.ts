import { describe, expect, it } from 'vitest';
import { CHAIR_OFFSET, CHAIR_RADIUS, rotate, type Point } from '@/features/seating/geometry';
import type { Landmark } from '@/features/seating/model';
import type { HallTable } from '@/features/event-day/model';
import { chairEdge, CLEARANCE, findRoute, pathLength } from '@/features/event-day/route';

// The way from the entrance to a guest's table (features/event-day/route.ts): around tables and their
// chairs, around the stage and the bar, across the dance floor; from the nearest entrance; none without
// an entrance or a way through.

const table = (
  id: string,
  number: number,
  x: number,
  y: number,
  over: Partial<HallTable> = {},
): HallTable => ({
  id,
  number,
  shape: 'round',
  capacity: 10,
  x,
  y,
  w: 1.8,
  h: 1.8,
  rotation: 0,
  ...over,
});
const mark = (
  id: string,
  kind: Landmark['kind'],
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0,
): Landmark => ({
  id,
  kind,
  x,
  y,
  w,
  h,
  rotation,
  label: null,
});

/** Distance from a point to a table's chairs ring (negative: inside it). */
function clearanceTo(p: Point, t: HallTable): number {
  const chairs = CHAIR_OFFSET + CHAIR_RADIUS;
  if (t.shape === 'round') return Math.hypot(p.x - t.x, p.y - t.y) - (t.w / 2 + chairs);
  const q = rotate({ x: p.x - t.x, y: p.y - t.y }, -t.rotation);
  const dx = Math.abs(q.x) - (t.w / 2 + chairs);
  const dy = Math.abs(q.y) - (t.h / 2 + chairs);
  return dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy);
}

/** Every point along the path, every few centimeters. */
function samples(points: Point[], every = 0.05): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / every));
    for (let s = 0; s <= n; s++) out.push({ x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n });
  }
  return out;
}

const insideRect = (p: Point, m: Landmark) => {
  const q = rotate({ x: p.x - m.x, y: p.y - m.y }, -m.rotation);
  return Math.abs(q.x) < m.w / 2 && Math.abs(q.y) < m.h / 2;
};

describe('findRoute', () => {
  it('goes straight when nothing is in the way, from the entrance to the table’s chairs', () => {
    const t = table('t1', 1, 10, 5);
    const route = findRoute({ tables: [t], landmarks: [mark('in', 'entrance', 0, 5, 2, 0.5)] }, 't1')!;
    expect(route.entranceId).toBe('in');
    expect(route.points[0]).toEqual({ x: 0, y: 5 });
    const end = route.points.at(-1)!;
    // it ends at the chairs on the entrance's side
    expect(end.x).toBeCloseTo(10 - (0.9 + CHAIR_OFFSET + CHAIR_RADIUS), 1);
    expect(end.y).toBeCloseTo(5, 0);
    // nearly a straight line
    expect(route.length).toBeLessThan(10 - 1.4 + 0.6);
    expect(route.points.length).toBeLessThanOrEqual(4);
  });

  it('walks around the tables in between — never through a table or its chairs', () => {
    const tables = [table('a', 1, 5, 5), table('b', 2, 5, 3), table('c', 3, 5, 7), table('goal', 4, 10, 5)];
    const route = findRoute({ tables, landmarks: [mark('in', 'entrance', 0, 5, 2, 0.5)] }, 'goal')!;
    expect(route).not.toBeNull();
    for (const p of samples(route.points))
      for (const t of tables.filter((x) => x.id !== 'goal')) expect(clearanceTo(p, t)).toBeGreaterThan(0.05);
    // longer than the straight line it couldn't take
    expect(route.length).toBeGreaterThan(pathLength([route.points[0]!, route.points.at(-1)!]) + 0.5);
  });

  it('goes around the stage and the bar, across the dance floor', () => {
    const stage = mark('stage', 'stage', 6, 5, 2, 8);
    const dance = mark('dance', 'dance', 6, 12, 4, 4);
    const t = table('goal', 1, 12, 5);
    const route = findRoute(
      { tables: [t], landmarks: [mark('in', 'entrance', 0, 5, 2, 0.5), stage, dance] },
      'goal',
    )!;
    for (const p of samples(route.points))
      expect(
        insideRect(p, { ...stage, w: stage.w + 2 * CLEARANCE - 0.1, h: stage.h + 2 * CLEARANCE - 0.1 }),
      ).toBe(false);
    // around the stage's short way (its ends are at y = 1 and y = 9)
    expect(route.length).toBeLessThan(18);
  });

  it('starts at the entrance nearest to the table', () => {
    const t = table('goal', 1, 18, 5);
    const route = findRoute(
      {
        tables: [t],
        landmarks: [mark('front', 'entrance', 0, 5, 2, 0.5), mark('back', 'entrance', 20, 5, 2, 0.5)],
      },
      'goal',
    )!;
    expect(route.entranceId).toBe('back');
  });

  it('reaches rotated and long tables at their chairs', () => {
    const t = table('goal', 1, 10, 5, { shape: 'knights', w: 6, h: 1, capacity: 20, rotation: 90 });
    const route = findRoute({ tables: [t], landmarks: [mark('in', 'entrance', 0, 5, 2, 0.5)] }, 'goal')!;
    const end = route.points.at(-1)!;
    expect(Math.abs(clearanceTo(end, t))).toBeLessThan(0.05);
    for (const p of samples(route.points.slice(0, -1))) expect(clearanceTo(p, t)).toBeGreaterThan(-0.05);
  });

  it('none without an entrance, for an unknown table, or when the table is walled in', () => {
    const t = table('goal', 1, 10, 5);
    expect(findRoute({ tables: [t], landmarks: [] }, 'goal')).toBeNull();
    expect(findRoute({ tables: [t], landmarks: [mark('in', 'entrance', 0, 5, 2, 0.5)] }, 'nope')).toBeNull();
    const walls = [
      mark('w1', 'bar', 10, 1, 8, 1),
      mark('w2', 'bar', 10, 9, 8, 1),
      mark('w3', 'bar', 6, 5, 1, 9),
      mark('w4', 'bar', 14, 5, 1, 9),
    ];
    expect(
      findRoute({ tables: [t], landmarks: [mark('in', 'entrance', 0, 5, 2, 0.5), ...walls] }, 'goal'),
    ).toBeNull();
  });

  it('handles a big hall quickly', () => {
    const tables: HallTable[] = [];
    for (let r = 0; r < 12; r++)
      for (let c = 0; c < 10; c++) tables.push(table(`t${r}-${c}`, r * 10 + c + 1, 4 + c * 4, 4 + r * 4));
    const started = performance.now();
    const route = findRoute({ tables, landmarks: [mark('in', 'entrance', 0, 2, 2, 0.5)] }, 't11-9');
    expect(route).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe('chairEdge', () => {
  it('meets a round table’s chairs toward the walker, and a square one’s side', () => {
    const round = table('r', 1, 0, 0);
    const e = chairEdge(round, { x: -10, y: 0 });
    expect(e.x).toBeCloseTo(-(0.9 + CHAIR_OFFSET + CHAIR_RADIUS), 2);
    expect(e.y).toBeCloseTo(0, 5);
    const square = table('s', 2, 0, 0, { shape: 'rect', w: 2, h: 1 });
    const f = chairEdge(square, { x: 0, y: -5 });
    expect(f.y).toBeCloseTo(-(0.5 + CHAIR_OFFSET + CHAIR_RADIUS), 2);
  });
});

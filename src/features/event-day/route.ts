import { CHAIR_OFFSET, CHAIR_RADIUS, rotate, type Point } from '@/features/seating/geometry';
import type { Landmark, LandmarkKind } from '@/features/seating/model';
import type { HallTable } from './model';

/**
 * The way from the entrance to a guest's table — around the tables (with their chairs), the stage, the
 * bar and the buffet, never through them. Pure, in meters (x right, y down, rotation clockwise — like
 * the seating's geometry). Unit-tested in tests/unit/event-day-route.test.ts.
 *
 * The hall becomes a grid of small cells; a cell is blocked when it falls inside an obstacle grown by a
 * walking clearance. A* finds the shortest walk over free cells (8 directions, never cutting a blocked
 * corner) from the entrance to any cell beside the guest's table; the walk is then straightened (each
 * point joined to the farthest one it can see) and ends at the table's chairs.
 */

/** Room to pass beside a chair (or the stage), meters. */
export const CLEARANCE = 0.3;
/** What people walk across rather than around: the doors themselves and the dance floor. */
const WALKABLE: readonly LandmarkKind[] = ['entrance', 'exit', 'dance'];
/** The grid's cell (meters): finer in a small hall, coarser in a big one. */
const MIN_STEP = 0.15;
const MAX_STEP = 0.8;
const MAX_CELLS_PER_SIDE = 320;

export interface Route {
  /** from the entrance to the table's chairs, straightened */
  points: Point[];
  /** walking distance, meters */
  length: number;
  /** the entrance it starts from */
  entranceId: string;
}

type Obstacle =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; hw: number; hh: number; rotation: number };

/** How far a table's chairs reach from its edge. */
const CHAIRS = CHAIR_OFFSET + CHAIR_RADIUS;

function tableObstacle(t: HallTable, grow: number): Obstacle {
  if (t.shape === 'round') return { kind: 'circle', x: t.x, y: t.y, r: t.w / 2 + CHAIRS + grow };
  return {
    kind: 'rect',
    x: t.x,
    y: t.y,
    hw: t.w / 2 + CHAIRS + grow,
    hh: t.h / 2 + CHAIRS + grow,
    rotation: t.rotation,
  };
}

function landmarkObstacle(m: Landmark, grow: number): Obstacle {
  return { kind: 'rect', x: m.x, y: m.y, hw: m.w / 2 + grow, hh: m.h / 2 + grow, rotation: m.rotation };
}

function inside(p: Point, o: Obstacle): boolean {
  if (o.kind === 'circle') return Math.hypot(p.x - o.x, p.y - o.y) < o.r;
  const q = rotate({ x: p.x - o.x, y: p.y - o.y }, -o.rotation);
  return Math.abs(q.x) < o.hw && Math.abs(q.y) < o.hh;
}

/** How far an obstacle reaches from its center at most (a lower bound for A*'s estimate). */
const reach = (o: Obstacle) => (o.kind === 'circle' ? o.r : Math.hypot(o.hw, o.hh));

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Where the table's chairs are met walking from `from` toward its center. */
export function chairEdge(t: HallTable, from: Point): Point {
  const c = { x: t.x, y: t.y };
  const d = { x: from.x - c.x, y: from.y - c.y };
  const len = Math.hypot(d.x, d.y) || 1;
  if (t.shape === 'round') {
    const r = t.w / 2 + CHAIRS;
    return { x: round2(c.x + (d.x / len) * r), y: round2(c.y + (d.y / len) * r) };
  }
  const q = rotate(d, -t.rotation);
  const hw = t.w / 2 + CHAIRS;
  const hh = t.h / 2 + CHAIRS;
  const s = Math.min(q.x ? hw / Math.abs(q.x) : Infinity, q.y ? hh / Math.abs(q.y) : Infinity);
  const edge = rotate(
    { x: q.x * (Number.isFinite(s) ? s : 0), y: q.y * (Number.isFinite(s) ? s : 0) },
    t.rotation,
  );
  return { x: round2(c.x + edge.x), y: round2(c.y + edge.y) };
}

export function pathLength(points: readonly Point[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++)
    n += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return n;
}

/** A small binary heap of cell indexes by priority (A*'s open set). */
class Heap {
  private items: number[] = [];
  private prio: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, p: number) {
    const a = this.items;
    const q = this.prio;
    a.push(item);
    q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (q[parent]! <= q[i]!) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      [q[parent], q[i]] = [q[i]!, q[parent]!];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items;
    const q = this.prio;
    const top = a[0]!;
    const lastItem = a.pop()!;
    const lastPrio = q.pop()!;
    if (a.length) {
      a[0] = lastItem;
      q[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && q[l]! < q[m]!) m = l;
        if (r < a.length && q[r]! < q[m]!) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        [q[m], q[i]] = [q[i]!, q[m]!];
        i = m;
      }
    }
    return top;
  }
}

/**
 * The walk from the entrance nearest to the table (landmarks of kind 'entrance') to the table's chairs,
 * or null: no entrance drawn, no such table, or no way through.
 */
export function findRoute(
  hall: { tables: readonly HallTable[]; landmarks: readonly Landmark[] },
  tableId: string,
): Route | null {
  const target = hall.tables.find((t) => t.id === tableId);
  const entrances = hall.landmarks.filter((m) => m.kind === 'entrance');
  if (!target || !entrances.length) return null;
  const entrance = entrances.reduce((best, m) =>
    Math.hypot(m.x - target.x, m.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? m : best,
  );
  const start: Point = { x: entrance.x, y: entrance.y };

  const obstacles: Obstacle[] = [
    ...hall.tables.map((t) => tableObstacle(t, CLEARANCE)),
    ...hall.landmarks.filter((m) => !WALKABLE.includes(m.kind)).map((m) => landmarkObstacle(m, CLEARANCE)),
  ];

  // the grid: everything, with room around it
  let x0 = start.x;
  let y0 = start.y;
  let x1 = start.x;
  let y1 = start.y;
  for (const o of obstacles) {
    const r = reach(o);
    x0 = Math.min(x0, o.x - r);
    y0 = Math.min(y0, o.y - r);
    x1 = Math.max(x1, o.x + r);
    y1 = Math.max(y1, o.y + r);
  }
  const margin = 2;
  x0 -= margin;
  y0 -= margin;
  x1 += margin;
  y1 += margin;
  const side = Math.max(x1 - x0, y1 - y0);
  const step = Math.min(MAX_STEP, Math.max(MIN_STEP, side / 220, side / MAX_CELLS_PER_SIDE));
  const cols = Math.ceil((x1 - x0) / step) + 1;
  const rows = Math.ceil((y1 - y0) / step) + 1;
  const at = (i: number, j: number): Point => ({ x: x0 + i * step, y: y0 + j * step });

  const blocked = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const p = at(i, j);
      for (const o of obstacles)
        if (inside(p, o)) {
          blocked[j * cols + i] = 1;
          break;
        }
    }

  // beside the table: free cells within a cell or two of its grown shape
  const near = tableObstacle(target, CLEARANCE + step * 1.6);
  const isGoal = (k: number) => !blocked[k] && inside(at(k % cols, Math.floor(k / cols)), near);

  // the entrance's cell (or the free one nearest to it)
  const cellOf = (p: Point) => ({
    i: Math.min(cols - 1, Math.max(0, Math.round((p.x - x0) / step))),
    j: Math.min(rows - 1, Math.max(0, Math.round((p.y - y0) / step))),
  });
  const s0 = cellOf(start);
  let startCell = -1;
  for (let ring = 0; ring < Math.max(cols, rows) && startCell < 0; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let dj = -ring; dj <= ring; dj++)
      for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const i = s0.i + di;
        const j = s0.j + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows || blocked[j * cols + i]) continue;
        const d = Math.hypot(di, dj);
        if (d < bestD) {
          bestD = d;
          best = j * cols + i;
        }
      }
    startCell = best;
  }
  if (startCell < 0) return null;

  // A*
  const targetReach = reach(tableObstacle(target, CLEARANCE + step * 1.6));
  const h = (k: number) => {
    const p = at(k % cols, Math.floor(k / cols));
    return Math.max(0, Math.hypot(p.x - target.x, p.y - target.y) - targetReach) / step;
  };
  const g = new Float64Array(cols * rows).fill(Infinity);
  const from = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const open = new Heap();
  g[startCell] = 0;
  open.push(startCell, h(startCell));
  let goal = -1;
  const DIRS: readonly [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  while (open.size) {
    const k = open.pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (isGoal(k)) {
      goal = k;
      break;
    }
    const i = k % cols;
    const j = Math.floor(k / cols);
    for (const [di, dj, cost] of DIRS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const nk = nj * cols + ni;
      if (blocked[nk] || closed[nk]) continue;
      // never squeeze diagonally between two blocked cells (a chair's corner)
      if (di && dj && (blocked[j * cols + ni] || blocked[nj * cols + i])) continue;
      const ng = g[k]! + cost;
      if (ng < g[nk]!) {
        g[nk] = ng;
        from[nk] = k;
        open.push(nk, ng + h(nk));
      }
    }
  }
  if (goal < 0) return null;

  const cells: number[] = [];
  for (let k = goal; k >= 0; k = from[k]!) cells.push(k);
  cells.reverse();

  // straighten: from each point, the farthest one in plain sight
  const free = (p: Point) => {
    const { i, j } = cellOf(p);
    return !blocked[j * cols + i];
  };
  const sees = (a: Point, b: Point) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (step / 3));
    for (let s = 1; s < n; s++) {
      const t = s / n;
      if (!free({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  };
  const pts = cells.map((k) => at(k % cols, Math.floor(k / cols)));
  const straight: Point[] = [pts[0]!];
  let anchor = 0;
  while (anchor < pts.length - 1) {
    let next = anchor + 1;
    for (let k = pts.length - 1; k > anchor + 1; k--)
      if (sees(pts[anchor]!, pts[k]!)) {
        next = k;
        break;
      }
    straight.push(pts[next]!);
    anchor = next;
  }

  const points = [start, ...straight, chairEdge(target, straight[straight.length - 1]!)]
    .map((p) => ({ x: round2(p.x), y: round2(p.y) }))
    // no two points on the same spot
    .filter((p, i, list) => i === 0 || Math.hypot(p.x - list[i - 1]!.x, p.y - list[i - 1]!.y) > 0.01);
  return { points, length: Math.round(pathLength(points) * 10) / 10, entranceId: entrance.id };
}

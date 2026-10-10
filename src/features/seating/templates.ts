import { DEFAULT_CAPACITY, bounds, defaultTableSize, type Rect } from './geometry';
import {
  LIMITS,
  newId,
  type Landmark,
  type LandmarkKind,
  type Plan,
  type SeatingTable,
  type TableShape,
} from './model';
import { nextTableNumber } from './plan';

/**
 * Ready-made halls, for a host who has no picture of their venue (or not yet): a 30×20 m room — the
 * one the map draws without a plan — with its stage, dance floor, bar and doors in place, and as many
 * tables as the guests need, set in rows around the dance floor with aisles between them. The host
 * dresses it up from there (moves, adds, changes shapes) — or uploads the venue's own plan later.
 * Pure: the screen and the tests share it.
 */

export const HALL_TEMPLATES = ['classic', 'wide', 'garden', 'banquet'] as const;
export type HallTemplate = (typeof HALL_TEMPLATES)[number];

type Spot = Omit<Landmark, 'id' | 'label'>;
interface TemplateSpec {
  landmarks: Spot[];
  /** the tables' shape and seats */
  shape: TableShape;
  capacity: number;
  /** the order tables fill the room: nearest this point first (the dance floor, the stage) */
  focus: { x: number; y: number };
  /** a long table for the couple/family in front of the stage */
  headTable: boolean;
}

const lm = (kind: LandmarkKind, x: number, y: number, w: number, h: number, rotation = 0): Spot => ({
  kind,
  x,
  y,
  w,
  h,
  rotation,
});

const SPECS: Record<HallTemplate, TemplateSpec> = {
  // the classic hall: the stage at the far wall, the dance floor before it, tables on three sides
  classic: {
    landmarks: [
      lm('stage', 15, 1.75, 8, 2.5),
      lm('dance', 15, 6.5, 9, 6),
      lm('bar', 2.75, 1.5, 4.5, 1.5),
      lm('buffet', 27.25, 1.5, 4.5, 1.5),
      lm('entrance', 15, 19.6, 4, 0.8),
      lm('exit', 29.6, 13, 0.8, 2.5),
    ],
    shape: 'round',
    capacity: 10,
    focus: { x: 15, y: 6.5 },
    headTable: false,
  },
  // a wide hall: a long stage and a wide dance floor across the room, tables in rows behind it
  wide: {
    landmarks: [
      lm('stage', 15, 1.5, 12, 2),
      lm('dance', 15, 5.5, 14, 4.5),
      lm('bar', 2.5, 18.75, 4, 1.5),
      lm('entrance', 15, 19.6, 4, 0.8),
      lm('exit', 0.4, 10, 0.8, 2.5),
    ],
    shape: 'round',
    capacity: 10,
    focus: { x: 15, y: 5.5 },
    headTable: false,
  },
  // a garden: the dance floor in the middle, tables all around it, the bar and buffet at the edges
  garden: {
    landmarks: [
      lm('stage', 15, 1.5, 7, 2),
      lm('dance', 15, 10, 8, 7),
      lm('bar', 0.75 + 1.25, 10, 2.5, 5),
      lm('buffet', 28, 10, 2.5, 5),
      lm('entrance', 15, 19.6, 4, 0.8),
    ],
    shape: 'round',
    capacity: 10,
    focus: { x: 15, y: 10 },
    headTable: false,
  },
  // banquet: long knights tables in rows and a head table before the stage
  banquet: {
    landmarks: [
      lm('stage', 15, 1.5, 8, 2),
      lm('dance', 15, 17, 10, 4),
      lm('bar', 2.75, 1.5, 4.5, 1.5),
      lm('entrance', 29.6, 17, 0.8, 3),
    ],
    shape: 'knights',
    capacity: 20,
    focus: { x: 15, y: 4 },
    headTable: true,
  },
};

/** The room every template fits (the map's room without a plan). */
const ROOM = { w: LIMITS.roomW, h: LIMITS.roomH };
/** Room around each table for chairs and an aisle, meters. */
const AISLE = 1.4;
/** Kept clear around the stage, the dance floor and the doors, meters. */
const CLEAR = 0.8;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by });

/** How many tables `guests` people need at this template's tables (at least 1, at most what fits). */
export function tablesFor(template: HallTemplate, guests: number): number {
  const { capacity } = SPECS[template];
  return Math.max(1, Math.ceil(Math.max(0, guests) / capacity));
}

/**
 * A template's landmarks and tables for this many guests: the tables on a grid of free spots (none on
 * the stage, the dance floor or a door, all inside the room), the nearest to its focus first. Fewer
 * tables than asked when the room is full — the host adds more where they like.
 */
export function templateItems(
  template: HallTemplate,
  guests: number,
): {
  landmarks: Spot[];
  tables: {
    shape: TableShape;
    capacity: number;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
  }[];
} {
  const spec = SPECS[template];
  const want = tablesFor(template, guests);
  const size = defaultTableSize(spec.shape, spec.capacity);
  const blocked = spec.landmarks.map((m) => grow(bounds(m), CLEAR));
  const tables: {
    shape: TableShape;
    capacity: number;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
  }[] = [];

  if (spec.headTable) {
    // the head table: a long table across the room, just before the stage
    const stage = spec.landmarks.find((m) => m.kind === 'stage')!;
    const head = defaultTableSize('knights', 12);
    const y = stage.y + stage.h / 2 + CLEAR + head.h / 2 + 0.6;
    tables.push({ shape: 'knights', capacity: 12, x: stage.x, y, w: head.w, h: head.h, rotation: 0 });
    blocked.push(
      grow(bounds({ x: stage.x, y, w: head.w, h: head.h, rotation: 0, shape: 'knights' }), AISLE / 2),
    );
  }

  // every free spot on a grid as wide as a table with its chairs, and an aisle between them
  const footprint = bounds({ x: 0, y: 0, w: size.w, h: size.h, rotation: 0, shape: spec.shape });
  const stepX = footprint.w + AISLE;
  const stepY = footprint.h + AISLE;
  const spots: { x: number; y: number }[] = [];
  for (let y = 0.5 + footprint.h / 2; y + footprint.h / 2 <= ROOM.h - 0.5; y += stepY)
    for (let x = 0.5 + footprint.w / 2; x + footprint.w / 2 <= ROOM.w - 0.5; x += stepX) {
      const box = bounds({ x, y, w: size.w, h: size.h, rotation: 0, shape: spec.shape });
      if (blocked.some((b) => overlaps(box, b))) continue;
      spots.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
  spots.sort(
    (a, b) =>
      Math.hypot(a.x - spec.focus.x, a.y - spec.focus.y) - Math.hypot(b.x - spec.focus.x, b.y - spec.focus.y),
  );
  for (const p of spots.slice(0, Math.max(0, want - tables.length)))
    tables.push({
      shape: spec.shape,
      capacity: spec.capacity,
      x: p.x,
      y: p.y,
      w: size.w,
      h: size.h,
      rotation: 0,
    });
  return { landmarks: spec.landmarks, tables };
}

/**
 * The template applied to the plan: its landmarks (instead of any there were) and its tables, numbered
 * after the ones already there — the people already seated stay where they are. One step to undo.
 */
export function applyTemplate(plan: Plan, template: HallTemplate, guests: number): Plan {
  const items = templateItems(template, guests);
  let next: Plan = {
    ...plan,
    layout: {
      ...plan.layout,
      landmarks: items.landmarks.map((m) => ({ ...m, id: newId(), label: null })),
    },
  };
  for (const t of items.tables) {
    const table: SeatingTable = {
      id: newId(),
      number: nextTableNumber(next),
      label: null,
      shape: t.shape,
      capacity: t.capacity,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      rotation: t.rotation,
      zones: [],
      locked: false,
    };
    next = { ...next, tables: [...next.tables, table] };
  }
  return next;
}

/** A template's default seats per table (for its card: "16 round tables of 10"). */
export const templateTable = (template: HallTemplate) => ({
  shape: SPECS[template].shape,
  capacity: SPECS[template].capacity || DEFAULT_CAPACITY[SPECS[template].shape],
});

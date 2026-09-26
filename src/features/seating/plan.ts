import {
  bounds,
  clampCoord,
  contentBounds,
  DEFAULT_CAPACITY,
  defaultTableSize,
  freeSpot,
  normalizeRotation,
  type Point,
} from './geometry';
import {
  DEFAULT_UNIT,
  LIMITS,
  newId,
  type Assignment,
  type Landmark,
  type LandmarkKind,
  type Plan,
  type SeatingRule,
  type SeatingTable,
  type TableShape,
  type UnitInfo,
  type UnitSettings,
} from './model';

/**
 * The seating plan's operations — pure functions from a plan to the next one (the editor keeps each
 * as an undo step). Unit-tested in tests/unit/seating-plan.test.ts.
 */

export type UnitsById = ReadonlyMap<string, UnitInfo>;
export const unitsById = (units: readonly UnitInfo[]): UnitsById => new Map(units.map((u) => [u.id, u]));

/** Seats a unit takes at a table: the people coming (a declined unit takes none). */
export const seatsOf = (u: UnitInfo | undefined) => (u && u.status !== 'declined' ? u.seats : 0);

/** How many seats are taken at each table. */
export function occupancy(plan: Pick<Plan, 'assignments'>, units: UnitsById): Map<string, number> {
  const taken = new Map<string, number>();
  for (const [unitId, a] of Object.entries(plan.assignments))
    taken.set(a.tableId, (taken.get(a.tableId) ?? 0) + seatsOf(units.get(unitId)));
  return taken;
}

/** The units at a table, in the order they were seated. */
export function unitsAt(plan: Pick<Plan, 'assignments'>, tableId: string): string[] {
  return Object.entries(plan.assignments)
    .filter(([, a]) => a.tableId === tableId)
    .map(([id]) => id);
}

export type SeatCheck =
  | { ok: true }
  | { ok: false; reason: 'full'; table: SeatingTable; free: number; needed: number }
  | { ok: false; reason: 'declined' | 'unknown' };

/**
 * Can this unit sit at this table? The whole unit or nothing: a family is never split, and a table
 * never gets more people than seats. (A locked table only stops the automatic seating — the host may
 * still seat people there by hand.)
 */
export function canSeat(plan: Plan, units: UnitsById, unitId: string, tableId: string): SeatCheck {
  const unit = units.get(unitId);
  const table = plan.tables.find((t) => t.id === tableId);
  if (!unit || !table) return { ok: false, reason: 'unknown' };
  if (unit.status === 'declined') return { ok: false, reason: 'declined' };
  if (plan.assignments[unitId]?.tableId === tableId) return { ok: true };
  const taken = occupancy(plan, units).get(tableId) ?? 0;
  const free = table.capacity - taken;
  if (unit.seats > free)
    return { ok: false, reason: 'full', table, free: Math.max(0, free), needed: unit.seats };
  return { ok: true };
}

/** Seats a unit at a table (moving it if it sat elsewhere) — or says why not (the plan unchanged). */
export function assign(
  plan: Plan,
  units: UnitsById,
  unitId: string,
  tableId: string,
  source: Assignment['source'] = 'host',
): { plan: Plan; check: SeatCheck } {
  const check = canSeat(plan, units, unitId, tableId);
  if (!check.ok) return { plan, check };
  if (plan.assignments[unitId]?.tableId === tableId) return { plan, check };
  return { plan: { ...plan, assignments: { ...plan.assignments, [unitId]: { tableId, source } } }, check };
}

export function unassign(plan: Plan, unitIds: readonly string[]): Plan {
  if (!unitIds.some((id) => plan.assignments[id])) return plan;
  const assignments = { ...plan.assignments };
  for (const id of unitIds) delete assignments[id];
  return { ...plan, assignments };
}

/** The next free table number (the lowest one not in use). */
export function nextTableNumber(plan: Pick<Plan, 'tables'>): number {
  const used = new Set(plan.tables.map((t) => t.number));
  for (let n = 1; n <= LIMITS.number; n++) if (!used.has(n)) return n;
  return LIMITS.number;
}

/** A new table of this shape near `at` (or the middle of what is in view), in a free spot. */
export function addTable(
  plan: Plan,
  shape: TableShape,
  at: Point | null,
  capacity = DEFAULT_CAPACITY[shape],
): { plan: Plan; id: string } {
  const size = defaultTableSize(shape, capacity);
  const box = contentBounds(plan);
  const near = at ?? { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const taken = [...plan.tables.map((t) => bounds(t)), ...plan.layout.landmarks.map((m) => bounds(m))];
  const spot = freeSpot(near, size, taken, plan.layout.gridM);
  const table: SeatingTable = {
    id: newId(),
    number: nextTableNumber(plan),
    label: null,
    shape,
    capacity,
    x: clampCoord(spot.x),
    y: clampCoord(spot.y),
    w: size.w,
    h: size.h,
    rotation: 0,
    zones: [],
    locked: false,
  };
  return { plan: { ...plan, tables: [...plan.tables, table] }, id: table.id };
}

export type TablePatch = Partial<Omit<SeatingTable, 'id'>>;

export type TableUpdate =
  | { ok: true; plan: Plan }
  | { ok: false; reason: 'number_taken'; number: number }
  | { ok: false; reason: 'below_seated'; seated: number };

/**
 * Changes a table. A new shape or capacity resizes it to fit its seats (unless a size is given); the
 * capacity can't go below the people already seated there, and a number can't be another table's.
 */
export function updateTable(plan: Plan, units: UnitsById, id: string, patch: TablePatch): TableUpdate {
  const table = plan.tables.find((t) => t.id === id);
  if (!table) return { ok: true, plan };
  if (patch.number !== undefined && plan.tables.some((t) => t.id !== id && t.number === patch.number))
    return { ok: false, reason: 'number_taken', number: patch.number };
  if (patch.capacity !== undefined) {
    const seated = occupancy(plan, units).get(id) ?? 0;
    if (patch.capacity < seated && patch.capacity < table.capacity)
      return { ok: false, reason: 'below_seated', seated };
  }
  const next: SeatingTable = { ...table, ...patch };
  if ((patch.shape !== undefined || patch.capacity !== undefined) && patch.w === undefined) {
    const size = defaultTableSize(next.shape, next.capacity);
    next.w = size.w;
    next.h = size.h;
  }
  next.x = clampCoord(next.x);
  next.y = clampCoord(next.y);
  next.rotation = normalizeRotation(next.rotation);
  next.label = next.label?.trim() ? next.label.trim().slice(0, LIMITS.label) : null;
  return { ok: true, plan: { ...plan, tables: plan.tables.map((t) => (t.id === id ? next : t)) } };
}

/** Moves tables (and landmarks) by their ids to new centers. */
export function moveItems(plan: Plan, moves: ReadonlyMap<string, Point>): Plan {
  if (!moves.size) return plan;
  const at = <T extends { id: string; x: number; y: number }>(item: T): T => {
    const p = moves.get(item.id);
    return p ? { ...item, x: clampCoord(p.x), y: clampCoord(p.y) } : item;
  };
  return {
    ...plan,
    tables: plan.tables.map((t) => (moves.has(t.id) ? at(t) : t)),
    layout: { ...plan.layout, landmarks: plan.layout.landmarks.map((m) => (moves.has(m.id) ? at(m) : m)) },
  };
}

/** Removes tables and landmarks; whoever sat at a removed table goes back to the list. */
export function removeItems(plan: Plan, ids: ReadonlySet<string>): Plan {
  if (!ids.size) return plan;
  const assignments = Object.fromEntries(
    Object.entries(plan.assignments).filter(([, a]) => !ids.has(a.tableId)),
  );
  return {
    ...plan,
    tables: plan.tables.filter((t) => !ids.has(t.id)),
    assignments,
    layout: { ...plan.layout, landmarks: plan.layout.landmarks.filter((m) => !ids.has(m.id)) },
  };
}

/** A copy of a table next to it (the next number, nobody seated). */
export function duplicateTable(plan: Plan, id: string): { plan: Plan; id: string } | null {
  const t = plan.tables.find((x) => x.id === id);
  if (!t || plan.tables.length >= LIMITS.tables) return null;
  const taken = [...plan.tables.map((x) => bounds(x)), ...plan.layout.landmarks.map((m) => bounds(m))];
  const spot = freeSpot({ x: t.x + t.w + 1, y: t.y }, t, taken, plan.layout.gridM);
  const copy: SeatingTable = {
    ...t,
    id: newId(),
    number: nextTableNumber(plan),
    x: spot.x,
    y: spot.y,
    locked: false,
  };
  return { plan: { ...plan, tables: [...plan.tables, copy] }, id: copy.id };
}

export const LANDMARK_SIZE: Record<LandmarkKind, { w: number; h: number }> = {
  stage: { w: 6, h: 3 },
  dance: { w: 6, h: 6 },
  bar: { w: 4, h: 1.2 },
  buffet: { w: 5, h: 1.2 },
  entrance: { w: 2.4, h: 0.6 },
  exit: { w: 1.6, h: 0.5 },
};

export function addLandmark(plan: Plan, kind: LandmarkKind, at: Point | null): { plan: Plan; id: string } {
  const size = LANDMARK_SIZE[kind];
  const box = contentBounds(plan);
  const near = at ?? { x: box.x + box.w / 2, y: box.y + box.h / 4 };
  const taken = [...plan.tables.map((t) => bounds(t)), ...plan.layout.landmarks.map((m) => bounds(m))];
  const spot = freeSpot(near, size, taken, plan.layout.gridM);
  const landmark: Landmark = {
    id: newId(),
    kind,
    x: spot.x,
    y: spot.y,
    w: size.w,
    h: size.h,
    rotation: 0,
    label: null,
  };
  return {
    plan: { ...plan, layout: { ...plan.layout, landmarks: [...plan.layout.landmarks, landmark] } },
    id: landmark.id,
  };
}

export function updateLandmark(plan: Plan, id: string, patch: Partial<Omit<Landmark, 'id'>>): Plan {
  return {
    ...plan,
    layout: {
      ...plan.layout,
      landmarks: plan.layout.landmarks.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              x: clampCoord(patch.x ?? m.x),
              y: clampCoord(patch.y ?? m.y),
              rotation: normalizeRotation(patch.rotation ?? m.rotation),
            }
          : m,
      ),
    },
  };
}

/** The host's settings for a unit (an entry is kept even at the defaults, so a reset is saved too). */
export function setUnitSettings(plan: Plan, unitId: string, patch: Partial<UnitSettings>): Plan {
  const current = plan.units[unitId] ?? DEFAULT_UNIT;
  return {
    ...plan,
    units: { ...plan.units, [unitId]: { ...current, ...patch, prefs: { ...current.prefs, ...patch.prefs } } },
  };
}

/** Adds a rule between two units (replacing any rule the two already have). */
export function addRule(plan: Plan, rule: Omit<SeatingRule, 'id'>): Plan {
  if (rule.a === rule.b) return plan;
  const others = plan.rules.filter((r) => !samePair(r, rule));
  return { ...plan, rules: [...others, { ...rule, id: newId() }] };
}

export const samePair = (x: { a: string; b: string }, y: { a: string; b: string }) =>
  (x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a);

export function removeRule(plan: Plan, id: string): Plan {
  return { ...plan, rules: plan.rules.filter((r) => r.id !== id) };
}

// ─── where things stand ──────────────────────────────────────────────────────────────────────────

export interface SeatingStats {
  /** people who said they're coming, and how many of them have a seat */
  confirmed: number;
  seatedConfirmed: number;
  /** everyone seated (guests who haven't replied included) */
  seated: number;
  seats: number;
  /** units coming without a table */
  unseatedUnits: number;
  /** tables with more people than seats (replies grew after they were seated) */
  over: SeatingTable[];
  /** units seated though they said they aren't coming */
  declinedSeated: string[];
}

export function seatingStats(plan: Plan, units: readonly UnitInfo[]): SeatingStats {
  const byId = unitsById(units);
  const taken = occupancy(plan, byId);
  let confirmed = 0;
  let seatedConfirmed = 0;
  let seated = 0;
  let unseatedUnits = 0;
  const declinedSeated: string[] = [];
  for (const u of units) {
    const at = plan.assignments[u.id];
    if (u.status === 'confirmed') {
      confirmed += u.seats;
      if (at) seatedConfirmed += u.seats;
      else if (u.seats > 0) unseatedUnits++;
    }
    if (at) {
      seated += seatsOf(u);
      if (u.status === 'declined') declinedSeated.push(u.id);
    }
  }
  return {
    confirmed,
    seatedConfirmed,
    seated,
    seats: plan.tables.reduce((n, t) => n + t.capacity, 0),
    unseatedUnits,
    over: plan.tables.filter((t) => (taken.get(t.id) ?? 0) > t.capacity),
    declinedSeated,
  };
}

/** Seats held by units that are gone from the list (removed guests' units no longer exist). */
export function dropStale(plan: Plan, units: UnitsById): Plan {
  const stale = Object.keys(plan.assignments).filter((id) => !units.has(id));
  const rules = plan.rules.filter((r) => units.has(r.a) && units.has(r.b));
  if (!stale.length && rules.length === plan.rules.length) return plan;
  return { ...unassign(plan, stale), rules };
}

// ─── two windows at once: a three-way merge ──────────────────────────────────────────────────────

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Keyed records: what this window changed since `base` wins; everything else comes from `server`. */
function mergeRecords<T>(
  base: Record<string, T>,
  local: Record<string, T>,
  server: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(server)])) {
    const changed = !same(base[key], local[key]);
    const v = changed ? local[key] : server[key];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

const byId = <T extends { id: string }>(list: readonly T[]) => Object.fromEntries(list.map((x) => [x.id, x]));

/**
 * Another window (or the other host) saved while this one had unsaved changes: this window's changes
 * since the version it loaded (`base`) are applied on top of what is stored now (`server`) — per table,
 * per landmark, per seat, per rule, per unit and per layout setting; where both changed the same thing,
 * this window's change wins. Table numbers that collide after the merge are renumbered (this window's
 * new table gets the next free number).
 */
export function mergePlans(base: Plan, local: Plan, server: Plan): Plan {
  const tables = Object.values(mergeRecords(byId(base.tables), byId(local.tables), byId(server.tables)));
  // the stored order first, then this window's new tables
  const order = new Map<string, number>();
  for (const t of [...server.tables, ...local.tables]) if (!order.has(t.id)) order.set(t.id, order.size);
  tables.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const numbers = new Set<number>();
  const serverIds = new Set(server.tables.map((t) => t.id));
  // the stored tables keep their numbers; a clash moves this window's table
  const ordered = [
    ...tables.filter((t) => serverIds.has(t.id)),
    ...tables.filter((t) => !serverIds.has(t.id)),
  ];
  const renumbered = new Map<string, number>();
  for (const t of ordered) {
    let n = t.number;
    while (numbers.has(n) && n < LIMITS.number) n++;
    numbers.add(n);
    if (n !== t.number) renumbered.set(t.id, n);
  }
  const mergedTables = tables.map((t) =>
    renumbered.has(t.id) ? { ...t, number: renumbered.get(t.id)! } : t,
  );

  const layoutFields = <K extends keyof Plan['layout']>(k: K) =>
    same(base.layout[k], local.layout[k]) ? server.layout[k] : local.layout[k];
  const landmarks = Object.values(
    mergeRecords(byId(base.layout.landmarks), byId(local.layout.landmarks), byId(server.layout.landmarks)),
  );
  const tableIds = new Set(mergedTables.map((t) => t.id));
  const assignments = Object.fromEntries(
    Object.entries(mergeRecords(base.assignments, local.assignments, server.assignments)).filter(([, a]) =>
      tableIds.has(a.tableId),
    ),
  );
  return {
    layout: {
      background: layoutFields('background'),
      metersPerPixel: layoutFields('metersPerPixel'),
      source: layoutFields('source'),
      gridM: layoutFields('gridM'),
      settings: layoutFields('settings'),
      landmarks,
    },
    tables: mergedTables,
    assignments,
    rules: Object.values(mergeRecords(byId(base.rules), byId(local.rules), byId(server.rules))),
    units: mergeRecords(base.units, local.units, server.units),
  };
}

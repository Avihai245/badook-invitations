import { z } from 'zod';

/**
 * Seating (Phase 3) — the shapes shared by the database functions (supabase/migrations/*_seating.sql),
 * the server routes, the editor and the solver. Isomorphic, no dependencies beyond zod.
 *
 * Coordinates are meters on the floor plan: x to the right and y down from the plan's top-left corner.
 * A table keeps its real size whatever the plan image's resolution; calibrating the plan only changes
 * how many meters one of its pixels is (`metersPerPixel`).
 */

export const TABLE_SHAPES = ['round', 'rect', 'knights'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

/** What a host marks about a table: near the stage / dance floor / an exit, reachable in a wheelchair. */
export const ZONES = ['stage', 'dance', 'exit', 'accessible'] as const;
export type Zone = (typeof ZONES)[number];

/** The places a unit may want to sit near (or far from). */
export const PREF_ZONES = ['stage', 'dance', 'exit'] as const;
export type PrefZone = (typeof PREF_ZONES)[number];
/** -1 far from it, 0 either way, 1 near it. */
export type Pref = -1 | 0 | 1;
export type Prefs = Record<PrefZone, Pref>;
export const NO_PREFS: Prefs = { stage: 0, dance: 0, exit: 0 };

/** What is drawn on the plan besides tables (orientation, and "near the stage" for the solver). */
export const LANDMARK_KINDS = ['stage', 'dance', 'bar', 'buffet', 'entrance', 'exit'] as const;
export type LandmarkKind = (typeof LANDMARK_KINDS)[number];

export const PLAN_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const CATEGORY_MODES = ['group', 'mix', 'ignore'] as const;
/** group: each table mostly one category; mix: categories spread across tables; ignore. */
export type CategoryMode = (typeof CATEGORY_MODES)[number];

export type UnitStatus = 'confirmed' | 'pending' | 'declined';

export const LIMITS = {
  tables: 300,
  landmarks: 60,
  constraints: 2000,
  units: 6000,
  capacity: 40,
  number: 999,
  label: 40,
  category: 60,
  /** the size of the room when there is no plan (meters) */
  roomW: 30,
  roomH: 20,
  /** a plan's assumed width while it isn't calibrated (a typical hall), meters */
  assumedPlanWidth: 30,
  /** coordinates stay within this box (meters) */
  minCoord: -1000,
  maxCoord: 6000,
  /** a table's side or diameter (meters) */
  maxTableSide: 50,
  /** an uploaded plan (the bucket's limit) */
  planBytes: 15 * 1024 * 1024,
} as const;

export interface SeatingTable {
  id: string;
  number: number;
  label: string | null;
  shape: TableShape;
  capacity: number;
  /** center, meters */
  x: number;
  y: number;
  /** width and depth (a round table's diameter is w = h), meters */
  w: number;
  h: number;
  /** degrees clockwise, 0–359 */
  rotation: number;
  zones: Zone[];
  locked: boolean;
}

export interface Landmark {
  id: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label: string | null;
}

export interface PlanBackground {
  /** in the venue-plans bucket */
  path: string;
  type: PlanType;
  /** pixels (null: a venue's PDF not rendered yet) */
  width: number | null;
  height: number | null;
}

export interface SeatingSettings {
  categories: CategoryMode;
  /** a used table should be at least this full (0–1) */
  minFill: number;
  /** the automatic seating also seats guests who haven't replied (by the list's party size) */
  includePending: boolean;
}
export const DEFAULT_SETTINGS: SeatingSettings = { categories: 'group', minFill: 0.6, includePending: false };

export interface Layout {
  background: PlanBackground | null;
  /** null: not calibrated */
  metersPerPixel: number | null;
  source: 'upload' | 'partner' | 'none' | null;
  /** the venue's plan the background came from (a PDF's rendering points at the PDF) */
  venuePlan: string | null;
  gridM: number;
  landmarks: Landmark[];
  settings: SeatingSettings;
}

/** The host's settings for a unit (saved with the plan). */
export interface UnitSettings {
  /** overrides the guest list's group; null: the group */
  category: string | null;
  prefs: Prefs;
  accessible: boolean;
}
export const DEFAULT_UNIT: UnitSettings = { category: null, prefs: NO_PREFS, accessible: false };

export interface Assignment {
  tableId: string;
  source: 'host' | 'solver';
}

export interface SeatingRule {
  id: string;
  kind: 'together' | 'apart';
  a: string;
  b: string;
  hard: boolean;
}

/** Everything the host edits (undo / redo, autosave): what seating_save stores. */
export interface Plan {
  layout: Layout;
  tables: SeatingTable[];
  /** unit id → where it sits */
  assignments: Record<string, Assignment>;
  rules: SeatingRule[];
  /** unit id → the host's settings (a unit without an entry has the defaults) */
  units: Record<string, UnitSettings>;
}

/** A unit as the guest list and the replies describe it (read-only in the editor). */
export interface UnitInfo {
  id: string;
  guestId: string | null;
  /** the guest list's name ("משפחת כהן"), or the reply's */
  name: string;
  status: UnitStatus;
  /** the seats it needs: the reply's adults + children, or the list's party size before a reply */
  seats: number;
  adults: number;
  children: number;
  /** the attendees' names from the reply */
  people: string[];
  /** the guest list's group */
  group: string | null;
}

export interface VenueInfo {
  name: string;
  address: string | null;
  widthMeters: number | null;
  plan: PlanBackground | null;
}

export interface SeatingState {
  version: number;
  plan: Plan;
  units: UnitInfo[];
  venue: VenueInfo | null;
}

// ─── validation (the save route; the database re-checks what integrity needs) ─────────────────────

const Num = (min: number, max: number) => z.number().finite().min(min).max(max);
const Id = z.uuid();
const Label = z.string().trim().max(LIMITS.label).nullable();
const Coord = Num(LIMITS.minCoord, LIMITS.maxCoord);
const Side = z.number().finite().gt(0).max(LIMITS.maxTableSide);
const Rotation = z.number().int().min(0).max(359);

export const TableSchema = z.strictObject({
  id: Id,
  number: z.number().int().min(1).max(LIMITS.number),
  label: Label,
  shape: z.enum(TABLE_SHAPES),
  capacity: z.number().int().min(1).max(LIMITS.capacity),
  x: Coord,
  y: Coord,
  w: Side,
  h: Side,
  rotation: Rotation,
  zones: z.array(z.enum(ZONES)).max(ZONES.length),
  locked: z.boolean(),
});

export const LandmarkSchema = z.strictObject({
  id: Id,
  kind: z.enum(LANDMARK_KINDS),
  x: Coord,
  y: Coord,
  w: z.number().finite().gt(0).max(500),
  h: z.number().finite().gt(0).max(500),
  rotation: Rotation,
  label: Label,
});

const PrefSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

export const SettingsSchema = z.strictObject({
  categories: z.enum(CATEGORY_MODES),
  minFill: Num(0, 1),
  includePending: z.boolean(),
});

export const LayoutSchema = z.strictObject({
  background: z
    .strictObject({
      path: z
        .string()
        .max(300)
        // folders and a file name; no "." or ".." parts (no way out of a folder)
        .regex(/^[A-Za-z0-9_-]+(\/(?!\.\.?(\/|$))[A-Za-z0-9_.-]+)+$/),
      type: z.enum(PLAN_TYPES),
      width: z.number().int().min(1).max(30000).nullable(),
      height: z.number().int().min(1).max(30000).nullable(),
    })
    .nullable(),
  metersPerPixel: z.number().finite().gt(0).max(1000).nullable(),
  source: z.enum(['upload', 'partner', 'none']).nullable(),
  venuePlan: z.string().max(300).nullable(),
  gridM: Num(0.1, 5),
  landmarks: z.array(LandmarkSchema).max(LIMITS.landmarks),
  settings: SettingsSchema,
});

export const RuleSchema = z.strictObject({
  id: Id,
  kind: z.enum(['together', 'apart']),
  a: Id,
  b: Id,
  hard: z.boolean(),
});

export const UnitSettingsSchema = z.strictObject({
  category: z.string().trim().max(LIMITS.category).nullable(),
  prefs: z.strictObject({ stage: PrefSchema, dance: PrefSchema, exit: PrefSchema }),
  accessible: z.boolean(),
});

export const PlanSchema = z.strictObject({
  layout: LayoutSchema,
  tables: z.array(TableSchema).max(LIMITS.tables),
  assignments: z.record(Id, z.strictObject({ tableId: Id, source: z.enum(['host', 'solver']) })),
  rules: z.array(RuleSchema).max(LIMITS.constraints),
  units: z.record(Id, UnitSettingsSchema),
});

export const SaveSchema = z.strictObject({ version: z.number().int().min(0), plan: PlanSchema });

/** What seating_save takes: the plan in the database's words. */
export function toDbPlan(plan: Plan) {
  return {
    layout: plan.layout,
    tables: plan.tables,
    assignments: Object.entries(plan.assignments).map(([unitId, a]) => ({
      unitId,
      tableId: a.tableId,
      source: a.source,
    })),
    constraints: plan.rules.map((r) => ({ id: r.id, kind: r.kind, a: r.a, b: r.b, hard: r.hard })),
    units: Object.entries(plan.units).map(([id, u]) => ({
      id,
      category: u.category,
      stage: u.prefs.stage,
      dance: u.prefs.dance,
      exit: u.prefs.exit,
      accessible: u.accessible,
    })),
  };
}

// ─── reading seating_state ───────────────────────────────────────────────────────────────────────

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const pref = (v: unknown): Pref => (num(v) > 0 ? 1 : num(v) < 0 ? -1 : 0);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const isPlanType = (v: unknown): v is PlanType => PLAN_TYPES.includes(v as PlanType);

function readSettings(raw: unknown): SeatingSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    categories: CATEGORY_MODES.includes(s.categories as CategoryMode)
      ? (s.categories as CategoryMode)
      : DEFAULT_SETTINGS.categories,
    minFill: Math.min(1, Math.max(0, num(s.minFill, DEFAULT_SETTINGS.minFill))),
    includePending: s.includePending === true,
  };
}

function readBackground(raw: unknown): PlanBackground | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.path !== 'string' || !isPlanType(b.type)) return null;
  return {
    path: b.path,
    type: b.type,
    width: b.width == null ? null : num(b.width),
    height: b.height == null ? null : num(b.height),
  };
}

type RawState = {
  layout: Record<string, unknown>;
  tables: Record<string, unknown>[];
  units: Record<string, unknown>[];
  assignments: { unitId: string; tableId: string; source: string }[];
  constraints: { id: string; kind: string; a: string; b: string; hard: boolean }[];
  venue: Record<string, unknown> | null;
};

/** seating_state's answer → the editor's state (numbers from numeric columns, defaults filled in). */
export function readState(raw: unknown): SeatingState {
  const r = raw as RawState;
  const l = r.layout ?? {};
  const units: UnitInfo[] = [];
  const settings: Record<string, UnitSettings> = {};
  for (const u of r.units ?? []) {
    const id = String(u.id);
    units.push({
      id,
      guestId: str(u.guestId),
      name: typeof u.name === 'string' ? u.name : '',
      status: u.status === 'confirmed' || u.status === 'declined' ? u.status : 'pending',
      seats: Math.max(0, num(u.seats)),
      adults: num(u.adults),
      children: num(u.children),
      people: Array.isArray(u.people)
        ? u.people.filter((p): p is string => typeof p === 'string' && !!p)
        : [],
      group: str(u.group),
    });
    const p = (u.prefs ?? {}) as Record<string, unknown>;
    const s: UnitSettings = {
      category: str(u.category),
      prefs: { stage: pref(p.stage), dance: pref(p.dance), exit: pref(p.exit) },
      accessible: u.accessible === true,
    };
    // only what differs from the defaults travels back with each save
    if (s.category || s.accessible || s.prefs.stage || s.prefs.dance || s.prefs.exit) settings[id] = s;
  }
  const venue = r.venue
    ? {
        name: typeof r.venue.name === 'string' ? r.venue.name : '',
        address: str(r.venue.address),
        widthMeters: r.venue.widthMeters == null ? null : num(r.venue.widthMeters),
        plan: readBackground(r.venue.plan),
      }
    : null;
  return {
    version: num(l.version),
    units,
    venue,
    plan: {
      layout: {
        background: readBackground(l.background),
        metersPerPixel: l.metersPerPixel == null ? null : num(l.metersPerPixel) || null,
        source: l.source === 'upload' || l.source === 'partner' || l.source === 'none' ? l.source : null,
        venuePlan: typeof l.venuePlan === 'string' ? l.venuePlan : null,
        gridM: num(l.gridM, 0.5) || 0.5,
        landmarks: (Array.isArray(l.landmarks) ? l.landmarks : [])
          .map((m) => LandmarkSchema.safeParse(m))
          .flatMap((m) => (m.success ? [m.data] : [])),
        settings: readSettings(l.settings),
      },
      tables: (r.tables ?? []).map((t) => ({
        id: String(t.id),
        number: num(t.number),
        label: str(t.label),
        shape: TABLE_SHAPES.includes(t.shape as TableShape) ? (t.shape as TableShape) : 'round',
        capacity: num(t.capacity, 10),
        x: num(t.x),
        y: num(t.y),
        w: num(t.w, 1.8),
        h: num(t.h, 1.8),
        rotation: num(t.rotation),
        zones: (Array.isArray(t.zones) ? t.zones : []).filter((z): z is Zone => ZONES.includes(z as Zone)),
        locked: t.locked === true,
      })),
      assignments: Object.fromEntries(
        (r.assignments ?? []).map((a) => [
          a.unitId,
          { tableId: a.tableId, source: a.source === 'solver' ? 'solver' : 'host' } satisfies Assignment,
        ]),
      ),
      rules: (r.constraints ?? []).map((c) => ({
        id: c.id,
        kind: c.kind === 'apart' ? 'apart' : 'together',
        a: c.a,
        b: c.b,
        hard: c.hard !== false,
      })),
      units: settings,
    },
  };
}

/** A unit's settings (the defaults when the host set none). */
export const unitSettings = (plan: Plan, unitId: string): UnitSettings => plan.units[unitId] ?? DEFAULT_UNIT;

/** The category a unit counts in: the host's choice, else the guest list's group. */
export function unitCategory(plan: Plan, unit: UnitInfo): string | null {
  return unitSettings(plan, unit.id).category ?? unit.group ?? null;
}

/** A fresh id (crypto.randomUUID where there is one — older browsers get the same from random bytes). */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

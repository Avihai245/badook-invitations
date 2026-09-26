import type { Landmark, PlanBackground, TableShape } from '@/features/seating/model';

/**
 * The event day (Phase 5A) — the shapes the database functions (supabase/migrations/*_event_day.sql),
 * the server, the guests' guide, the entrance stations and the host's live screen share. Isomorphic.
 */

export type UnitStatus = 'confirmed' | 'pending' | 'declined';

/** A table as the event-day pages draw it: its place and number (never who sits there). */
export interface HallTable {
  id: string;
  number: number;
  /** only the host's pages and the guest's own table have one */
  label?: string | null;
  shape: TableShape;
  capacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

/** The hall: the floor plan (a public image — never a PDF here), its scale, the landmarks. */
export interface Hall {
  background: PlanBackground | null;
  metersPerPixel: number | null;
  landmarks: Landmark[];
  tables: HallTable[];
}

/** One arrival at the entrance. */
export interface Checkin {
  id: string;
  count: number;
  at: string;
  /** the station's name, or 'host' */
  station: string;
}

/** A family (a seating unit) as the entrance and the host's live screen see it. */
export interface Party {
  unitId: string;
  guestId: string | null;
  name: string;
  status: UnitStatus;
  /** the seats it was given (the reply's people, or the list's party size before a reply) */
  seats: number;
  /** the people's names from the reply */
  people: string[];
  /** the last digits of its phone (two "Cohen" families at the door) */
  phoneTail: string | null;
  table: { id: string; number: number; label: string | null } | null;
  arrived: number;
  checkins: Checkin[];
}

/** The hall's numbers: people and families expected, and how many arrived. */
export interface Totals {
  expected: number;
  parties: number;
  arrived: number;
  arrivedParties: number;
}

export interface RecentCheckin extends Checkin {
  unitId: string;
  name: string;
}

export type NoticeStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/** What a family was last told about its table (a message that didn't fail, or the host themselves). */
export interface Told {
  tableId: string | null;
  number: number;
  label: string | null;
  channel: 'whatsapp' | 'manual';
  status: NoticeStatus;
  at: string;
}

/** A change in the seating's audit trail. */
export interface SeatingChange {
  id: string;
  kind: 'move' | 'merge' | 'renumber';
  source: 'live' | 'seating';
  reason: string | null;
  at: string;
  actorId: string | null;
  /** this change undoes that one */
  undoOf: string | null;
  undoneAt: string | null;
  units: {
    id: string;
    name: string;
    seats: number;
    from: { id: string; number: number } | null;
    to: { id: string; number: number } | null;
  }[];
  tables: { id: string; from: number; to: number }[];
}

/** The invitation as the event-day pages know it. */
export interface DayInvitation {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  eventType: string;
  templateId: string;
  hosts: {
    primary: Partial<Record<string, string>>;
    secondary: Partial<Record<string, string>> | null;
    joiner: Partial<Record<string, string>> | null;
  } | null;
  date: string | null;
  startTime: string | null;
  timezone: string | null;
  locales: string[] | null;
  defaultLocale: string | null;
  palette: Record<string, string> | null;
}

/** A family in the "tell guests their table" list. */
export interface NoticeRow {
  unitId: string;
  guestId: string | null;
  name: string;
  seats: number;
  status: UnitStatus;
  phone: string | null;
  /** its personal link's token (the guide's address), when it is on the guest list */
  token: string | null;
  /** can the system's WhatsApp number reach it */
  reach: 'ok' | 'landline' | 'opted_out' | 'none';
  table: { id: string; number: number; label: string | null } | null;
  told: Told | null;
  /** a message is on its way */
  queued: boolean;
}

// ─── reading the database's answers ─────────────────────────────────────────────────────────────

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const SHAPES: readonly TableShape[] = ['round', 'rect', 'knights'];

/** A table from the database (numeric columns may come as strings). */
export function readTable(raw: Record<string, unknown>): HallTable {
  return {
    id: String(raw.id),
    number: num(raw.number),
    ...(raw.label === undefined
      ? {}
      : { label: typeof raw.label === 'string' && raw.label ? raw.label : null }),
    shape: SHAPES.includes(raw.shape as TableShape) ? (raw.shape as TableShape) : 'round',
    capacity: num(raw.capacity, 10),
    x: num(raw.x),
    y: num(raw.y),
    w: num(raw.w, 1.8),
    h: num(raw.h, 1.8),
    rotation: num(raw.rotation),
  };
}

/** The hall's plan and landmarks from the database (a PDF plan isn't drawn). */
export function readHall(layout: Record<string, unknown> | null, tables: unknown): Hall {
  const l = layout ?? {};
  const b = l.background as Record<string, unknown> | null | undefined;
  const background: PlanBackground | null =
    b && typeof b.path === 'string' && typeof b.type === 'string' && b.type !== 'application/pdf'
      ? {
          path: b.path,
          type: b.type as PlanBackground['type'],
          width: b.width == null ? null : num(b.width),
          height: b.height == null ? null : num(b.height),
        }
      : null;
  return {
    background,
    metersPerPixel: l.metersPerPixel == null ? null : num(l.metersPerPixel) || null,
    landmarks: (Array.isArray(l.landmarks) ? l.landmarks : [])
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => ({
        id: String(m.id),
        kind: m.kind as Landmark['kind'],
        x: num(m.x),
        y: num(m.y),
        w: num(m.w, 1),
        h: num(m.h, 1),
        rotation: num(m.rotation),
        label: typeof m.label === 'string' && m.label ? m.label : null,
      })),
    tables: (Array.isArray(tables) ? tables : []).map((t) => readTable(t as Record<string, unknown>)),
  };
}

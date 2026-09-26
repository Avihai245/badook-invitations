import { zonedTimeToUtc } from '@/features/invitations/lib/dates';
import { EVENT_DAY } from './config';
import type { HallTable, Party } from './model';

/**
 * The live hall, pure (the host's screen computes it from the server's state; tests in
 * tests/unit/event-day-live.test.ts): how full each table is, the heatmap's colors, the tables still
 * under half full after the start, the timeline of arrivals and which half-empty tables could merge.
 * The database checks re-seats by the same "live seats" (seating_live_seats in *_event_day.sql).
 */

/** The event's start as an instant (the invitation's date and start time in its zone), or null. */
export function eventStartMs(
  date: string | null,
  startTime: string | null,
  timezone: string | null,
): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !startTime || !/^\d{2}:\d{2}$/.test(startTime))
    return null;
  try {
    return zonedTimeToUtc(date, startTime, timezone || 'Asia/Jerusalem').getTime();
  } catch {
    return null;
  }
}

/** Past the grace time: a family that hasn't arrived counts as not coming (its seats are free). */
export const released = (startMs: number | null, now: number): boolean =>
  startMs !== null && now >= startMs + EVENT_DAY.graceMinutes * 60_000;

/**
 * The seats a family takes, live: the people who came once it arrived (plus the rest of its seats,
 * still held for the others, until released); the seats it was given while it hasn't — none once
 * released.
 */
export function liveSeats(seats: number, arrived: number, isReleased: boolean): number {
  if (arrived > 0) return isReleased ? arrived : Math.max(arrived, seats);
  return isReleased ? 0 : seats;
}

/** Who a table expects: families coming, and those seated before replying (never those who declined). */
const expects = (p: Party) => p.status !== 'declined' && p.seats > 0;

export interface TableFill {
  table: HallTable;
  /** people expected at it (their seats) */
  expected: number;
  /** people who arrived */
  arrived: number;
  /** families at it, and how many of them arrived (at least in part) */
  parties: number;
  arrivedParties: number;
  /** its live seats (liveSeats of each family) */
  load: number;
  /** arrived ÷ expected (0 when nobody is expected) */
  ratio: number;
  /** more people arrived than it has seats */
  over: boolean;
}

export function tableFills(
  tables: readonly HallTable[],
  parties: readonly Party[],
  isReleased: boolean,
): TableFill[] {
  const at = new Map<string, Party[]>();
  for (const p of parties)
    if (p.table) {
      const list = at.get(p.table.id) ?? [];
      list.push(p);
      at.set(p.table.id, list);
    }
  return [...tables]
    .sort((a, b) => a.number - b.number)
    .map((table) => {
      const here = at.get(table.id) ?? [];
      const expected = here.filter(expects).reduce((n, p) => n + p.seats, 0);
      const arrived = here.reduce((n, p) => n + p.arrived, 0);
      return {
        table,
        expected,
        arrived,
        parties: here.filter((p) => expects(p) || p.arrived > 0).length,
        arrivedParties: here.filter((p) => p.arrived > 0).length,
        load: here.reduce((n, p) => n + liveSeats(expects(p) ? p.seats : 0, p.arrived, isReleased), 0),
        ratio: expected > 0 ? arrived / expected : 0,
        over: arrived > table.capacity,
      };
    });
}

/**
 * The heatmap's color for a table: how much of what it expects arrived — a warm sand when nobody yet,
 * deepening greens as it fills, red when more people arrived than it has seats; grey when nobody is
 * expected. (Sequential, one hue: the order reads without a legend; the numbers are on the table too.)
 */
export const HEAT = {
  none: { fill: '#f5f5f4', stroke: '#a8a29e', text: '#57534e' },
  over: { fill: '#fee2e2', stroke: '#b91c1c', text: '#991b1b' },
  steps: [
    { fill: '#fdf6ec', stroke: '#c9a27a', text: '#1c1917' },
    { fill: '#dcfce7', stroke: '#4ade80', text: '#14532d' },
    { fill: '#86efac', stroke: '#22c55e', text: '#14532d' },
    { fill: '#22c55e', stroke: '#15803d', text: '#ffffff' },
    { fill: '#15803d', stroke: '#14532d', text: '#ffffff' },
  ],
} as const;

export function heatOf(fill: Pick<TableFill, 'expected' | 'arrived' | 'ratio' | 'over'>) {
  if (fill.over) return HEAT.over;
  if (fill.expected === 0) return fill.arrived > 0 ? HEAT.steps[4] : HEAT.none;
  if (fill.arrived === 0) return HEAT.steps[0];
  if (fill.ratio < 0.34) return HEAT.steps[1];
  if (fill.ratio < 0.67) return HEAT.steps[2];
  if (fill.ratio < 1) return HEAT.steps[3];
  return HEAT.steps[4];
}

/**
 * Tables still under half full once the grace time has passed: fewer than half the people they expect
 * arrived.
 */
export function halfEmptyAlerts(
  fills: readonly TableFill[],
  startMs: number | null,
  now: number,
): TableFill[] {
  if (!released(startMs, now)) return [];
  return fills.filter((f) => f.expected > 0 && f.arrived * 2 < f.expected);
}

export interface TimelineBar {
  /** the bucket's start, ms */
  at: number;
  people: number;
  parties: number;
}

/** Arrivals per `bucketMinutes`, from the first to the last (empty buckets included). */
export function arrivalTimeline(
  parties: readonly Party[],
  bucketMinutes: number = EVENT_DAY.timelineBucketMinutes,
): TimelineBar[] {
  const size = bucketMinutes * 60_000;
  const buckets = new Map<number, { people: number; parties: Set<string> }>();
  for (const p of parties)
    for (const c of p.checkins) {
      const t = Date.parse(c.at);
      if (!Number.isFinite(t)) continue;
      const at = Math.floor(t / size) * size;
      const b = buckets.get(at) ?? { people: 0, parties: new Set<string>() };
      b.people += c.count;
      b.parties.add(p.unitId);
      buckets.set(at, b);
    }
  if (!buckets.size) return [];
  const keys = [...buckets.keys()];
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const out: TimelineBar[] = [];
  for (let at = first; at <= last; at += size) {
    const b = buckets.get(at);
    out.push({ at, people: b?.people ?? 0, parties: b?.parties.size ?? 0 });
  }
  return out;
}

export interface MergeSuggestion {
  from: TableFill;
  into: TableFill;
  /** the people who would sit at `into` after the merge (live seats) */
  after: number;
}

/**
 * Half-empty tables that could merge, once the grace time has passed: two tables whose live seats are
 * each at most half their seats, the smaller joining the bigger when both fit its seats. The fullest
 * results first; each table in one suggestion at most.
 */
export function mergeSuggestions(
  fills: readonly TableFill[],
  isReleased: boolean,
  max: number = EVENT_DAY.maxSuggestions,
): MergeSuggestion[] {
  if (!isReleased) return [];
  const halfEmpty = fills.filter((f) => f.load > 0 && f.load * 2 <= f.table.capacity);
  const pairs: MergeSuggestion[] = [];
  for (const from of halfEmpty)
    for (const into of halfEmpty) {
      if (from === into) continue;
      // the smaller moves (a tie: the higher number joins the lower)
      if (from.load > into.load || (from.load === into.load && from.table.number < into.table.number))
        continue;
      const after = from.load + into.load;
      if (after > into.table.capacity) continue;
      pairs.push({ from, into, after });
    }
  pairs.sort(
    (a, b) =>
      b.after / b.into.table.capacity - a.after / a.into.table.capacity ||
      a.from.load - b.from.load ||
      a.from.table.number - b.from.table.number,
  );
  const used = new Set<string>();
  const out: MergeSuggestion[] = [];
  for (const s of pairs) {
    if (used.has(s.from.table.id) || used.has(s.into.table.id)) continue;
    used.add(s.from.table.id);
    used.add(s.into.table.id);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Can a table take these many live seats more (a move or a merge the host is about to make)? */
export const fits = (fill: Pick<TableFill, 'load' | 'table'>, need: number) =>
  fill.load + need <= fill.table.capacity;

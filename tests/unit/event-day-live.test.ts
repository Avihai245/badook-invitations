import { describe, expect, it } from 'vitest';
import { codeFromScan, qrPayload } from '@/features/event-day/codes';
import {
  arrivalTimeline,
  eventStartMs,
  fits,
  halfEmptyAlerts,
  heatOf,
  HEAT,
  liveSeats,
  mergeSuggestions,
  released,
  tableFills,
} from '@/features/event-day/live';
import type { HallTable, Party } from '@/features/event-day/model';

// The live hall (features/event-day/live.ts): the event's start in its time zone, live seats before and
// after the grace time, each table's fill and heat, the alert for tables still under half full 45
// minutes after the start, the timeline of arrivals, the merge suggestions; and the entrance QR's text.

const table = (id: string, number: number, capacity = 10): HallTable => ({
  id,
  number,
  shape: 'round',
  capacity,
  x: number * 3,
  y: 3,
  w: 1.8,
  h: 1.8,
  rotation: 0,
});
let n = 0;
function party(
  tableId: string | null,
  seats: number,
  arrivals: [number, string][] = [],
  status: Party['status'] = 'confirmed',
): Party {
  n++;
  return {
    unitId: `u${n}`,
    guestId: null,
    name: `family ${n}`,
    status,
    seats,
    people: [],
    phoneTail: null,
    table: tableId ? { id: tableId, number: Number(tableId.slice(1)), label: null } : null,
    arrived: arrivals.reduce((s, [c]) => s + c, 0),
    checkins: arrivals.map(([count, at], i) => ({ id: `c${n}-${i}`, count, at, station: 'entrance' })),
  };
}

describe('the event’s start', () => {
  it('is the date and start time in the invitation’s zone (summer and winter time)', () => {
    expect(new Date(eventStartMs('2027-06-17', '19:30', 'Asia/Jerusalem')!).toISOString()).toBe(
      '2027-06-17T16:30:00.000Z',
    );
    expect(new Date(eventStartMs('2027-01-10', '19:30', 'Asia/Jerusalem')!).toISOString()).toBe(
      '2027-01-10T17:30:00.000Z',
    );
    expect(new Date(eventStartMs('2027-01-10', '19:30', 'Europe/London')!).toISOString()).toBe(
      '2027-01-10T19:30:00.000Z',
    );
  });
  it('none without a date or time', () => {
    expect(eventStartMs(null, '19:30', 'Asia/Jerusalem')).toBeNull();
    expect(eventStartMs('2027-06-17', null, 'Asia/Jerusalem')).toBeNull();
    expect(eventStartMs('17/06/2027', '19:30', 'Asia/Jerusalem')).toBeNull();
    expect(eventStartMs('2027-06-17', '19:30', 'Not/AZone')).toBeNull();
  });
  it('45 minutes after it, the missing count as not coming', () => {
    const start = Date.parse('2027-06-17T16:30:00Z');
    expect(released(start, start + 44 * 60_000)).toBe(false);
    expect(released(start, start + 45 * 60_000)).toBe(true);
    expect(released(null, start + 10 * 3_600_000)).toBe(false);
  });
});

describe('live seats', () => {
  it('a family that arrived takes the people who came (and holds the rest until released)', () => {
    expect(liveSeats(4, 0, false)).toBe(4);
    expect(liveSeats(4, 0, true)).toBe(0);
    expect(liveSeats(4, 2, false)).toBe(4);
    expect(liveSeats(4, 2, true)).toBe(2);
    // more than expected came
    expect(liveSeats(4, 6, false)).toBe(6);
    expect(liveSeats(0, 2, true)).toBe(2);
  });
});

describe('table fill, heat and the half-empty alert', () => {
  const tables = [table('t1', 1), table('t2', 2), table('t3', 3, 4), table('t4', 4)];
  const T = '2027-06-17T16:';
  const parties = [
    party('t1', 4, [[4, `${T}20:00Z`]]),
    party('t1', 4, [[2, `${T}40:00Z`]]),
    party('t1', 2),
    party('t2', 5),
    party('t2', 3, [], 'declined'),
    party('t3', 4, [[6, `${T}35:00Z`]]),
    party(null, 2, [[2, `${T}50:00Z`]]),
  ];
  const fills = tableFills(tables, parties, false);
  const by = (id: string) => fills.find((f) => f.table.id === id)!;

  it('counts expected and arrived people and families per table, in number order', () => {
    expect(fills.map((f) => f.table.number)).toEqual([1, 2, 3, 4]);
    expect(by('t1')).toMatchObject({
      expected: 10,
      arrived: 6,
      parties: 3,
      arrivedParties: 2,
      load: 10,
      over: false,
    });
    expect(by('t1').ratio).toBeCloseTo(0.6);
    // a family that declined isn't expected
    expect(by('t2')).toMatchObject({ expected: 5, arrived: 0, parties: 1, load: 5 });
    expect(by('t3')).toMatchObject({ expected: 4, arrived: 6, over: true, load: 6 });
    expect(by('t4')).toMatchObject({ expected: 0, arrived: 0, parties: 0, ratio: 0 });
    // released: the missing free their seats
    const later = tableFills(tables, parties, true);
    expect(later.find((f) => f.table.id === 't1')!.load).toBe(6);
    expect(later.find((f) => f.table.id === 't2')!.load).toBe(0);
  });

  it('heat: grey when nobody is expected, sand before anyone came, greens as it fills, red over its seats', () => {
    expect(heatOf(by('t4'))).toBe(HEAT.none);
    expect(heatOf(by('t2'))).toBe(HEAT.steps[0]);
    expect(heatOf(by('t1'))).toBe(HEAT.steps[2]);
    expect(heatOf(by('t3'))).toBe(HEAT.over);
    expect(heatOf({ expected: 10, arrived: 10, ratio: 1, over: false })).toBe(HEAT.steps[4]);
    expect(heatOf({ expected: 10, arrived: 1, ratio: 0.1, over: false })).toBe(HEAT.steps[1]);
  });

  it('alerts 45 minutes after the start about tables where fewer than half of their people arrived', () => {
    const start = Date.parse('2027-06-17T16:30:00Z');
    expect(halfEmptyAlerts(fills, start, start + 30 * 60_000)).toEqual([]);
    expect(halfEmptyAlerts(fills, start, start + 50 * 60_000).map((f) => f.table.number)).toEqual([2]);
    // exactly half isn't under half
    const half = tableFills([table('t9', 9)], [party('t9', 4, [[2, `${T}20:00Z`]])], true);
    expect(halfEmptyAlerts(half, start, start + 50 * 60_000)).toEqual([]);
    expect(halfEmptyAlerts(fills, null, start + 50 * 60_000)).toEqual([]);
  });
});

describe('the timeline of arrivals', () => {
  it('people and families per 5 minutes, empty buckets included, undone arrivals gone', () => {
    const parties = [
      party('t1', 4, [
        [2, '2027-06-17T16:31:10Z'],
        [2, '2027-06-17T16:47:00Z'],
      ]),
      party('t1', 3, [[3, '2027-06-17T16:34:59Z']]),
      party('t2', 2, [[1, '2027-06-17T16:36:00Z']]),
    ];
    const bars = arrivalTimeline(parties, 5);
    expect(bars.map((b) => [new Date(b.at).toISOString().slice(11, 16), b.people, b.parties])).toEqual([
      ['16:30', 5, 2],
      ['16:35', 1, 1],
      ['16:40', 0, 0],
      ['16:45', 2, 1],
    ]);
    expect(arrivalTimeline([party('t1', 2)])).toEqual([]);
  });
});

describe('merge suggestions', () => {
  it('none before the grace time; then half-empty tables whose people fit one of them, fullest first', () => {
    const T = '2027-06-17T16:40:00Z';
    const tables = [table('t1', 1), table('t2', 2), table('t3', 3), table('t4', 4), table('t5', 5, 6)];
    const parties = [
      party('t1', 10, [[3, T]]),
      party('t2', 10, [[4, T]]),
      party('t3', 10, [[5, T]]),
      party('t4', 10, [[9, T]]),
      party('t5', 6, [[1, T]]),
    ];
    expect(mergeSuggestions(tableFills(tables, parties, false), false)).toEqual([]);
    const suggestions = mergeSuggestions(tableFills(tables, parties, true), true);
    // 2 (4 people) → 3 (5) makes 9/10, the fullest; then 5 (1) → 1 (3) makes 4/10 (the smaller always
    // moves, so 1 never joins 5); t4 is 9/10, not half-empty; each table in one suggestion
    expect(suggestions.map((s) => [s.from.table.number, s.into.table.number, s.after])).toEqual([
      [2, 3, 9],
      [5, 1, 4],
    ]);
    expect(fits({ load: 4, table: table('x', 1) }, 6)).toBe(true);
    expect(fits({ load: 5, table: table('x', 1) }, 6)).toBe(false);
  });
});

describe('the entrance QR', () => {
  it('carries the code with its prefix; anything else is not a guest’s code', () => {
    const code = 'AbCdEfGhIjKlMnOpQrStUv';
    expect(qrPayload(code)).toBe(`BDK1.${code}`);
    expect(codeFromScan(`  BDK1.${code}\n`)).toBe(code);
    expect(codeFromScan(code)).toBeNull();
    expect(codeFromScan('https://example.com/e/x/upload?t=abc')).toBeNull();
    expect(codeFromScan(`BDK1.${code}x`)).toBeNull();
    expect(codeFromScan('BDK1.short')).toBeNull();
  });
});

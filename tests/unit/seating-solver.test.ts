import { describe, expect, it } from 'vitest';
import { applySolution, seatableUnits, solverInput } from '@/features/seating/auto';
import { DEFAULT_SETTINGS, type Plan, type SeatingTable, type UnitInfo } from '@/features/seating/model';
import { rng, solve, WEIGHTS, type SolverInput, type SolverResult } from '@/features/seating/solver';
import { wedding } from './seating-fixtures';

// The automatic seating (src/features/seating/solver.ts): what it never breaks (capacity, whole
// families, locked tables, accessibility), what it reports in words it can't satisfy, that the same
// seed gives the same arrangement, and that a wedding of 400 is seated fast.

const occupancy = (input: SolverInput, r: SolverResult) => {
  const seats = new Map(input.units.map((u) => [u.id, u.seats]));
  const taken = new Map<string, number>();
  for (const [unit, table] of Object.entries(r.assignment))
    if (table) taken.set(table, (taken.get(table) ?? 0) + seats.get(unit)!);
  return taken;
};

const table = (id: string, capacity: number, extra: Partial<SolverInput['tables'][number]> = {}) => ({
  id,
  capacity,
  locked: false,
  accessible: false,
  prox: { stage: 0, dance: 0, exit: 0 },
  ...extra,
});
const unit = (id: string, seats: number, extra: Partial<SolverInput['units'][number]> = {}) => ({
  id,
  seats,
  category: null,
  prefs: { stage: 0, dance: 0, exit: 0 } as const,
  accessible: false,
  ...extra,
});
const input = (over: Partial<SolverInput>): SolverInput => ({
  tables: [],
  units: [],
  rules: [],
  fixed: {},
  options: { categories: 'ignore', minFill: 0, seed: 1, effort: 0.2 },
  ...over,
});

describe('the automatic seating', () => {
  it('never puts more people at a table than it seats, and seats every family whole', () => {
    for (const seed of [1, 2, 3]) {
      const w = wedding({ seed, guests: 180, tables: 18 });
      w.options.effort = 0.3;
      const r = solve(w);
      const caps = new Map(w.tables.map((t) => [t.id, t.capacity]));
      for (const [t, n] of occupancy(w, r)) expect(n).toBeLessThanOrEqual(caps.get(t)!);
      // a unit maps to one table (or none): a family is never split
      expect(Object.keys(r.assignment).sort()).toEqual(w.units.map((u) => u.id).sort());
      expect(r.seated + r.unseated).toBe(w.units.reduce((n, u) => n + u.seats, 0));
    }
  });

  it('seats 400 guests at 40 tables fast, everyone seated and no hard rule broken', () => {
    const w = wedding({ seed: 11 });
    const started = performance.now();
    const r = solve(w);
    const ms = performance.now() - started;
    expect(r.unseated).toBe(0);
    expect(r.seated).toBe(400);
    expect(r.issues.filter((i) => i.code === 'rule' && i.hard)).toEqual([]);
    // a laptop takes a fraction of a second; a mid-range phone a few times that (target: under ~3 s)
    expect(ms).toBeLessThan(2000);
  });

  it('is deterministic for a seed, and another seed gives another arrangement', () => {
    const w = wedding({ seed: 5, guests: 120, tables: 12 });
    w.options.effort = 0.3;
    const a = solve(w);
    const b = solve(structuredClone(w));
    expect(b.assignment).toEqual(a.assignment);
    expect(b.score).toBe(a.score);
    const c = solve({ ...w, options: { ...w.options, seed: 99 } });
    expect(c.assignment).not.toEqual(a.assignment);
  });

  it('leaves locked tables exactly as they are: nobody leaves, nobody joins', () => {
    const w = input({
      tables: [table('t1', 10, { locked: true }), table('t2', 10), table('t3', 10)],
      units: [unit('a', 2), unit('b', 3), unit('c', 4), unit('d', 4), unit('e', 2)],
      fixed: { a: 't1' },
      // e would love to sit with a — but a's table is locked
      rules: [{ kind: 'together', a: 'e', b: 'a', hard: true }],
    });
    const r = solve(w);
    expect(r.assignment.a).toBe('t1');
    expect(Object.entries(r.assignment).filter(([, t]) => t === 't1')).toEqual([['a', 't1']]);
    expect(r.issues).toContainEqual({
      code: 'rule',
      kind: 'together',
      hard: true,
      a: 'e',
      b: 'a',
      locked: 't1',
    });
  });

  it('keeps hard rules: together at one table, apart at different ones', () => {
    const w = input({
      tables: [table('t1', 6), table('t2', 6), table('t3', 6)],
      units: [unit('a', 2), unit('b', 2), unit('c', 2), unit('d', 2), unit('e', 2), unit('f', 2)],
      rules: [
        { kind: 'together', a: 'a', b: 'd', hard: true },
        { kind: 'together', a: 'd', b: 'f', hard: true },
        { kind: 'apart', a: 'b', b: 'c', hard: true },
        { kind: 'apart', a: 'c', b: 'e', hard: true },
      ],
    });
    const r = solve(w);
    expect(r.assignment.a).toBe(r.assignment.d);
    expect(r.assignment.d).toBe(r.assignment.f);
    expect(r.assignment.b).not.toBe(r.assignment.c);
    expect(r.assignment.c).not.toBe(r.assignment.e);
    expect(r.issues.filter((i) => i.code === 'rule')).toEqual([]);
  });

  it('reports rules that contradict each other in words, and seats everyone anyway', () => {
    const w = input({
      tables: [table('t1', 6), table('t2', 6)],
      units: [unit('a', 2), unit('b', 2), unit('c', 2)],
      rules: [
        { kind: 'together', a: 'a', b: 'b', hard: true },
        { kind: 'together', a: 'b', b: 'c', hard: true },
        { kind: 'apart', a: 'a', b: 'c', hard: true },
      ],
    });
    const r = solve(w);
    expect(r.unseated).toBe(0);
    expect(r.issues).toContainEqual({ code: 'conflict', units: expect.arrayContaining(['a', 'b', 'c']) });
    expect(r.issues).toContainEqual({ code: 'rule', kind: 'apart', hard: true, a: 'a', b: 'c' });
  });

  it('a group that must sit together but is bigger than any table: split, and said so', () => {
    const r = solve(
      input({
        tables: [table('t1', 8), table('t2', 8)],
        units: [unit('a', 5), unit('b', 5)],
        rules: [{ kind: 'together', a: 'a', b: 'b', hard: true }],
      }),
    );
    expect(r.issues).toContainEqual({ code: 'too_big_together', units: ['a', 'b'], seats: 10 });
    expect(r.unseated).toBe(0);
  });

  it('a wheelchair unit sits only at an accessible table — or stays without a seat, reported', () => {
    const w = input({
      tables: [table('t1', 10), table('t2', 4, { accessible: true })],
      units: [unit('w', 3, { accessible: true }), unit('x', 2), unit('y', 2)],
    });
    expect(solve(w).assignment.w).toBe('t2');
    const none = solve({ ...w, tables: [table('t1', 10)] });
    expect(none.assignment.w).toBeNull();
    expect(none.issues).toContainEqual({ code: 'unseated', unit: 'w', seats: 3, reason: 'accessible' });
  });

  it('not enough seats: some stay without one, each with the reason', () => {
    const r = solve(input({ tables: [table('t1', 6)], units: [unit('a', 4), unit('b', 3), unit('c', 7)] }));
    const unseated = r.issues.filter((i) => i.code === 'unseated');
    expect(unseated).toContainEqual({ code: 'unseated', unit: 'c', seats: 7, reason: 'too_big' });
    expect(r.unseated).toBe(3 + 7);
    expect(r.breakdown.unseated).toBe(10 * WEIGHTS.unseated);
  });

  it('wishes and categories: near the stage when possible, each category together', () => {
    const w = input({
      tables: [
        table('front', 4, { prox: { stage: 1, dance: 0, exit: 0 } }),
        table('back', 4),
        table('side', 4),
      ],
      units: [
        unit('grandma', 2, { prefs: { stage: 1, dance: -1, exit: 0 }, category: 'family' }),
        unit('f2', 2, { category: 'family' }),
        unit('w1', 2, { category: 'work' }),
        unit('w2', 2, { category: 'work' }),
      ],
      options: { categories: 'group', minFill: 0, seed: 3, effort: 0.3 },
    });
    const r = solve(w);
    expect(r.assignment.grandma).toBe('front');
    // "group": no table mixes family and work
    const family = new Set([r.assignment.grandma, r.assignment.f2]);
    expect(family.has(r.assignment.w1!)).toBe(false);
    expect(family.has(r.assignment.w2!)).toBe(false);
    expect(r.score).toBe(0);
    expect(r.issues).toEqual([]);
    // "mix": a table of one category is what it avoids
    const mixed = solve({ ...w, options: { ...w.options, categories: 'mix' } });
    expect(mixed.breakdown.categories).toBe(0);
  });

  it('balance: tables are filled to the minimum rather than left with two people', () => {
    const w = input({
      tables: [table('t1', 10), table('t2', 10), table('t3', 10)],
      units: Array.from({ length: 8 }, (_, i) => unit(`u${i}`, 2)),
      options: { categories: 'ignore', minFill: 0.7, seed: 2, effort: 0.3 },
    });
    const r = solve(w);
    const used = [...occupancy(w, r).values()].filter((n) => n > 0);
    // 16 people at tables of 10 at least 70% full: two tables of 8, none of 2
    expect(used.every((n) => n >= 7)).toBe(true);
    expect(r.issues.filter((i) => i.code === 'underfilled')).toEqual([]);
  });

  it('the seeded random generator is repeatable', () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(43)()).not.toBe(rng(42)());
  });
});

describe('the plan and the solver', () => {
  const units: UnitInfo[] = [
    {
      id: 'u1',
      guestId: null,
      name: 'כהן',
      status: 'confirmed',
      seats: 3,
      adults: 2,
      children: 1,
      people: [],
      group: 'עבודה',
    },
    {
      id: 'u2',
      guestId: null,
      name: 'לוי',
      status: 'pending',
      seats: 2,
      adults: 0,
      children: 0,
      people: [],
      group: null,
    },
    {
      id: 'u3',
      guestId: null,
      name: 'מזרחי',
      status: 'declined',
      seats: 0,
      adults: 0,
      children: 0,
      people: [],
      group: null,
    },
    {
      id: 'u4',
      guestId: null,
      name: 'פרץ',
      status: 'pending',
      seats: 4,
      adults: 0,
      children: 0,
      people: [],
      group: null,
    },
  ];
  const t = (id: string, number: number, locked = false): SeatingTable => ({
    id,
    number,
    label: null,
    shape: 'round',
    capacity: 10,
    x: number * 3,
    y: 2,
    w: 1.8,
    h: 1.8,
    rotation: 0,
    zones: [],
    locked,
  });
  const plan: Plan = {
    layout: {
      background: null,
      metersPerPixel: null,
      source: null,
      gridM: 0.5,
      landmarks: [{ id: 'stage', kind: 'stage', x: 3, y: 0, w: 4, h: 1, rotation: 0, label: null }],
      settings: DEFAULT_SETTINGS,
    },
    tables: [t('a', 1), t('b', 2, true), t('c', 3)],
    assignments: { u2: { tableId: 'b', source: 'host' }, u3: { tableId: 'c', source: 'host' } },
    rules: [],
    units: { u1: { category: 'צד הכלה', prefs: { stage: 1, dance: 0, exit: 0 }, accessible: false } },
  };

  it('seats the confirmed, and those who haven’t replied only when asked (or already seated)', () => {
    expect(seatableUnits(plan, units).map((u) => u.id)).toEqual(['u1', 'u2']);
    const all = {
      ...plan,
      layout: { ...plan.layout, settings: { ...DEFAULT_SETTINGS, includePending: true } },
    };
    expect(seatableUnits(all, units).map((u) => u.id)).toEqual(['u1', 'u2', 'u4']);
  });

  it('builds the input: locked tables’ people fixed, proximity from the landmarks, the host’s category', () => {
    const i = solverInput(plan, units, 7);
    expect(i.fixed).toEqual({ u2: 'b' });
    expect(i.units.find((u) => u.id === 'u1')).toMatchObject({ category: 'צד הכלה', prefs: { stage: 1 } });
    expect(i.tables.find((x) => x.id === 'a')!.prox.stage).toBe(1);
    expect(i.options).toMatchObject({ seed: 7, categories: 'group', minFill: 0.6 });
  });

  it('applies the result: locked tables untouched, declined units’ seats freed', () => {
    const next = applySolution(plan, units, {
      assignment: { u1: 'c', u2: 'b' },
      score: 0,
      breakdown: { unseated: 0, rules: 0, preferences: 0, categories: 0, fill: 0 },
      issues: [],
      seated: 5,
      unseated: 0,
      iterations: 0,
    });
    expect(next.assignments).toEqual({
      u1: { tableId: 'c', source: 'solver' },
      u2: { tableId: 'b', source: 'host' },
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  frozenChanges,
  frozenTables,
  positionOf,
  staleUnits,
  type ToldMap,
} from '@/features/event-day/freeze';
import type { Plan, SeatingTable } from '@/features/seating/model';

// The freeze (features/event-day/freeze.ts): once families were told their table numbers, a plan change
// that moves one, leaves it without a table or renumbers its table is caught (the host confirms); other
// families and other changes pass; afterwards only the families whose number isn't what they were told
// need a new message.

const table = (id: string, number: number): SeatingTable => ({
  id,
  number,
  label: null,
  shape: 'round',
  capacity: 10,
  x: number * 3,
  y: 3,
  w: 1.8,
  h: 1.8,
  rotation: 0,
  zones: [],
  locked: false,
});
const plan = (
  tables: SeatingTable[],
  seats: Record<string, string>,
): Pick<Plan, 'tables' | 'assignments'> => ({
  tables,
  assignments: Object.fromEntries(Object.entries(seats).map(([u, t]) => [u, { tableId: t, source: 'host' }])),
});
const told = (number: number, tableId: string) =>
  ({
    tableId,
    number,
    label: null,
    channel: 'whatsapp',
    status: 'delivered',
    at: '2027-06-10T10:00:00Z',
  }) as const;

const tables = [table('t1', 1), table('t2', 2), table('t3', 3)];
const before = plan(tables, { cohen: 't1', levi: 't2', peretz: 't2', new: 't3' });
const TOLD: ToldMap = { cohen: told(1, 't1'), levi: told(2, 't2') };

describe('frozenChanges', () => {
  it('nothing when nothing that seats people or numbers tables changed', () => {
    expect(frozenChanges(before, before, TOLD)).toEqual([]);
    expect(frozenChanges(before, { ...before }, TOLD)).toEqual([]);
  });

  it('a told family moved, left without a table, or its table renumbered', () => {
    const moved = plan(tables, { cohen: 't3', levi: 't2', peretz: 't2', new: 't3' });
    expect(frozenChanges(before, moved, TOLD)).toEqual([
      { unitId: 'cohen', told: 1, from: 1, to: 3, kind: 'moved' },
    ]);
    const unseated = plan(tables, { levi: 't2', peretz: 't2', new: 't3' });
    expect(frozenChanges(before, unseated, TOLD)).toEqual([
      { unitId: 'cohen', told: 1, from: 1, to: null, kind: 'unseated' },
    ]);
    const renumbered = { ...before, tables: [table('t1', 1), table('t2', 12), table('t3', 3)] };
    expect(frozenChanges(before, renumbered, TOLD)).toEqual([
      { unitId: 'levi', told: 2, from: 2, to: 12, kind: 'renumbered' },
    ]);
    // a removed table leaves its told families without one
    const removed = plan([table('t1', 1), table('t3', 3)], { cohen: 't1', new: 't3' });
    expect(frozenChanges(before, removed, TOLD).map((c) => [c.unitId, c.kind])).toEqual([
      ['levi', 'unseated'],
    ]);
  });

  it('families never told move freely; two tables swapping numbers catch both told families', () => {
    const others = plan(tables, { cohen: 't1', levi: 't2', peretz: 't3', new: 't1' });
    expect(frozenChanges(before, others, TOLD)).toEqual([]);
    const swapped = { ...before, tables: [table('t1', 2), table('t2', 1), table('t3', 3)] };
    expect(frozenChanges(before, swapped, TOLD).map((c) => [c.unitId, c.from, c.to])).toEqual([
      ['cohen', 1, 2],
      ['levi', 2, 1],
    ]);
  });

  it('a family already moved once (told 1, now at 3) is caught again when it moves on', () => {
    const now = plan(tables, { cohen: 't3', levi: 't2' });
    const next = plan(tables, { cohen: 't2', levi: 't2' });
    expect(frozenChanges(now, next, TOLD)).toEqual([
      { unitId: 'cohen', told: 1, from: 3, to: 2, kind: 'moved' },
    ]);
  });
});

describe('staleUnits and frozenTables', () => {
  it('who needs the new number, and which tables’ numbers were told', () => {
    expect(staleUnits(before, TOLD)).toEqual([]);
    const after = plan([table('t1', 1), table('t2', 12), table('t3', 3)], { cohen: 't3', levi: 't2' });
    expect(staleUnits(after, TOLD).sort()).toEqual(['cohen', 'levi']);
    // moved back to the number they were told: fine again
    expect(staleUnits(plan(tables, { cohen: 't1', levi: 't2' }), TOLD)).toEqual([]);
    expect([...frozenTables(before, TOLD)].sort()).toEqual(['t1', 't2']);
    expect([...frozenTables(after, TOLD)]).toEqual([]);
    expect(positionOf(before, 'nobody')).toBeNull();
  });
});

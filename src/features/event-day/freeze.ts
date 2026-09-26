import type { Plan } from '@/features/seating/model';
import type { Told } from './model';

/**
 * The freeze (pure; tests in tests/unit/event-day-freeze.test.ts): once a family was told its table
 * number, a change of the plan that moves it, leaves it without a table, or gives its table another
 * number asks the host first — and afterwards only those families need the new number. The database
 * records the same changes in the audit trail (seating_save_tracked).
 */

export type ToldMap = Readonly<Record<string, Told>>;

/** Where a family sits in a plan: the table and its number (null: no table). */
export function positionOf(
  plan: Pick<Plan, 'tables' | 'assignments'>,
  unitId: string,
): { tableId: string; number: number } | null {
  const tableId = plan.assignments[unitId]?.tableId;
  const table = tableId ? plan.tables.find((t) => t.id === tableId) : undefined;
  return table ? { tableId: table.id, number: table.number } : null;
}

export interface FrozenChange {
  unitId: string;
  /** the number it was told */
  told: number;
  /** its number before the change and after it (null: no table) */
  from: number | null;
  to: number | null;
  /** moved to another table, its table renumbered, or left without one */
  kind: 'moved' | 'renumbered' | 'unseated';
}

/** The told families whose table or number would change from `before` to `after`. */
export function frozenChanges(
  before: Pick<Plan, 'tables' | 'assignments'>,
  after: Pick<Plan, 'tables' | 'assignments'>,
  told: ToldMap,
): FrozenChange[] {
  // nothing that seats people or numbers tables changed: nothing to check (a table dragged, a setting)
  if (before.assignments === after.assignments && before.tables === after.tables) return [];
  const out: FrozenChange[] = [];
  for (const [unitId, t] of Object.entries(told)) {
    const b = positionOf(before, unitId);
    const a = positionOf(after, unitId);
    if (b?.tableId === a?.tableId && b?.number === a?.number) continue;
    out.push({
      unitId,
      told: t.number,
      from: b?.number ?? null,
      to: a?.number ?? null,
      kind: !a ? 'unseated' : b?.tableId !== a.tableId ? 'moved' : 'renumbered',
    });
  }
  return out;
}

/** Told families whose number now isn't the one they were told (or who have no table any more). */
export function staleUnits(plan: Pick<Plan, 'tables' | 'assignments'>, told: ToldMap): string[] {
  return Object.entries(told)
    .filter(([unitId, t]) => positionOf(plan, unitId)?.number !== t.number)
    .map(([unitId]) => unitId);
}

/** Tables whose number some family was told (renumbering them asks first). */
export function frozenTables(plan: Pick<Plan, 'tables' | 'assignments'>, told: ToldMap): Set<string> {
  const out = new Set<string>();
  for (const [unitId, t] of Object.entries(told)) {
    const p = positionOf(plan, unitId);
    if (p && p.number === t.number) out.add(p.tableId);
  }
  return out;
}

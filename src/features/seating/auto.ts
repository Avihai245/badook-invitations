import { proximity } from './geometry';
import { unitCategory, unitSettings, type Plan, type UnitInfo } from './model';
import type { SolverInput, SolverResult } from './solver';

/**
 * Between the plan and the automatic seating (solver.ts): what it is asked to seat, and its answer
 * applied back to the plan. Unit-tested in tests/unit/seating-solver.test.ts.
 */

/**
 * Who the automatic seating seats: everyone coming (the reply's people); guests who haven't replied
 * when the host asked for them (by the list's party size) or already seated them by hand; never those
 * who declined. Those at a locked table stay there.
 */
export function seatableUnits(plan: Plan, units: readonly UnitInfo[]): UnitInfo[] {
  return units.filter(
    (u) =>
      u.seats > 0 &&
      (u.status === 'confirmed' ||
        (u.status === 'pending' && (plan.layout.settings.includePending || !!plan.assignments[u.id]))),
  );
}

export function solverInput(plan: Plan, units: readonly UnitInfo[], seed: number): SolverInput {
  const locked = new Set(plan.tables.filter((t) => t.locked).map((t) => t.id));
  const list = seatableUnits(plan, units);
  const ids = new Set(list.map((u) => u.id));
  const fixed: Record<string, string> = {};
  for (const [unitId, a] of Object.entries(plan.assignments))
    if (ids.has(unitId) && locked.has(a.tableId)) fixed[unitId] = a.tableId;
  const { landmarks, settings } = plan.layout;
  return {
    tables: plan.tables.map((t) => ({
      id: t.id,
      capacity: t.capacity,
      locked: t.locked,
      accessible: t.zones.includes('accessible'),
      prox: {
        stage: proximity(t, landmarks, 'stage'),
        dance: proximity(t, landmarks, 'dance'),
        exit: proximity(t, landmarks, 'exit'),
      },
    })),
    units: list.map((u) => {
      const s = unitSettings(plan, u.id);
      return {
        id: u.id,
        seats: u.seats,
        category: unitCategory(plan, u),
        prefs: s.prefs,
        accessible: s.accessible,
      };
    }),
    rules: plan.rules.map((r) => ({ kind: r.kind, a: r.a, b: r.b, hard: r.hard })),
    fixed,
    options: { categories: settings.categories, minFill: settings.minFill, seed },
  };
}

/**
 * The solver's arrangement in the plan: every unit at an open table goes where the solver put it (or
 * back to the list); locked tables keep who they had; a seat held by someone who declined is freed.
 */
export function applySolution(plan: Plan, units: readonly UnitInfo[], result: SolverResult): Plan {
  const locked = new Set(plan.tables.filter((t) => t.locked).map((t) => t.id));
  const declined = new Set(units.filter((u) => u.status === 'declined').map((u) => u.id));
  const assignments: Plan['assignments'] = {};
  for (const [unitId, a] of Object.entries(plan.assignments))
    if (locked.has(a.tableId) && !declined.has(unitId)) assignments[unitId] = a;
  // (everyone seated at an open table was part of the solver's input — seatableUnits — so nobody else
  // keeps a seat the solver may have given away)
  for (const [unitId, tableId] of Object.entries(result.assignment)) {
    if (assignments[unitId]) continue;
    if (tableId && !locked.has(tableId)) assignments[unitId] = { tableId, source: 'solver' };
  }
  return { ...plan, assignments };
}

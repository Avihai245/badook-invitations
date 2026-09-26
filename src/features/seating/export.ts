import { unitCategory, type Plan, type SeatingTable, type UnitInfo } from './model';
import { occupancy, unitsById } from './plan';

/**
 * What the print view and the Excel file list — pure, so the rows are unit-tested
 * (tests/unit/seating-export.test.ts).
 */

/**
 * The name a list is sorted by: without a leading "family" word ("משפחת כהן" sorts under כ, "The
 * Levis" under L), trimmed.
 */
export function sortKey(name: string): string {
  return name
    .trim()
    .replace(/^(משפחת|משפ['׳]|mishpachat|the\s+family|family|the)\s+/i, '')
    .trim();
}

export interface GuestRow {
  unitId: string;
  name: string;
  /** the attendees' names from the reply (empty before a reply) */
  people: string[];
  seats: number;
  table: number | null;
  tableLabel: string | null;
  category: string | null;
  status: UnitInfo['status'];
}

/**
 * Everyone to find a seat for, A→Z (Hebrew or English collation): units coming, and units that haven't
 * replied but were seated; those without a table last in their letter's place, with no table number.
 */
export function guestRows(plan: Plan, units: readonly UnitInfo[], locale: 'he' | 'en'): GuestRow[] {
  const tables = new Map(plan.tables.map((t) => [t.id, t]));
  const collator = new Intl.Collator(locale === 'he' ? 'he' : 'en', { sensitivity: 'base', numeric: true });
  return units
    .filter(
      (u) => u.seats > 0 && (u.status === 'confirmed' || (u.status === 'pending' && plan.assignments[u.id])),
    )
    .map((u) => {
      const t = tables.get(plan.assignments[u.id]?.tableId ?? '');
      return {
        unitId: u.id,
        name: u.name,
        people: u.people,
        seats: u.seats,
        table: t?.number ?? null,
        tableLabel: t?.label ?? null,
        category: unitCategory(plan, u),
        status: u.status,
      };
    })
    .sort((a, b) => collator.compare(sortKey(a.name), sortKey(b.name)) || collator.compare(a.name, b.name));
}

export interface TableRow {
  table: SeatingTable;
  seated: number;
  units: { id: string; name: string; seats: number; people: string[] }[];
}

/** The tables by number, each with who sits there (A→Z) and how full it is. */
export function tableRows(plan: Plan, units: readonly UnitInfo[], locale: 'he' | 'en'): TableRow[] {
  const byId = unitsById(units);
  const taken = occupancy(plan, byId);
  const collator = new Intl.Collator(locale === 'he' ? 'he' : 'en', { sensitivity: 'base', numeric: true });
  const at = new Map<string, TableRow['units']>();
  for (const [unitId, a] of Object.entries(plan.assignments)) {
    const u = byId.get(unitId);
    if (!u || u.status === 'declined') continue;
    if (!at.has(a.tableId)) at.set(a.tableId, []);
    at.get(a.tableId)!.push({ id: u.id, name: u.name, seats: u.seats, people: u.people });
  }
  return [...plan.tables]
    .sort((a, b) => a.number - b.number)
    .map((table) => ({
      table,
      seated: taken.get(table.id) ?? 0,
      units: (at.get(table.id) ?? []).sort((a, b) => collator.compare(sortKey(a.name), sortKey(b.name))),
    }));
}

/** The Excel file's column titles and words (from the dictionary). */
export interface SheetWords {
  guestsSheet: string;
  tablesSheet: string;
  name: string;
  party: string;
  seats: string;
  table: string;
  tableName: string;
  category: string;
  status: string;
  capacity: string;
  seated: string;
  guests: string;
  noTable: string;
  confirmed: string;
  pending: string;
}

export type Cell = string | number | null;

/**
 * The Excel file: "Guests" — one row per person when the reply named them (else one per party), A→Z,
 * with the party, its size, the table number and name, the category and the reply's status — and
 * "Tables" — one row per table with its seats, how many sit there and who.
 */
export function excelSheets(
  plan: Plan,
  units: readonly UnitInfo[],
  locale: 'he' | 'en',
  w: SheetWords,
): { name: string; rows: Cell[][] }[] {
  const collator = new Intl.Collator(locale === 'he' ? 'he' : 'en', { sensitivity: 'base', numeric: true });
  const people: Cell[][] = [];
  for (const g of guestRows(plan, units, locale)) {
    const names = g.people.length ? g.people : [g.name];
    for (const person of names)
      people.push([
        person,
        g.name,
        g.seats,
        g.table ?? w.noTable,
        g.tableLabel,
        g.category,
        g.status === 'confirmed' ? w.confirmed : w.pending,
      ]);
  }
  people.sort((a, b) => collator.compare(sortKey(String(a[0])), sortKey(String(b[0]))));
  const tables: Cell[][] = tableRows(plan, units, locale).map((r) => [
    r.table.number,
    r.table.label,
    r.table.capacity,
    r.seated,
    r.units.map((u) => (u.seats > 1 ? `${u.name} (${u.seats})` : u.name)).join(', '),
  ]);
  return [
    {
      name: w.guestsSheet,
      rows: [[w.name, w.party, w.seats, w.table, w.tableName, w.category, w.status], ...people],
    },
    { name: w.tablesSheet, rows: [[w.table, w.tableName, w.capacity, w.seated, w.guests], ...tables] },
  ];
}

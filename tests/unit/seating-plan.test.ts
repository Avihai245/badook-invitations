import { describe, expect, it } from 'vitest';
import { excelSheets, guestRows, sortKey, tableRows } from '@/features/seating/export';
import {
  DEFAULT_SETTINGS,
  readState,
  toDbPlan,
  type Plan,
  type SeatingTable,
  type UnitInfo,
} from '@/features/seating/model';
import {
  addLandmark,
  addRule,
  addTable,
  assign,
  canSeat,
  dropStale,
  duplicateTable,
  mergePlans,
  nextTableNumber,
  removeItems,
  seatingStats,
  setUnitSettings,
  unassign,
  unitsById,
  updateTable,
} from '@/features/seating/plan';

// The seating plan's operations (src/features/seating/plan.ts): seating whole families with the
// capacity blocked, tables and their numbers, what stands where, the three-way merge when two windows
// edit at once — and the rows of the print view and the Excel file (export.ts).

const u = (id: string, name: string, seats: number, over: Partial<UnitInfo> = {}): UnitInfo => ({
  id,
  guestId: null,
  name,
  status: 'confirmed',
  seats,
  adults: seats,
  children: 0,
  people: [],
  group: null,
  ...over,
});
const units = [
  u('cohen', 'משפחת כהן', 4, { people: ['דני כהן', 'רותי כהן', 'נועם כהן', 'מאיה כהן'], group: 'עבודה' }),
  u('levi', 'יעל לוי', 2),
  u('abutbul', 'אבוטבול', 5),
  u('gone', 'לא מגיעים', 0, { status: 'declined' }),
  u('later', 'עוד לא ענו', 3, { status: 'pending' }),
];
const byId = unitsById(units);
const t = (id: string, number: number, capacity = 6, over: Partial<SeatingTable> = {}): SeatingTable => ({
  id,
  number,
  label: null,
  shape: 'round',
  capacity,
  x: number * 3,
  y: 3,
  w: 1.5,
  h: 1.5,
  rotation: 0,
  zones: [],
  locked: false,
  ...over,
});
const empty: Plan = {
  layout: {
    background: null,
    metersPerPixel: null,
    source: null,
    venuePlan: null,
    gridM: 0.5,
    landmarks: [],
    settings: DEFAULT_SETTINGS,
  },
  tables: [t('a', 1), t('b', 2)],
  assignments: {},
  rules: [],
  units: {},
};

describe('seating a family', () => {
  it('seats the whole family at a table with room', () => {
    const { plan, check } = assign(empty, byId, 'cohen', 'a');
    expect(check).toEqual({ ok: true });
    expect(plan.assignments).toEqual({ cohen: { tableId: 'a', source: 'host' } });
  });

  it('blocks a family bigger than the seats left — and says how many are left', () => {
    const one = assign(empty, byId, 'cohen', 'a').plan;
    const { plan, check } = assign(one, byId, 'abutbul', 'a');
    expect(plan).toBe(one);
    expect(check).toMatchObject({ ok: false, reason: 'full', free: 2, needed: 5, table: { number: 1 } });
    expect(canSeat(one, byId, 'levi', 'a')).toEqual({ ok: true });
    // someone who declined takes no seat and isn't seated
    expect(assign(one, byId, 'gone', 'b').check).toEqual({ ok: false, reason: 'declined' });
  });

  it('moves a family, and takes it back to the list', () => {
    let plan = assign(empty, byId, 'cohen', 'a').plan;
    plan = assign(plan, byId, 'cohen', 'b').plan;
    expect(plan.assignments.cohen!.tableId).toBe('b');
    expect(unassign(plan, ['cohen']).assignments).toEqual({});
  });
});

describe('tables', () => {
  it('numbers new tables with the lowest free number, in a free spot', () => {
    expect(nextTableNumber({ tables: [t('a', 1), t('c', 3)] })).toBe(2);
    const { plan, id } = addTable(empty, 'knights', { x: 3, y: 3 });
    const table = plan.tables.find((x) => x.id === id)!;
    expect(table).toMatchObject({ number: 3, shape: 'knights', capacity: 20, w: 6, h: 1 });
    // not on top of table 1 at (3, 3)
    expect(Math.hypot(table.x - 3, table.y - 3)).toBeGreaterThan(1);
  });

  it('refuses a number that is taken, and fewer seats than people seated', () => {
    const plan = assign(empty, byId, 'cohen', 'a').plan;
    expect(updateTable(plan, byId, 'a', { number: 2 })).toEqual({
      ok: false,
      reason: 'number_taken',
      number: 2,
    });
    expect(updateTable(plan, byId, 'a', { capacity: 3 })).toEqual({
      ok: false,
      reason: 'below_seated',
      seated: 4,
    });
    const bigger = updateTable(plan, byId, 'a', { capacity: 12 });
    expect(bigger.ok && bigger.plan.tables[0]).toMatchObject({ capacity: 12, w: 2.1 });
    const turned = updateTable(plan, byId, 'a', { rotation: -30, label: '  VIP  ' });
    expect(turned.ok && turned.plan.tables[0]).toMatchObject({ rotation: 330, label: 'VIP' });
  });

  it('removing a table sends its people back to the list; a copy gets the next number, nobody seated', () => {
    const plan = assign(assign(empty, byId, 'cohen', 'a').plan, byId, 'levi', 'b').plan;
    const removed = removeItems(plan, new Set(['a']));
    expect(removed.tables.map((x) => x.id)).toEqual(['b']);
    expect(removed.assignments).toEqual({ levi: { tableId: 'b', source: 'host' } });
    const copy = duplicateTable(plan, 'a')!;
    expect(copy.plan.tables.find((x) => x.id === copy.id)).toMatchObject({
      number: 3,
      capacity: 6,
      locked: false,
    });
  });

  it('landmarks are added in a free spot and removed like tables', () => {
    const { plan, id } = addLandmark(empty, 'stage', null);
    expect(plan.layout.landmarks).toEqual([expect.objectContaining({ id, kind: 'stage', w: 6, h: 3 })]);
    expect(removeItems(plan, new Set([id])).layout.landmarks).toEqual([]);
  });
});

describe('rules, settings and where things stand', () => {
  it('a pair has one rule (the newest), never with itself', () => {
    let plan = addRule(empty, { kind: 'together', a: 'cohen', b: 'levi', hard: true });
    plan = addRule(plan, { kind: 'apart', a: 'levi', b: 'cohen', hard: false });
    expect(plan.rules).toEqual([
      expect.objectContaining({ kind: 'apart', a: 'levi', b: 'cohen', hard: false }),
    ]);
    expect(addRule(plan, { kind: 'apart', a: 'levi', b: 'levi', hard: true })).toBe(plan);
  });

  it('keeps a unit’s settings even back at the defaults (so the reset is saved)', () => {
    let plan = setUnitSettings(empty, 'levi', { accessible: true, prefs: { stage: 1, dance: 0, exit: 0 } });
    plan = setUnitSettings(plan, 'levi', { accessible: false, prefs: { stage: 0, dance: 0, exit: 0 } });
    expect(plan.units.levi).toEqual({
      category: null,
      accessible: false,
      prefs: { stage: 0, dance: 0, exit: 0 },
    });
    expect(toDbPlan(plan).units).toEqual([
      { id: 'levi', category: null, stage: 0, dance: 0, exit: 0, accessible: false },
    ]);
  });

  it('counts who is seated, who isn’t, full tables and seats held by those who declined', () => {
    let plan = assign(empty, byId, 'cohen', 'a').plan;
    plan = { ...plan, assignments: { ...plan.assignments, gone: { tableId: 'b', source: 'host' } } };
    // replies grew after seating: table a is over
    const grown = units.map((x) => (x.id === 'cohen' ? { ...x, seats: 7 } : x));
    const s = seatingStats(plan, grown);
    expect(s).toMatchObject({
      confirmed: 14,
      seatedConfirmed: 7,
      seats: 12,
      unseatedUnits: 2,
      declinedSeated: ['gone'],
    });
    expect(s.over.map((x) => x.number)).toEqual([1]);
  });

  it('drops seats and rules of units that are gone', () => {
    const plan: Plan = {
      ...empty,
      assignments: { ghost: { tableId: 'a', source: 'host' }, cohen: { tableId: 'a', source: 'host' } },
      rules: [{ id: 'r', kind: 'apart', a: 'ghost', b: 'cohen', hard: true }],
    };
    const clean = dropStale(plan, byId);
    expect(Object.keys(clean.assignments)).toEqual(['cohen']);
    expect(clean.rules).toEqual([]);
  });
});

describe('two windows at once', () => {
  it('applies this window’s changes on top of the other’s, per table and per seat', () => {
    const base = assign(empty, byId, 'cohen', 'a').plan;
    // the other window: moved table b, seated levi at b, added table 3
    let server = {
      ...base,
      tables: [...base.tables.map((x) => (x.id === 'b' ? { ...x, x: 20 } : x)), t('c', 3)],
    };
    server = assign(server, byId, 'levi', 'b').plan;
    // this window: renamed table a, moved cohen to b, added its own table 3
    let local = {
      ...base,
      tables: [...base.tables.map((x) => (x.id === 'a' ? { ...x, label: 'VIP' } : x)), t('d', 3)],
    };
    local = assign(local, byId, 'cohen', 'b').plan;
    const merged = mergePlans(base, local, server);
    expect(merged.tables.find((x) => x.id === 'a')!.label).toBe('VIP');
    expect(merged.tables.find((x) => x.id === 'b')!.x).toBe(20);
    // both new tables stay; the stored one keeps number 3, this window's moves on
    expect(merged.tables.find((x) => x.id === 'c')!.number).toBe(3);
    expect(merged.tables.find((x) => x.id === 'd')!.number).toBe(4);
    expect(merged.assignments).toEqual({
      cohen: { tableId: 'b', source: 'host' },
      levi: { tableId: 'b', source: 'host' },
    });
  });

  it('a table the other window removed takes its seats with it, unless this window changed it', () => {
    const base = assign(empty, byId, 'cohen', 'a').plan;
    const server = removeItems(base, new Set(['a']));
    expect(mergePlans(base, base, server).assignments).toEqual({});
    const local = { ...base, tables: base.tables.map((x) => (x.id === 'a' ? { ...x, capacity: 8 } : x)) };
    expect(mergePlans(base, local, server).tables.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('reading the database', () => {
  it('turns seating_state into the editor’s state (numbers from numeric columns, defaults)', () => {
    const state = readState({
      layout: {
        version: 3,
        gridM: '0.50',
        metersPerPixel: '0.02500000',
        source: 'partner',
        landmarks: [],
        settings: {},
      },
      tables: [
        {
          id: 'a',
          number: 1,
          shape: 'rect',
          capacity: 8,
          x: '1.50',
          y: 2,
          w: 2.4,
          h: 0.9,
          rotation: 90,
          zones: ['stage', 'bogus'],
          locked: true,
        },
      ],
      units: [
        {
          id: 'x',
          name: 'כהן',
          status: 'confirmed',
          seats: 3,
          people: ['א', null],
          prefs: { stage: 1, dance: 0, exit: 0 },
        },
        { id: 'y', name: 'לוי', status: 'pending', seats: 2, prefs: { stage: 0, dance: 0, exit: 0 } },
      ],
      assignments: [{ unitId: 'x', tableId: 'a', source: 'solver' }],
      constraints: [{ id: 'r', kind: 'apart', a: 'x', b: 'y', hard: false }],
      venue: null,
    });
    expect(state.version).toBe(3);
    expect(state.plan.layout).toMatchObject({
      gridM: 0.5,
      metersPerPixel: 0.025,
      source: 'partner',
      settings: DEFAULT_SETTINGS,
    });
    expect(state.plan.tables[0]).toMatchObject({ x: 1.5, zones: ['stage'], locked: true, rotation: 90 });
    expect(state.units[0]).toMatchObject({ people: ['א'], status: 'confirmed', seats: 3 });
    expect(state.plan.units).toEqual({
      x: { category: null, prefs: { stage: 1, dance: 0, exit: 0 }, accessible: false },
    });
    expect(state.plan.assignments).toEqual({ x: { tableId: 'a', source: 'solver' } });
    expect(state.plan.rules).toEqual([{ id: 'r', kind: 'apart', a: 'x', b: 'y', hard: false }]);
  });
});

describe('print and Excel rows', () => {
  const plan: Plan = {
    ...empty,
    tables: [t('a', 1, 6, { label: 'משפחה' }), t('b', 2)],
    assignments: {
      cohen: { tableId: 'a', source: 'host' },
      levi: { tableId: 'b', source: 'solver' },
      later: { tableId: 'b', source: 'host' },
    },
  };

  it('sorts names A→Z without the family word', () => {
    expect(sortKey('משפחת כהן')).toBe('כהן');
    expect(sortKey("משפ' לוי")).toBe('לוי');
    expect(sortKey('The Smith family')).toBe('Smith family');
    expect(sortKey('Family Jones')).toBe('Jones');
    expect(guestRows(plan, units, 'he').map((r) => [r.name, r.table])).toEqual([
      ['אבוטבול', null],
      ['יעל לוי', 2],
      ['משפחת כהן', 1],
      ['עוד לא ענו', 2],
    ]);
  });

  it('lists the tables by number with who sits there', () => {
    const rows = tableRows(plan, units, 'he');
    expect(rows.map((r) => [r.table.number, r.seated, r.units.map((x) => x.name)])).toEqual([
      [1, 4, ['משפחת כהן']],
      [2, 5, ['יעל לוי', 'עוד לא ענו']],
    ]);
  });

  it('the Excel file: a row per person named in the reply, and a row per table', () => {
    const w = {
      guestsSheet: 'אורחים',
      tablesSheet: 'שולחנות',
      name: 'שם',
      party: 'משפחה',
      seats: 'אנשים',
      table: 'שולחן',
      tableName: 'שם השולחן',
      category: 'קטגוריה',
      status: 'סטטוס',
      capacity: 'מקומות',
      seated: 'יושבים',
      guests: 'מי',
      noTable: '—',
      confirmed: 'מגיעים',
      pending: 'לא ענו',
    };
    const [guests, tables] = excelSheets(plan, units, 'he', w);
    expect(guests!.name).toBe('אורחים');
    expect(guests!.rows[0]).toEqual(['שם', 'משפחה', 'אנשים', 'שולחן', 'שם השולחן', 'קטגוריה', 'סטטוס']);
    // Cohen's four people each have a row, with the party and table 1 (named); Abutbul has no table
    expect(guests!.rows.filter((r) => r[1] === 'משפחת כהן')).toHaveLength(4);
    expect(guests!.rows).toContainEqual(['רותי כהן', 'משפחת כהן', 4, 1, 'משפחה', 'עבודה', 'מגיעים']);
    expect(guests!.rows).toContainEqual(['אבוטבול', 'אבוטבול', 5, '—', null, null, 'מגיעים']);
    expect(guests!.rows).toContainEqual(['עוד לא ענו', 'עוד לא ענו', 3, 2, null, null, 'לא ענו']);
    expect(tables!.rows).toEqual([
      ['שולחן', 'שם השולחן', 'מקומות', 'יושבים', 'מי'],
      [1, 'משפחה', 6, 4, 'משפחת כהן (4)'],
      [2, null, 6, 5, 'יעל לוי (2), עוד לא ענו (3)'],
    ]);
  });
});

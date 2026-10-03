/**
 * The budget's formulas, as cases with the numbers they must give. The same list is asserted twice: against the
 * TypeScript mirror used by "what if" (tests/unit/planning-budget.test.ts) and against the database's own
 * functions (tests/db/planning-budget.test.ts), so the two cannot drift apart.
 */

export type CostBasis = 'fixed' | 'per_adult' | 'per_child' | 'per_guest' | 'per_table';
export type VatMode = 'none' | 'included' | 'excluded';

export interface PlannedCase {
  name: string;
  category: {
    costBasis: CostBasis;
    plannedAmount: number;
    unitPrice: number | null;
    childPrice: number | null;
  };
  counts: { adults: number; children: number; tables: number };
  planned: number;
}

export const PLANNED_CASES: PlannedCase[] = [
  {
    name: 'fixed stays as planned, whatever the price says',
    category: { costBasis: 'fixed', plannedAmount: 30000, unitPrice: 500, childPrice: null },
    counts: { adults: 100, children: 10, tables: 10 },
    planned: 30000,
  },
  {
    name: 'per adult with the child supplement',
    category: { costBasis: 'per_adult', plannedAmount: 40000, unitPrice: 400, childPrice: 200 },
    counts: { adults: 3, children: 1, tables: 0 },
    planned: 1400,
  },
  {
    name: 'per adult without a child supplement',
    category: { costBasis: 'per_adult', plannedAmount: 0, unitPrice: 300, childPrice: null },
    counts: { adults: 120, children: 15, tables: 12 },
    planned: 36000,
  },
  {
    name: 'per adult, supplement of zero',
    category: { costBasis: 'per_adult', plannedAmount: 0, unitPrice: 300, childPrice: 0 },
    counts: { adults: 10, children: 4, tables: 1 },
    planned: 3000,
  },
  {
    name: 'per child',
    category: { costBasis: 'per_child', plannedAmount: 0, unitPrice: 150, childPrice: 999 },
    counts: { adults: 3, children: 1, tables: 0 },
    planned: 150,
  },
  {
    name: 'per guest counts everyone',
    category: { costBasis: 'per_guest', plannedAmount: 0, unitPrice: 100, childPrice: null },
    counts: { adults: 3, children: 1, tables: 0 },
    planned: 400,
  },
  {
    name: 'per table',
    category: { costBasis: 'per_table', plannedAmount: 0, unitPrice: 250, childPrice: null },
    counts: { adults: 40, children: 0, tables: 2 },
    planned: 500,
  },
  {
    name: 'per table with no tables yet',
    category: { costBasis: 'per_table', plannedAmount: 900, unitPrice: 250, childPrice: null },
    counts: { adults: 40, children: 0, tables: 0 },
    planned: 0,
  },
  {
    name: 'priced per head but no price yet: stays as planned',
    category: { costBasis: 'per_guest', plannedAmount: 40000, unitPrice: null, childPrice: null },
    counts: { adults: 3, children: 1, tables: 0 },
    planned: 40000,
  },
  {
    name: 'agorot are rounded to two decimals',
    category: { costBasis: 'per_adult', plannedAmount: 0, unitPrice: 33.33, childPrice: 16.67 },
    counts: { adults: 7, children: 3, tables: 0 },
    planned: 283.32,
  },
];

export interface AmountCase {
  name: string;
  item: { estimate: number | null; quoted: number | null; final: number | null; vatIncluded: boolean | null };
  vatMode: VatMode;
  vatPct: number;
  amount: number;
}

export const AMOUNT_CASES: AmountCase[] = [
  {
    name: 'the final price wins',
    item: { estimate: 100, quoted: 90, final: 80, vatIncluded: null },
    vatMode: 'included',
    vatPct: 18,
    amount: 80,
  },
  {
    name: 'then the quote',
    item: { estimate: 100, quoted: 90, final: null, vatIncluded: null },
    vatMode: 'included',
    vatPct: 18,
    amount: 90,
  },
  {
    name: 'then the estimate, with VAT added when the plan is without it',
    item: { estimate: 100, quoted: null, final: null, vatIncluded: null },
    vatMode: 'excluded',
    vatPct: 18,
    amount: 118,
  },
  {
    name: 'an item marked as with VAT is not charged it again',
    item: { estimate: 100, quoted: null, final: null, vatIncluded: true },
    vatMode: 'excluded',
    vatPct: 18,
    amount: 100,
  },
  {
    name: 'an item marked as without VAT is shown with it',
    item: { estimate: 3000, quoted: null, final: null, vatIncluded: false },
    vatMode: 'included',
    vatPct: 18,
    amount: 3540,
  },
  {
    name: 'no VAT at all: amounts as entered',
    item: { estimate: 3000, quoted: null, final: null, vatIncluded: false },
    vatMode: 'none',
    vatPct: 18,
    amount: 3000,
  },
  {
    name: 'nothing entered is zero',
    item: { estimate: null, quoted: null, final: null, vatIncluded: null },
    vatMode: 'excluded',
    vatPct: 18,
    amount: 0,
  },
  {
    name: 'rounded to the agora',
    item: { estimate: 33.33, quoted: null, final: null, vatIncluded: null },
    vatMode: 'excluded',
    vatPct: 18,
    amount: 39.33,
  },
];

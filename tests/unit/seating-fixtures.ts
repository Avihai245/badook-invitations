import { rng, type SolverInput, type SolverTable, type SolverUnit } from '@/features/seating/solver';

/**
 * A wedding-sized seating problem for the solver tests: `guests` people in families of 1–6, `tables`
 * round tables of 10–12, five categories, some wishes, rules and accessible guests — generated from a
 * seed, so every test sees the same event.
 */
export function wedding({
  guests = 400,
  tables = 40,
  seed = 7,
  rules = 12,
}: { guests?: number; tables?: number; seed?: number; rules?: number } = {}): SolverInput {
  const random = rng(seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
  const categories = ['צד החתן', 'צד הכלה', 'עבודה', 'צבא', 'חברים'];
  const units: SolverUnit[] = [];
  let people = 0;
  for (let i = 0; people < guests; i++) {
    const seats = Math.min(guests - people, pick([1, 2, 2, 2, 3, 4, 4, 5, 6]));
    people += seats;
    units.push({
      id: `u${i}`,
      seats,
      category: random() < 0.9 ? pick(categories) : null,
      prefs: {
        stage: random() < 0.1 ? 1 : 0,
        dance: random() < 0.1 ? (random() < 0.5 ? 1 : -1) : 0,
        exit: random() < 0.05 ? 1 : 0,
      },
      accessible: random() < 0.02,
    });
  }
  const list: SolverTable[] = Array.from({ length: tables }, (_, i) => ({
    id: `t${i + 1}`,
    capacity: i % 3 === 0 ? 12 : 10,
    locked: false,
    accessible: i % 8 === 0,
    prox: {
      stage: i < 6 ? 1 : random() * 0.5,
      dance: i >= 6 && i < 12 ? 1 : random() * 0.5,
      exit: i >= 34 ? 1 : 0,
    },
  }));
  const ruleList: SolverInput['rules'] = [];
  for (let i = 0; i < rules; i++) {
    const a = pick(units).id;
    const b = pick(units).id;
    if (a !== b) ruleList.push({ kind: random() < 0.5 ? 'together' : 'apart', a, b, hard: random() < 0.6 });
  }
  return {
    tables: list,
    units,
    rules: ruleList,
    fixed: {},
    options: { categories: 'group', minFill: 0.6, seed },
  };
}

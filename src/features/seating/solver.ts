import type { CategoryMode, Pref } from './model';

/**
 * The automatic seating (feature `seating_auto`): seats every unit — a family or a party, always whole —
 * at the tables by the host's rules. Pure and deterministic for a given seed (no clock, no Math.random),
 * so the browser runs it in a Web Worker (solver.worker.ts) and the tests replay it exactly
 * (tests/unit/seating-solver.test.ts).
 *
 * What is never broken, by construction:
 *   · a table never gets more people than seats;
 *   · a unit is never split between tables;
 *   · a locked table keeps exactly who sits there, and nobody joins it;
 *   · a unit that needs an accessible table sits only at one (or stays without a seat, reported).
 *
 * Everything else is weighed by one explicit cost — the sum below; lower is better, 0 is perfect — and
 * minimized by simulated annealing (random moves of a unit to another table and swaps of two units,
 * accepting a worse arrangement now and then while the "temperature" is high, less and less as it
 * cools), from a greedy start, a few times from different starts; the best arrangement wins.
 *
 *   cost = 1000 × every person without a seat
 *        +  500 × every hard rule broken (together at different tables, or apart at the same one)
 *        +   40 × every soft rule broken
 *        +   12 × every wish about the stage / dance floor / exit, by how far it is from met
 *               (near: 1 − proximity of the table; far: its proximity — proximity 0–1, geometry.ts)
 *        +    6 × every person out of place by category: with "group", the people who aren't of their
 *               table's main category; with "mix", the people of one category beyond half the table
 *        +   10 × every seat missing for a table with anyone at it to be `minFill` full (balance: no
 *               table of 2 next to a table of 12)
 *
 * Hard "together" rules join units into one block that moves as a whole (when the block fits a table;
 * a block bigger than any table is split and reported). A seat for everyone weighs more than a hard
 * rule: when both can't be had, people are seated and the broken rule is reported.
 */

export interface SolverTable {
  id: string;
  capacity: number;
  locked: boolean;
  /** reachable in a wheelchair */
  accessible: boolean;
  /** how near it is to the stage, the dance floor and an exit, 0–1 each */
  prox: { stage: number; dance: number; exit: number };
}

export interface SolverUnit {
  id: string;
  seats: number;
  category: string | null;
  prefs: { stage: Pref; dance: Pref; exit: Pref };
  accessible: boolean;
}

export interface SolverRule {
  kind: 'together' | 'apart';
  a: string;
  b: string;
  hard: boolean;
}

export interface SolverWeights {
  unseated: number;
  hard: number;
  soft: number;
  preference: number;
  category: number;
  fill: number;
}

export const WEIGHTS: SolverWeights = {
  unseated: 1000,
  hard: 500,
  soft: 40,
  preference: 12,
  category: 6,
  fill: 10,
};

export interface SolverOptions {
  categories: CategoryMode;
  /** a table with anyone at it should be at least this full, 0–1 */
  minFill: number;
  seed: number;
  /** more or less work than the default (1) — the tests use less */
  effort?: number;
  /** a safety net for slow devices: stop after this long (then the result depends on the device) */
  maxMs?: number;
  weights?: Partial<SolverWeights>;
}

export interface SolverInput {
  tables: SolverTable[];
  /** everyone to seat — those at locked tables too (they stay there) */
  units: SolverUnit[];
  rules: SolverRule[];
  /** unit id → the locked table it sits at */
  fixed: Record<string, string>;
  options: SolverOptions;
}

export type SolverIssue =
  /** units left without a seat, and why: not enough room / no accessible table / bigger than any table */
  | { code: 'unseated'; unit: string; seats: number; reason: 'room' | 'accessible' | 'too_big' }
  /** a rule the arrangement breaks (`locked`: the other one sits at a locked table) */
  | { code: 'rule'; kind: 'together' | 'apart'; hard: boolean; a: string; b: string; locked?: string }
  /** hard rules that contradict each other (together through a chain, and apart) */
  | { code: 'conflict'; units: string[] }
  /** units that must sit together but are more people than any table seats */
  | { code: 'too_big_together'; units: string[]; seats: number }
  /** a table with people at it, below the minimum fill */
  | { code: 'underfilled'; table: string; seated: number; capacity: number }
  /** "group": a table where categories sit together; "mix": a table that is mostly one category */
  | { code: 'mixed'; table: string; categories: string[] }
  | { code: 'unmixed'; table: string; category: string }
  /** units whose wish about a zone isn't met */
  | { code: 'preference'; zone: 'stage' | 'dance' | 'exit'; near: boolean; units: string[] };

export interface SolverResult {
  /** unit id → table id, or null: no seat */
  assignment: Record<string, string | null>;
  /** the cost above, rounded (lower is better; 0 is perfect) */
  score: number;
  breakdown: Record<'unseated' | 'rules' | 'preferences' | 'categories' | 'fill', number>;
  issues: SolverIssue[];
  seated: number;
  unseated: number;
  iterations: number;
}

export type SolverProgress = { restart: number; restarts: number; best: number };

/** A small, fast seeded random generator (mulberry32): the same seed, the same run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONE_KEYS = ['stage', 'dance', 'exit'] as const;

/**
 * Seats everyone (see the top of this file). `onProgress` is called after each restart (the worker
 * forwards it to the screen).
 */
export function solve(input: SolverInput, onProgress?: (p: SolverProgress) => void): SolverResult {
  const W: SolverWeights = { ...WEIGHTS, ...input.options.weights };
  const minFill = Math.min(1, Math.max(0, input.options.minFill));
  const mode = input.options.categories;
  const clock = typeof performance !== 'undefined' ? () => performance.now() : () => 0;
  const deadline = input.options.maxMs ? clock() + input.options.maxMs : Infinity;

  // ── indexes ──
  const T = input.tables.length;
  const tableIndex = new Map(input.tables.map((t, i) => [t.id, i]));
  const cap = Int32Array.from(input.tables, (t) => Math.max(0, t.capacity));
  const lockedT = Uint8Array.from(input.tables, (t) => (t.locked ? 1 : 0));
  const accessT = Uint8Array.from(input.tables, (t) => (t.accessible ? 1 : 0));
  const prox = new Float64Array(T * 3);
  input.tables.forEach((t, i) =>
    ZONE_KEYS.forEach((z, k) => (prox[i * 3 + k] = Math.min(1, Math.max(0, t.prox[z])))),
  );

  const units = input.units.filter((u) => u.seats > 0);
  const U = units.length;
  const unitIndex = new Map(units.map((u, i) => [u.id, i]));
  const seats = Int32Array.from(units, (u) => u.seats);
  const categories = [...new Set(units.map((u) => u.category).filter((c): c is string => !!c))].sort();
  const C = categories.length;
  const catOf = Int32Array.from(units, (u) => (u.category ? categories.indexOf(u.category) : -1));
  const pref = new Int8Array(U * 3);
  units.forEach((u, i) => ZONE_KEYS.forEach((z, k) => (pref[i * 3 + k] = u.prefs[z])));
  const accessU = Uint8Array.from(units, (u) => (u.accessible ? 1 : 0));

  // the rules between units that are here (a rule about someone without a seat to take is dropped)
  const rules = input.rules.filter((r) => unitIndex.has(r.a) && unitIndex.has(r.b) && r.a !== r.b);
  const R = rules.length;
  const ra = Int32Array.from(rules, (r) => unitIndex.get(r.a)!);
  const rb = Int32Array.from(rules, (r) => unitIndex.get(r.b)!);
  const rApart = Uint8Array.from(rules, (r) => (r.kind === 'apart' ? 1 : 0));
  const rWeight = Float64Array.from(rules, (r) => (r.hard ? W.hard : W.soft));

  // units at locked tables stay where they are
  const fixedTable = new Int32Array(U).fill(-1);
  for (const [unitId, tableId] of Object.entries(input.fixed)) {
    const u = unitIndex.get(unitId);
    const t = tableIndex.get(tableId);
    if (u !== undefined && t !== undefined && lockedT[t]) fixedTable[u] = t;
  }

  // ── blocks: hard "together" joins units into one block that moves as a whole ──
  const parent = Int32Array.from({ length: U }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]!]!;
    return x;
  };
  const issues: SolverIssue[] = [];
  for (let r = 0; r < R; r++) {
    if (rApart[r] || !rules[r]!.hard) continue;
    const a = ra[r]!;
    const b = rb[r]!;
    // someone at a locked table can't be joined (and doesn't move): reported, not merged
    if (fixedTable[a]! >= 0 || fixedTable[b]! >= 0) continue;
    parent[find(a)] = find(b);
  }
  const maxOpenCapacity = input.tables.reduce((m, t) => (t.locked ? m : Math.max(m, t.capacity)), 0);
  const maxAccessibleCapacity = input.tables.reduce(
    (m, t) => (t.locked || !t.accessible ? m : Math.max(m, t.capacity)),
    0,
  );
  const groups = new Map<number, number[]>();
  for (let u = 0; u < U; u++) {
    if (fixedTable[u]! >= 0) continue;
    const root = find(u);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(u);
  }
  const blockList: number[][] = [];
  for (const members of groups.values()) {
    const total = members.reduce((n, u) => n + seats[u]!, 0);
    const needsAccess = members.some((u) => accessU[u]);
    const room = needsAccess ? maxAccessibleCapacity : maxOpenCapacity;
    if (members.length > 1 && total > room) {
      // together they're more people than any table seats: each moves on its own
      issues.push({ code: 'too_big_together', units: members.map((u) => units[u]!.id), seats: total });
      for (const u of members) blockList.push([u]);
    } else blockList.push(members);
  }
  // fixed units form blocks too (never moved)
  for (let u = 0; u < U; u++) if (fixedTable[u]! >= 0) blockList.push([u]);
  const B = blockList.length;
  const blockOf = new Int32Array(U);
  const blockSeats = new Int32Array(B);
  const blockAccess = new Uint8Array(B);
  const blockFixed = new Int32Array(B).fill(-1);
  blockList.forEach((members, b) => {
    for (const u of members) {
      blockOf[u] = b;
      blockSeats[b] = blockSeats[b]! + seats[u]!;
      if (accessU[u]) blockAccess[b] = 1;
    }
    if (members.length === 1 && fixedTable[members[0]!]! >= 0) blockFixed[b] = fixedTable[members[0]!]!;
  });
  // hard rules that contradict each other: an "apart" inside a block
  for (let r = 0; r < R; r++) {
    if (!rApart[r] || !rules[r]!.hard) continue;
    if (blockOf[ra[r]!] === blockOf[rb[r]!] && blockList[blockOf[ra[r]!]!]!.length > 1)
      issues.push({ code: 'conflict', units: blockList[blockOf[ra[r]!]!]!.map((u) => units[u]!.id) });
  }
  // the rules that can change with a move: those between two blocks
  const blockRules: number[][] = Array.from({ length: B }, () => []);
  for (let r = 0; r < R; r++) {
    const x = blockOf[ra[r]!]!;
    const y = blockOf[rb[r]!]!;
    if (x === y) continue;
    blockRules[x]!.push(r);
    blockRules[y]!.push(r);
  }
  const movable = [...Array(B).keys()].filter((b) => blockFixed[b]! < 0);

  // ── state ──
  const tableOf = new Int32Array(B).fill(-1);
  const occ = new Int32Array(T);
  const catCount = new Int32Array(Math.max(1, T * C));
  const catPeople = new Int32Array(T);

  const place = (b: number, t: number, sign: 1 | -1) => {
    occ[t] = occ[t]! + sign * blockSeats[b]!;
    for (const u of blockList[b]!) {
      const c = catOf[u]!;
      if (c >= 0) {
        catCount[t * C + c] = catCount[t * C + c]! + sign * seats[u]!;
        catPeople[t] = catPeople[t]! + sign * seats[u]!;
      }
    }
  };
  const moveBlock = (b: number, to: number) => {
    const from = tableOf[b]!;
    if (from >= 0) place(b, from, -1);
    if (to >= 0) place(b, to, 1);
    tableOf[b] = to;
  };
  const eligible = (b: number, t: number) => !lockedT[t] && (!blockAccess[b] || accessT[t] === 1);

  // ── costs ──
  const tableCost = (t: number): number => {
    if (t < 0) return 0;
    const o = occ[t]!;
    if (o === 0) return 0;
    let cost = 0;
    const want = minFill * cap[t]!;
    if (o < want) cost += W.fill * (want - o);
    if (catPeople[t]! > 0 && (mode === 'group' || (mode === 'mix' && C > 1))) {
      let max = 0;
      for (let c = 0, base = t * C; c < C; c++) if (catCount[base + c]! > max) max = catCount[base + c]!;
      if (mode === 'group') cost += W.category * (catPeople[t]! - max);
      else cost += W.category * Math.max(0, max - Math.ceil(o / 2));
    }
    return cost;
  };
  const unitCost = (u: number, t: number): number => {
    if (t < 0) return W.unseated * seats[u]!;
    let cost = 0;
    for (let k = 0; k < 3; k++) {
      const p = pref[u * 3 + k]!;
      if (p > 0) cost += W.preference * (1 - prox[t * 3 + k]!);
      else if (p < 0) cost += W.preference * prox[t * 3 + k]!;
    }
    return cost;
  };
  const tableOfUnit = (u: number) => tableOf[blockOf[u]!]!;
  const ruleCost = (r: number): number => {
    const x = tableOfUnit(ra[r]!);
    const y = tableOfUnit(rb[r]!);
    const together = x >= 0 && x === y;
    return (rApart[r] ? together : !together) ? rWeight[r]! : 0;
  };
  const blockUnitsCost = (b: number) => {
    const t = tableOf[b]!;
    let cost = 0;
    for (const u of blockList[b]!) cost += unitCost(u, t);
    return cost;
  };
  let stamp = 1;
  const ruleStamp = new Int32Array(R);
  const rulesCost = (b1: number, b2: number) => {
    stamp++;
    let cost = 0;
    for (const r of blockRules[b1]!) {
      ruleStamp[r] = stamp;
      cost += ruleCost(r);
    }
    if (b2 >= 0)
      for (const r of blockRules[b2]!) {
        if (ruleStamp[r] === stamp) continue;
        cost += ruleCost(r);
      }
    return cost;
  };
  const totalCost = () => {
    let cost = 0;
    for (let t = 0; t < T; t++) cost += tableCost(t);
    for (let u = 0; u < U; u++) cost += unitCost(u, tableOfUnit(u));
    for (let r = 0; r < R; r++) cost += ruleCost(r);
    return cost;
  };
  /** the cost of what a move of b1 (and b2) touches: their tables, their units, their rules */
  const localCost = (b1: number, b2: number, t1: number, t2: number) =>
    tableCost(t1) +
    (t2 !== t1 ? tableCost(t2) : 0) +
    blockUnitsCost(b1) +
    (b2 >= 0 ? blockUnitsCost(b2) : 0) +
    rulesCost(b1, b2);

  /** Moves b to table t; returns the change in cost (the move stays done). */
  const relocate = (b: number, t: number): number => {
    const from = tableOf[b]!;
    const before = localCost(b, -1, from, t);
    moveBlock(b, t);
    return localCost(b, -1, from, t) - before;
  };
  const exchange = (b1: number, b2: number) => {
    const t1 = tableOf[b1]!;
    const t2 = tableOf[b2]!;
    moveBlock(b1, -1);
    moveBlock(b2, t1);
    moveBlock(b1, t2);
  };
  /** Swaps the tables of b1 and b2; returns the change in cost (the swap stays done). */
  const swap = (b1: number, b2: number): number => {
    const t1 = tableOf[b1]!;
    const t2 = tableOf[b2]!;
    const before = localCost(b1, b2, t1, t2);
    exchange(b1, b2);
    return localCost(b1, b2, t1, t2) - before;
  };
  const fitsSwap = (b1: number, b2: number) => {
    const t1 = tableOf[b1]!;
    const t2 = tableOf[b2]!;
    if (t1 === t2) return false;
    if (t1 >= 0 && (!eligible(b2, t1) || occ[t1]! - blockSeats[b1]! + blockSeats[b2]! > cap[t1]!))
      return false;
    if (t2 >= 0 && (!eligible(b1, t2) || occ[t2]! - blockSeats[b2]! + blockSeats[b1]! > cap[t2]!))
      return false;
    return true;
  };

  // ── the search ──
  const effort = Math.max(0.05, input.options.effort ?? 1);
  const restarts = movable.length <= 1 ? 1 : 3;
  // about 50 tries per unit and table (400 guests at 40 tables: ~0.3 s on a laptop, ~1.5 s on a phone)
  const perRestart = Math.round(
    Math.min(400_000, Math.max(20_000, movable.length * Math.max(T, 1) * 50)) * effort,
  );
  let best: Int32Array | null = null;
  let bestCost = Infinity;
  let iterations = 0;

  for (let restart = 0; restart < restarts; restart++) {
    const random = rng((Math.imul(input.options.seed ^ 0x9e3779b9, 0x85ebca6b) + restart * 0x27d4eb2f) >>> 0);
    const pick = (n: number) => Math.floor(random() * n);
    // reset: fixed blocks at their tables, the rest without a seat
    tableOf.fill(-1);
    occ.fill(0);
    catCount.fill(0);
    catPeople.fill(0);
    for (let b = 0; b < B; b++) if (blockFixed[b]! >= 0) moveBlock(b, blockFixed[b]!);

    // greedy start: the hardest to place first (accessible, then the biggest), each where it costs least
    const order = movable
      .map((b) => ({
        b,
        key: blockAccess[b]! * 1e6 + blockSeats[b]! * 1e3 + blockRules[b]!.length + random(),
      }))
      .sort((x, y) => y.key - x.key)
      .map((x) => x.b);
    // ties go to a table picked by the seed (Fisher–Yates)
    const tableOrder = [...Array(T).keys()];
    for (let i = T - 1; i > 0; i--) {
      const j = pick(i + 1);
      [tableOrder[i], tableOrder[j]] = [tableOrder[j]!, tableOrder[i]!];
    }
    for (const b of order) {
      let bestT = -1;
      let bestDelta = Infinity;
      for (const t of tableOrder) {
        if (!eligible(b, t) || occ[t]! + blockSeats[b]! > cap[t]!) continue;
        const d = relocate(b, t);
        moveBlock(b, -1);
        if (d < bestDelta) {
          bestDelta = d;
          bestT = t;
        }
      }
      if (bestT >= 0) moveBlock(b, bestT);
    }

    // annealing
    let cost = totalCost();
    if (cost < bestCost) {
      bestCost = cost;
      best = Int32Array.from(tableOf);
    }
    const T0 = 40;
    const T1 = 0.2;
    const cool = Math.pow(T1 / T0, 1 / Math.max(1, perRestart));
    let temperature = T0;
    const M = movable.length;
    if (M > 0 && T > 0) {
      for (let i = 0; i < perRestart; i++, temperature *= cool) {
        if ((i & 4095) === 0 && clock() > deadline) break;
        iterations++;
        const b1 = movable[pick(M)]!;
        const roll = random();
        let delta: number;
        let undo: () => void;
        if (roll < 0.55) {
          // a unit (block) to another table with room
          const t = pick(T);
          if (t === tableOf[b1] || !eligible(b1, t) || occ[t]! + blockSeats[b1]! > cap[t]!) continue;
          const from = tableOf[b1]!;
          delta = relocate(b1, t);
          undo = () => moveBlock(b1, from);
        } else {
          // two units (blocks) change places — one of them may be without a seat
          const b2 = movable[pick(M)]!;
          if (b2 === b1 || (tableOf[b1]! < 0 && tableOf[b2]! < 0) || !fitsSwap(b1, b2)) continue;
          delta = swap(b1, b2);
          undo = () => exchange(b1, b2);
        }
        if (delta <= 1e-9 || random() < Math.exp(-delta / temperature)) {
          cost += delta;
          if (cost < bestCost - 1e-9) {
            bestCost = cost;
            best = Int32Array.from(tableOf);
          }
        } else undo();
      }
    }
    onProgress?.({ restart: restart + 1, restarts, best: Math.round(bestCost) });
    if (clock() > deadline) break;
  }

  // ── the best arrangement, and what it can't satisfy ──
  if (best) {
    tableOf.fill(-1);
    occ.fill(0);
    catCount.fill(0);
    catPeople.fill(0);
    best.forEach((t, b) => t >= 0 && moveBlock(b, t));
  }
  const assignment: Record<string, string | null> = {};
  let seatedPeople = 0;
  let unseatedPeople = 0;
  for (let u = 0; u < U; u++) {
    const t = tableOfUnit(u);
    assignment[units[u]!.id] = t >= 0 ? input.tables[t]!.id : null;
    if (t >= 0) seatedPeople += seats[u]!;
    else {
      unseatedPeople += seats[u]!;
      const needsAccess = accessU[u] === 1 || blockAccess[blockOf[u]!] === 1;
      issues.push({
        code: 'unseated',
        unit: units[u]!.id,
        seats: seats[u]!,
        reason:
          seats[u]! > maxOpenCapacity
            ? 'too_big'
            : needsAccess && seats[u]! > maxAccessibleCapacity
              ? 'accessible'
              : 'room',
      });
    }
  }
  let rulesPart = 0;
  for (let r = 0; r < R; r++) {
    const c = ruleCost(r);
    if (!c) continue;
    rulesPart += c;
    const other = fixedTable[ra[r]!]! >= 0 ? ra[r]! : fixedTable[rb[r]!]! >= 0 ? rb[r]! : -1;
    issues.push({
      code: 'rule',
      kind: rApart[r] ? 'apart' : 'together',
      hard: rules[r]!.hard,
      a: rules[r]!.a,
      b: rules[r]!.b,
      ...(!rApart[r] && other >= 0 ? { locked: input.tables[fixedTable[other]!]!.id } : {}),
    });
  }
  let fillPart = 0;
  let categoryPart = 0;
  for (let t = 0; t < T; t++) {
    const o = occ[t]!;
    if (!o) continue;
    const want = minFill * cap[t]!;
    if (o < want) {
      fillPart += W.fill * (want - o);
      if (!lockedT[t])
        issues.push({ code: 'underfilled', table: input.tables[t]!.id, seated: o, capacity: cap[t]! });
    }
    categoryPart += tableCost(t) - (o < want ? W.fill * (want - o) : 0);
    if (!catPeople[t]) continue;
    const present = categories.filter((_, c) => catCount[t * C + c]! > 0);
    if (mode === 'group' && present.length > 1)
      issues.push({ code: 'mixed', table: input.tables[t]!.id, categories: present });
    if (mode === 'mix' && C > 1) {
      let top = 0;
      for (let c = 1; c < C; c++) if (catCount[t * C + c]! > catCount[t * C + top]!) top = c;
      if (catCount[t * C + top]! > Math.ceil(o / 2))
        issues.push({ code: 'unmixed', table: input.tables[t]!.id, category: categories[top]! });
    }
  }
  let prefPart = 0;
  const unmet = new Map<string, string[]>();
  for (let u = 0; u < U; u++) {
    const t = tableOfUnit(u);
    if (t < 0) continue;
    prefPart += unitCost(u, t);
    for (let k = 0; k < 3; k++) {
      const p = pref[u * 3 + k]!;
      const x = prox[t * 3 + k]!;
      if ((p > 0 && x < 0.5) || (p < 0 && x > 0.5)) {
        const key = `${ZONE_KEYS[k]}:${p > 0 ? 'near' : 'far'}`;
        if (!unmet.has(key)) unmet.set(key, []);
        unmet.get(key)!.push(units[u]!.id);
      }
    }
  }
  for (const [key, list] of unmet) {
    const [zone, dir] = key.split(':') as [(typeof ZONE_KEYS)[number], string];
    issues.push({ code: 'preference', zone, near: dir === 'near', units: list });
  }
  const unseatedPart = W.unseated * unseatedPeople;
  return {
    assignment,
    score: Math.round(unseatedPart + rulesPart + prefPart + categoryPart + fillPart),
    breakdown: {
      unseated: Math.round(unseatedPart),
      rules: Math.round(rulesPart),
      preferences: Math.round(prefPart),
      categories: Math.round(categoryPart),
      fill: Math.round(fillPart),
    },
    issues,
    seated: seatedPeople,
    unseated: unseatedPeople,
    iterations,
  };
}

import { describe, expect, it, vi } from 'vitest';
import { NO_OVERRIDES, FEATURES, type FeatureInput } from '@/features/flags/features';
import { readWords, type SeatingDeps } from '@/features/seating/api';
import { DEFAULT_SETTINGS, type Plan, type UnitInfo } from '@/features/seating/model';
import { applyWords, rulePairs, tidyWords, wordsUnits } from '@/features/seating/words';

vi.mock('server-only', () => ({}));

// "Tell us in words who sits with whom" (src/features/seating/words.ts and readWords in api.ts): the
// guest list as the model sees it, its answer made safe, the approved part added to the plan, and the
// route's gates (the feature, the AI, the daily cap).

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const u = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const units: UnitInfo[] = [
  {
    id: u(1),
    guestId: null,
    name: 'משפחת כהן',
    status: 'confirmed',
    seats: 4,
    adults: 4,
    children: 0,
    people: ['רבקה כהן'],
    group: 'משפחה',
  },
  {
    id: u(2),
    guestId: null,
    name: 'יוסי מהצבא',
    status: 'confirmed',
    seats: 2,
    adults: 2,
    children: 0,
    people: [],
    group: 'צבא',
  },
  {
    id: u(3),
    guestId: null,
    name: 'דני מהצבא',
    status: 'pending',
    seats: 1,
    adults: 1,
    children: 0,
    people: [],
    group: 'צבא',
  },
  {
    id: u(4),
    guestId: null,
    name: 'דוד משה',
    status: 'confirmed',
    seats: 2,
    adults: 2,
    children: 0,
    people: [],
    group: null,
  },
  {
    id: u(5),
    guestId: null,
    name: 'דודה רחל',
    status: 'declined',
    seats: 0,
    adults: 0,
    children: 0,
    people: [],
    group: null,
  },
];

const emptyPlan = (): Plan => ({
  layout: {
    background: null,
    metersPerPixel: null,
    source: null,
    venuePlan: null,
    gridM: 0.5,
    landmarks: [],
    settings: DEFAULT_SETTINGS,
  },
  tables: [],
  assignments: {},
  rules: [],
  units: {},
});

describe('the guest list as the model sees it', () => {
  it('short references, names, groups and who is coming — never those who declined', () => {
    const { list, ids } = wordsUnits(emptyPlan(), units);
    expect(list.map((x) => x.ref)).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(list[0]).toEqual({ ref: 'u1', name: 'משפחת כהן', group: 'משפחה', seats: 4, people: ['רבקה כהן'] });
    expect(ids.get('u4')).toBe(u(4));
    expect([...ids.values()]).not.toContain(u(5));
  });

  it('the host’s own category wins over the guest list’s group', () => {
    const plan = emptyPlan();
    plan.units[u(4)] = { category: 'שכנים', prefs: { stage: 0, dance: 0, exit: 0 }, accessible: false };
    expect(wordsUnits(plan, units).list[3]!.group).toBe('שכנים');
  });
});

describe('the model’s answer made safe', () => {
  const { ids } = wordsUnits(emptyPlan(), units);

  it('references become ids; unknown ones, one-unit rules and duplicates are dropped', () => {
    const a = tidyWords(
      {
        rules: [
          { kind: 'together', units: ['u2', 'u3', 'u99'], hard: true },
          { kind: 'together', units: ['u3', 'u2'], hard: false },
          { kind: 'apart', units: ['u1', 'u4'], hard: true },
          { kind: 'apart', units: ['u1'], hard: true },
          { kind: 'sideways', units: ['u1', 'u2'], hard: true },
        ],
        zones: [
          { units: ['u1'], zone: 'stage', near: true },
          { units: ['u4'], zone: 'kitchen', near: true },
        ],
        accessible: ['u1', 'u1', 'nobody'],
        unclear: ['  השכנים מהבניין  ', 7],
      },
      ids,
    )!;
    expect(a.rules).toEqual([
      { kind: 'together', units: [u(2), u(3)], hard: true },
      { kind: 'apart', units: [u(1), u(4)], hard: true },
    ]);
    expect(a.zones).toEqual([{ units: [u(1)], zone: 'stage', near: true }]);
    expect(a.accessible).toEqual([u(1)]);
    expect(a.unclear).toEqual(['השכנים מהבניין']);
  });

  it('nothing usable is nothing', () => {
    expect(tidyWords(null, ids)).toBeNull();
    expect(tidyWords('text', ids)).toBeNull();
    expect(tidyWords({ rules: [{ kind: 'together', units: ['u1'] }] }, ids)).toBeNull();
  });

  it('"together" links each unit to the first; "apart" every pair', () => {
    expect(rulePairs({ kind: 'together', units: ['a', 'b', 'c'], hard: true })).toEqual([
      ['a', 'b'],
      ['a', 'c'],
    ]);
    expect(rulePairs({ kind: 'apart', units: ['a', 'b', 'c'], hard: true })).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });
});

describe('adding the approved rules to the plan', () => {
  it('adds rules (a pair’s latest words win), zone wishes and accessible tables', () => {
    const plan = emptyPlan();
    plan.rules = [{ id: 'old', kind: 'together', a: u(4), b: u(1), hard: false }];
    let n = 0;
    const next = applyWords(
      plan,
      {
        rules: [
          { kind: 'apart', units: [u(1), u(4)], hard: true },
          { kind: 'together', units: [u(2), u(3)], hard: false },
        ],
        zones: [
          { units: [u(1)], zone: 'stage', near: true },
          { units: [u(1)], zone: 'dance', near: false },
        ],
        accessible: [u(4)],
      },
      () => `r${++n}`,
    );
    expect(next.rules).toEqual([
      { id: 'r1', kind: 'apart', a: u(1), b: u(4), hard: true },
      { id: 'r2', kind: 'together', a: u(2), b: u(3), hard: false },
    ]);
    expect(next.units[u(1)]!.prefs).toEqual({ stage: 1, dance: -1, exit: 0 });
    expect(next.units[u(4)]!.accessible).toBe(true);
    // the plan it was given is untouched (undo keeps it)
    expect(plan.rules).toHaveLength(1);
    expect(plan.units).toEqual({});
  });
});

describe('POST …/seating/words', () => {
  const access = (plan: FeatureInput['plan'] = 'pro'): FeatureInput & { ownerId: string } => ({
    plan,
    admin: false,
    overrides: NO_OVERRIDES,
    available: new Set(FEATURES),
    ownerId: OWNER,
  });
  const rawState = {
    layout: {},
    tables: [],
    units: units.map((x) => ({ ...x })),
    assignments: [],
    constraints: [],
    venue: null,
  };
  const deps = (over: Partial<SeatingDeps> = {}): SeatingDeps => ({
    access: async () => access(),
    state: async () => rawState,
    save: async () => null,
    signedUpload: async () => ({ path: '', url: '', token: '' }),
    newId: () => 'x',
    ai: {
      readWords: vi.fn(async () => ({
        status: 'ok' as const,
        json: {
          rules: [{ kind: 'together', units: ['u2', 'u3'], hard: true }],
          zones: [],
          accessible: [],
          unclear: [],
        },
      })),
    },
    ...over,
  });

  it('reads the words against the guest list and answers rules with unit ids', async () => {
    const d = deps();
    const res = await readWords(OWNER, ID, { text: 'החברים מהצבא ביחד' }, d);
    expect(res.status).toBe(200);
    expect(res.body.answer).toMatchObject({ rules: [{ kind: 'together', units: [u(2), u(3)], hard: true }] });
    const call = (d.ai!.readWords as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.text).toBe('החברים מהצבא ביחד');
    expect(call.units.map((x: { ref: string }) => x.ref)).toEqual(['u1', 'u2', 'u3', 'u4']);
  });

  it('only for the host, with the automatic seating, a model and room under the daily cap', async () => {
    expect((await readWords('someone-else', ID, { text: 'abc' }, deps())).status).toBe(404);
    const free = await readWords(
      OWNER,
      ID,
      { text: 'abc def' },
      deps({ access: async () => access('free') }),
    );
    expect(free.status).toBe(403);
    expect(free.body.feature).toBe('seating_auto');
    expect((await readWords(OWNER, ID, { text: 'x' }, deps())).status).toBe(400);
    expect((await readWords(OWNER, ID, { text: 'abc def' }, deps({ ai: null }))).body.code).toBe(
      'ai_unavailable',
    );
    const capped = await readWords(
      OWNER,
      ID,
      { text: 'abc def' },
      deps({
        rateHit: async () => false,
        rateKey: (s, v) => `${s}:${v}`,
        aiLimits: { perAccount: 1, site: 1 },
      }),
    );
    expect(capped.status).toBe(429);
  });

  it('a refusal, a failure and an answer with nothing in it, each its own code', async () => {
    const withAi = (r: Awaited<ReturnType<NonNullable<SeatingDeps['ai']>['readWords']>>) =>
      deps({ ai: { readWords: async () => r } });
    expect((await readWords(OWNER, ID, { text: 'abc def' }, withAi({ status: 'refused' }))).body.code).toBe(
      'refused',
    );
    expect(
      (await readWords(OWNER, ID, { text: 'abc def' }, withAi({ status: 'error', error: 'x' }))).status,
    ).toBe(502);
    expect(
      (await readWords(OWNER, ID, { text: 'abc def' }, withAi({ status: 'ok', json: { rules: [] } }))).body
        .code,
    ).toBe('not_understood');
  });
});

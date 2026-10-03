import { describe, expect, it, vi } from 'vitest';
import { NO_OVERRIDES, FEATURES, type Feature, type FeatureInput } from '@/features/flags/features';
import { categoryPlanned, plannedTotal } from '@/features/planning/model/budget';
import {
  categoryOver,
  categoryRows,
  isOverdue,
  itemAmount,
  itemVariance,
  parseAmount,
  paymentRows,
  statusFromPayments,
  totalOver,
} from '@/features/planning/model/budget-view';
import type { PlanCategory, PlanItem, PlanPayment, RawPlanState } from '@/features/planning/model/plan';
import { BudgetOp } from '@/features/planning/model/schemas-budget';
import {
  budgetOperation,
  budgetSheets,
  todayPayments,
  type BudgetSheetWords,
} from '@/features/planning/server/budget';
import type { PlanningDeps } from '@/features/planning/server/types';
import { planningBudgetEn } from '@/lib/i18n/planning-budget.en';
import { planningEn } from '@/lib/i18n/planning.en';
import { AMOUNT_CASES, PLANNED_CASES } from '../support/planning-budget-cases';

vi.mock('server-only', () => ({}));

const ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const CAT = '44444444-4444-4444-8444-444444444441';
const ITEM = '55555555-5555-4555-8555-555555555551';
const PAY = '66666666-6666-4666-8666-666666666661';

const ALL = new Set<Feature>(FEATURES);
const input = (over: Partial<FeatureInput> = {}): FeatureInput & { ownerId: string } => ({
  ownerId: OWNER,
  plan: 'pro',
  admin: false,
  overrides: NO_OVERRIDES,
  available: ALL,
  ...over,
});

function deps(over: Partial<{ input: ReturnType<typeof input> | null; state: RawPlanState | null }> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const results: Record<string, unknown> = {};
  const d: PlanningDeps & { calls: typeof calls; results: typeof results } = {
    calls,
    results,
    access: async (id) => (id === ID ? (over.input === undefined ? input() : over.input) : null),
    rpc: (async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === 'planning_state') return over.state === undefined ? null : over.state;
      return fn in results ? results[fn] : null;
    }) as PlanningDeps['rpc'],
    summary: async () => null,
    now: () => Date.parse('2026-10-03T09:00:00Z'),
    newId: () => 'new-id',
  };
  return d;
}
const last = (d: ReturnType<typeof deps>, fn: string) => d.calls.filter((c) => c.fn === fn).at(-1)!;

// ─── the formulas ───────────────────────────────────────────────────────────────────────────────

describe('what a category is planned to cost (the mirror of planning_category_planned)', () => {
  // the same cases are asserted against the database's own function in tests/db/planning-budget.test.ts
  for (const k of PLANNED_CASES)
    it(k.name, () => {
      expect(categoryPlanned(k.category, k.counts)).toBe(k.planned);
    });

  it('adds the categories up with agorot rounded once', () => {
    const cats = PLANNED_CASES.map(
      (k, n) =>
        ({ id: String(n), key: null, name: k.name, required: false, sort: n, ...k.category }) as PlanCategory,
    );
    // every case has its own counts: the total is the sum of what each would be at the same counts
    const counts = { adults: 3, children: 1, tables: 2 };
    const sum = cats.reduce((n, c) => n + categoryPlanned(c, counts), 0);
    expect(plannedTotal(cats, counts)).toBe(Math.round(sum * 100) / 100);
  });
});

describe('what an item amounts to (the mirror of planning_item_amount)', () => {
  for (const k of AMOUNT_CASES)
    it(k.name, () => {
      expect(itemAmount(k.item, k.vatMode, k.vatPct)).toBe(k.amount);
    });
});

describe('how an item compares with its estimate', () => {
  const base = { estimate: 1000, quoted: null, final: null, vatIncluded: null };
  it('needs an estimate and a quote or a final price to compare', () => {
    expect(itemVariance(base, 'included', 18)).toBeNull();
    expect(itemVariance({ ...base, estimate: null, final: 900 }, 'included', 18)).toBeNull();
  });
  it('is over when the price is above the estimate, under when below, with VAT on both sides', () => {
    expect(itemVariance({ ...base, quoted: 1200 }, 'included', 18)).toEqual({
      plan: 1000,
      actual: 1200,
      delta: 200,
    });
    expect(itemVariance({ ...base, quoted: 1200, final: 900 }, 'included', 18)).toEqual({
      plan: 1000,
      actual: 900,
      delta: -100,
    });
    expect(itemVariance({ ...base, final: 1000 }, 'excluded', 18)).toEqual({
      plan: 1180,
      actual: 1180,
      delta: 0,
    });
  });
});

describe('what the host types in a money field', () => {
  it('reads numbers with at most two decimals, thousands separators and the shekel sign', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('12500')).toBe(12500);
    expect(parseAmount('12,500')).toBe(12500);
    expect(parseAmount('₪ 1,250.5')).toBe(1250.5);
    expect(parseAmount('0.05')).toBe(0.05);
  });
  it('refuses what is not an amount we can save', () => {
    for (const bad of ['abc', '12.345', '-5', '1e5', '12..5', '99999999999'])
      expect(parseAmount(bad), bad).toBeUndefined();
  });
});

describe('an item follows its payments', () => {
  const p = (paid: boolean) => ({ paidAt: paid ? '2027-01-01T00:00:00Z' : null });
  it('all paid → paid; one open on a paid item → booked; no payments → as it was', () => {
    expect(statusFromPayments('booked', [p(true), p(true)])).toBe('paid');
    expect(statusFromPayments('paid', [p(true), p(false)])).toBe('booked');
    expect(statusFromPayments('quoted', [p(true), p(false)])).toBe('quoted');
    expect(statusFromPayments('paid', [])).toBe('paid');
    expect(statusFromPayments('estimate', [])).toBe('estimate');
  });
});

// ─── the screens' rows ──────────────────────────────────────────────────────────────────────────

const category = (id: string, over: Partial<PlanCategory> = {}): PlanCategory => ({
  id,
  key: 'venue',
  name: null,
  plannedAmount: 1000,
  costBasis: 'fixed',
  unitPrice: null,
  childPrice: null,
  required: false,
  sort: 10,
  ...over,
});
const item = (id: string, categoryId: string, over: Partial<PlanItem> = {}): PlanItem => ({
  id,
  categoryId,
  vendorId: null,
  title: `item ${id}`,
  estimate: null,
  quoted: null,
  final: null,
  status: 'estimate',
  vatIncluded: null,
  attachments: [],
  notes: null,
  sort: 10,
  ...over,
});
const payment = (id: string, itemId: string, over: Partial<PlanPayment> = {}): PlanPayment => ({
  id,
  itemId,
  label: `pay ${id}`,
  amount: 100,
  dueDate: null,
  paidAt: null,
  payOnEventDay: false,
  payer: null,
  ...over,
});
const totals = (over: Partial<RawPlanState['totals']> = {}): RawPlanState['totals'] => ({
  totalBudget: 10000,
  planned: 0,
  expected: 0,
  committed: 0,
  paid: 0,
  unpaid: 0,
  remaining: null,
  perGuest: null,
  byCategory: [],
  ...over,
});

describe('the categories with their items and totals', () => {
  it('orders both by their sort, and gives a category the database has no totals for none', () => {
    const rows = categoryRows({
      categories: [category('b', { sort: 20 }), category('a', { sort: 10 })],
      items: [item('i2', 'a', { sort: 20 }), item('i1', 'a', { sort: 10 }), item('i3', 'b')],
      totals: totals({ byCategory: [{ id: 'a', planned: 5, expected: 6, committed: 7, paid: 8 }] }),
    });
    expect(rows.map((r) => r.category.id)).toEqual(['a', 'b']);
    expect(rows[0]!.items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(rows[0]!.totals).toMatchObject({ planned: 5, paid: 8 });
    expect(rows[1]!.totals).toEqual({ id: 'b', planned: 0, expected: 0, committed: 0, paid: 0 });
  });

  it('flags only what is committed above a plan that exists, and a total that is exceeded', () => {
    const t = (planned: number, committed: number) => ({ id: 'x', planned, expected: 0, committed, paid: 0 });
    expect(categoryOver(t(1000, 1500))).toBe(500);
    expect(categoryOver(t(1000, 1000))).toBe(0);
    expect(categoryOver(t(0, 500))).toBe(0);
    expect(totalOver(12000, 10000)).toBe(2000);
    expect(totalOver(10000, 10000)).toBe(0);
    expect(totalOver(99999, null)).toBe(0);
  });
});

describe('the payment schedule', () => {
  it('is by due date, those without one last, the rest in the order they were made', () => {
    const rows = paymentRows({
      categories: [category(CAT)],
      items: [item('i', CAT)],
      payments: [
        payment('p1', 'i'),
        payment('p2', 'i', { dueDate: '2027-03-01' }),
        payment('p3', 'i', { dueDate: '2027-01-01' }),
        payment('p4', 'i'),
        payment('orphan', 'gone', { dueDate: '2020-01-01' }),
      ],
    });
    expect(rows.map((r) => r.payment.id)).toEqual(['p3', 'p2', 'p1', 'p4']);
    expect(rows[0]!.category?.id).toBe(CAT);
  });

  it('is overdue when it is open and its date has passed', () => {
    expect(isOverdue({ paidAt: null, dueDate: '2026-10-02' }, '2026-10-03')).toBe(true);
    expect(isOverdue({ paidAt: null, dueDate: '2026-10-03' }, '2026-10-03')).toBe(false);
    expect(isOverdue({ paidAt: '2026-09-01T00:00:00Z', dueDate: '2026-08-01' }, '2026-10-03')).toBe(false);
    expect(isOverdue({ paidAt: null, dueDate: null }, '2026-10-03')).toBe(false);
  });
});

// ─── the API ────────────────────────────────────────────────────────────────────────────────────

describe('who may use the budget', () => {
  const body = { op: 'category_delete', ids: [CAT] };
  it('only the owner of an event that has planning', async () => {
    expect((await budgetOperation(OWNER, 'nope', body, deps())).status).toBe(404);
    expect((await budgetOperation(STRANGER, ID, body, deps())).status).toBe(404);
    expect((await budgetOperation(OWNER, ID, body, deps({ input: null }))).status).toBe(404);
    const off = await budgetOperation(
      OWNER,
      ID,
      body,
      deps({ input: input({ overrides: { off: ['planning'], grant: [] } }) }),
    );
    expect(off).toMatchObject({ status: 403, body: { code: 'feature_off', feature: 'planning' } });
  });

  it('is strict: an unknown operation or key, ids that are not ids, nothing to delete', async () => {
    for (const bad of [
      { op: 'nope' },
      { op: 'category_delete' },
      { op: 'category_delete', ids: [] },
      { op: 'category_delete', ids: ['not-an-id'] },
      { op: 'category_delete', ids: [CAT], extra: 1 },
      { op: 'payment_paid', id: PAY },
      { op: 'item_delete', ids: Array.from({ length: 101 }, () => ITEM) },
    ]) {
      const d = deps();
      const res = await budgetOperation(OWNER, ID, bad, d);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(d.calls.some((c) => c.fn.startsWith('planning_') && c.fn !== 'planning_state')).toBe(false);
    }
  });
});

describe('categories', () => {
  it('saves one with the keys given and answers it', async () => {
    const d = deps();
    const saved = { id: CAT, key: 'venue', plannedAmount: 30000 };
    d.results.planning_category_save = saved;
    const res = await budgetOperation(
      OWNER,
      ID,
      {
        op: 'category_save',
        category: { id: CAT, key: 'venue', plannedAmount: 30000, costBasis: 'per_guest', unitPrice: 120.5 },
      },
      d,
    );
    expect(res).toEqual({ status: 200, body: { ok: true, category: saved } });
    expect(last(d, 'planning_category_save').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_category: { id: CAT, key: 'venue', plannedAmount: 30000, costBasis: 'per_guest', unitPrice: 120.5 },
    });
  });

  it('a new one needs a standard key or a name; keys and amounts are checked', async () => {
    const save = (category: unknown) => budgetOperation(OWNER, ID, { op: 'category_save', category }, deps());
    expect((await save({})).status).toBe(400);
    expect((await save({ plannedAmount: 5 })).status).toBe(400);
    expect((await save({ key: 'not_a_category' })).status).toBe(400);
    expect((await save({ name: '   ' })).status).toBe(400);
    expect((await save({ name: 'x'.repeat(81) })).status).toBe(400);
    expect((await save({ name: 'ok', plannedAmount: -1 })).status).toBe(400);
    expect((await save({ name: 'ok', plannedAmount: 1_000_000_001 })).status).toBe(400);
    expect((await save({ name: 'ok', plannedAmount: 10.123 })).status).toBe(400);
    expect((await save({ name: 'ok', unitPrice: 10_000_001 })).status).toBe(400);
    expect((await save({ name: 'ok', costBasis: 'per_dog' })).status).toBe(400);
    expect((await save({ name: 'ok', surprise: true })).status).toBe(400);
    // an existing one may change just a key or two
    const d = deps();
    d.results.planning_category_save = { id: CAT };
    expect(
      (await budgetOperation(OWNER, ID, { op: 'category_save', category: { id: CAT, unitPrice: null } }, d))
        .status,
    ).toBe(200);
  });

  it('passes on the database’s answers: a repeat is 409, too many is 422, not theirs is 404', async () => {
    const run = async (answer: unknown) => {
      const d = deps();
      d.results.planning_category_save = answer;
      return budgetOperation(OWNER, ID, { op: 'category_save', category: { key: 'venue' } }, d);
    };
    expect(await run({ ok: false, code: 'duplicate' })).toMatchObject({
      status: 409,
      body: { code: 'duplicate' },
    });
    expect(await run({ ok: false, code: 'too_many' })).toMatchObject({
      status: 422,
      body: { code: 'too_many' },
    });
    expect(await run({ ok: false, code: 'invalid' })).toMatchObject({ status: 400 });
    expect(await run(null)).toMatchObject({ status: 404 });
  });

  it('deletes by ids and answers how many went', async () => {
    const d = deps();
    d.results.planning_category_delete = 2;
    expect(await budgetOperation(OWNER, ID, { op: 'category_delete', ids: [CAT, ITEM] }, d)).toEqual({
      status: 200,
      body: { ok: true, deleted: 2 },
    });
    expect(last(d, 'planning_category_delete').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_ids: [CAT, ITEM],
    });
    d.results.planning_category_delete = null;
    expect((await budgetOperation(OWNER, ID, { op: 'category_delete', ids: [CAT] }, d)).status).toBe(404);
  });
});

describe('items', () => {
  const saved = { item: { id: ITEM, title: 'צלם' }, payments: [{ id: PAY }] };

  it('the least a quick expense needs is a category, a title and an estimate — or a final price and "booked"', async () => {
    for (const quick of [
      { categoryId: CAT, title: 'צלם', estimate: 5000 },
      { categoryId: CAT, title: 'צלם', final: 4800, status: 'booked' },
    ]) {
      const d = deps();
      d.results.planning_item_save = saved;
      const res = await budgetOperation(OWNER, ID, { op: 'item_save', item: quick }, d);
      expect(res).toEqual({ status: 200, body: { ok: true, item: saved.item, payments: saved.payments } });
      expect(last(d, 'planning_item_save').args).toEqual({
        p_id: ID,
        p_owner: OWNER,
        p_item: quick,
        p_payments: null,
      });
    }
  });

  it('takes the item’s payment schedule along, to replace the one it has', async () => {
    const d = deps();
    d.results.planning_item_save = saved;
    const payments = [
      { label: 'מקדמה', amount: 1000, dueDate: '2027-01-01', payer: 'אבא' },
      { id: PAY, label: 'יתרה', amount: 4000, payOnEventDay: true, paidAt: '2027-06-17T20:00:00Z' },
    ];
    await budgetOperation(OWNER, ID, { op: 'item_save', item: { categoryId: CAT, title: 'x' }, payments }, d);
    expect(last(d, 'planning_item_save').args.p_payments).toEqual(payments);
    // an empty list clears it; the key left out leaves it alone
    await budgetOperation(OWNER, ID, { op: 'item_save', item: { id: ITEM }, payments: [] }, d);
    expect(last(d, 'planning_item_save').args.p_payments).toEqual([]);
  });

  it('a new item needs its category and title; an existing one only the keys it changes', async () => {
    const save = (item: unknown) => budgetOperation(OWNER, ID, { op: 'item_save', item }, deps());
    expect((await save({ title: 'x' })).status).toBe(400);
    expect((await save({ categoryId: CAT })).status).toBe(400);
    expect((await save({ categoryId: 'nope', title: 'x' })).status).toBe(400);
    expect((await save({ categoryId: CAT, title: '' })).status).toBe(400);
    expect((await save({ categoryId: CAT, title: 'x'.repeat(121) })).status).toBe(400);
    expect((await save({ categoryId: CAT, title: 'x', status: 'maybe' })).status).toBe(400);
    expect((await save({ categoryId: CAT, title: 'x', notes: 'n'.repeat(1001) })).status).toBe(400);
    expect((await save({ categoryId: CAT, title: 'x', vendorId: 'nope' })).status).toBe(400);
    expect((await save({ categoryId: CAT, title: 'x', mystery: 1 })).status).toBe(400);
    const d = deps();
    d.results.planning_item_save = saved;
    expect(
      (await budgetOperation(OWNER, ID, { op: 'item_save', item: { id: ITEM, status: 'booked' } }, d)).status,
    ).toBe(200);
  });

  it('amounts are shekels from 0 to a billion with agorot at most, and null clears one', async () => {
    const base = { categoryId: CAT, title: 'x' };
    const run = (extra: Record<string, unknown>, payments?: unknown[]) =>
      budgetOperation(OWNER, ID, { op: 'item_save', item: { ...base, ...extra }, payments }, deps());
    for (const bad of [
      { estimate: -1 },
      { quoted: 1_000_000_001 },
      { final: 1.005 },
      { estimate: '5' },
      { final: NaN },
    ])
      expect((await run(bad)).status, JSON.stringify(bad)).toBe(400);
    expect((await run({ estimate: 1_000_000_000, quoted: 0.01, final: null })).status).not.toBe(400);
    // a payment is for something and on a real date
    for (const bad of [
      { label: 'x', amount: 0 },
      { label: 'x', amount: -5 },
      { label: '', amount: 5 },
      { label: 'x', amount: 5, dueDate: '2027-13-40' },
      { label: 'x', amount: 5, dueDate: 'tomorrow' },
      { label: 'x', amount: 5, paidAt: 'yesterday' },
      { label: 'x'.repeat(61), amount: 5 },
      { label: 'x', amount: 5, payer: 'p'.repeat(61) },
      { label: 'x', amount: 5, itemId: ITEM },
    ])
      expect((await run({}, [bad])).status, JSON.stringify(bad)).toBe(400);
    expect(
      (
        await run(
          {},
          Array.from({ length: 61 }, () => ({ label: 'x', amount: 1 })),
        )
      ).status,
    ).toBe(400);
  });

  it('passes on the database’s answers: a link outside the event is 400, too many is 422, not theirs is 404', async () => {
    const run = async (answer: unknown) => {
      const d = deps();
      d.results.planning_item_save = answer;
      return budgetOperation(OWNER, ID, { op: 'item_save', item: { categoryId: CAT, title: 'x' } }, d);
    };
    expect(await run({ ok: false, code: 'invalid_link' })).toMatchObject({
      status: 400,
      body: { code: 'invalid_link' },
    });
    expect(await run({ ok: false, code: 'too_many' })).toMatchObject({ status: 422 });
    expect(await run(null)).toMatchObject({ status: 404 });
  });

  it('deletes by ids', async () => {
    const d = deps();
    d.results.planning_item_delete = 1;
    expect(await budgetOperation(OWNER, ID, { op: 'item_delete', ids: [ITEM] }, d)).toEqual({
      status: 200,
      body: { ok: true, deleted: 1 },
    });
  });
});

describe('files on an item', () => {
  const file = (path: string) => ({ path, name: 'quote.pdf', size: 1234, type: 'application/pdf' });
  const mine = `${OWNER}/${ID}/0d2f7c1a-1111-4111-8111-111111111111.pdf`;
  const run = (attachments: unknown[], over: Parameters<typeof deps>[0] = {}) => {
    const d = deps(over);
    d.results.planning_item_save = { item: {}, payments: [] };
    return budgetOperation(
      OWNER,
      ID,
      { op: 'item_save', item: { categoryId: CAT, title: 'x', attachments } },
      d,
    ).then((res) => ({ res, d }));
  };

  it('are a paid tool: an event without it is refused, with the package that has it', async () => {
    const { res, d } = await run([file(mine)], { input: input({ plan: 'free' }) });
    expect(res).toMatchObject({
      status: 403,
      body: { code: 'feature_off', feature: 'planning_export', package: 'premium' },
    });
    expect(d.calls.some((c) => c.fn === 'planning_item_save')).toBe(false);
    const ok = await run([file(mine)]);
    expect(ok.res.status).toBe(200);
    expect(last(ok.d, 'planning_item_save').args.p_item).toMatchObject({ attachments: [file(mine)] });
  });

  it('taking them off needs no plan, and an item without any is not asked about it', async () => {
    expect((await run([], { input: input({ plan: 'free' }) })).res.status).toBe(200);
    const d = deps({ input: input({ plan: 'free' }) });
    d.results.planning_item_save = { item: {}, payments: [] };
    expect(
      (await budgetOperation(OWNER, ID, { op: 'item_save', item: { categoryId: CAT, title: 'x' } }, d))
        .status,
    ).toBe(200);
  });

  it('must be under <user>/<event>/ and stay in that folder', async () => {
    for (const path of [
      `${STRANGER}/${ID}/a.pdf`,
      `${OWNER}/${STRANGER}/a.pdf`,
      `${OWNER}/a.pdf`,
      `/${OWNER}/${ID}/a.pdf`,
      `${OWNER}/${ID}/../${STRANGER}/a.pdf`,
      `${OWNER}/${ID}/sub/a.pdf`,
      'a.pdf',
    ]) {
      const { res, d } = await run([file(path)]);
      expect(res.status, path).toBe(400);
      expect(res.body).toMatchObject({ code: 'invalid', fields: ['item.attachments'] });
      expect(d.calls.some((c) => c.fn === 'planning_item_save')).toBe(false);
    }
  });

  it('are PDFs or pictures, up to 10MB, at most twelve', async () => {
    expect((await run([{ ...file(mine), type: 'application/zip' }])).res.status).toBe(400);
    expect((await run([{ ...file(mine), size: 10 * 1024 * 1024 + 1 }])).res.status).toBe(400);
    expect((await run([{ ...file(mine), extra: 1 }])).res.status).toBe(400);
    expect(
      (await run(Array.from({ length: 13 }, (_, n) => file(`${OWNER}/${ID}/${n}.pdf`)))).res.status,
    ).toBe(400);
    expect(
      (await run(Array.from({ length: 12 }, (_, n) => file(`${OWNER}/${ID}/${n}.pdf`)))).res.status,
    ).toBe(200);
  });
});

describe('payments', () => {
  it('saves one on its own: a new one needs its item, a label and an amount', async () => {
    const d = deps();
    d.results.planning_payment_save = { id: PAY };
    const payment = {
      itemId: ITEM,
      label: 'מקדמה',
      amount: 2500.5,
      dueDate: '2027-02-02',
      payOnEventDay: false,
      payer: null,
    };
    expect(await budgetOperation(OWNER, ID, { op: 'payment_save', payment }, d)).toEqual({
      status: 200,
      body: { ok: true, payment: { id: PAY } },
    });
    expect(last(d, 'planning_payment_save').args.p_payment).toEqual(payment);
    const save = (p: unknown) => budgetOperation(OWNER, ID, { op: 'payment_save', payment: p }, deps());
    expect((await save({ label: 'x', amount: 1 })).status).toBe(400);
    expect((await save({ itemId: ITEM, amount: 1 })).status).toBe(400);
    expect((await save({ itemId: ITEM, label: 'x' })).status).toBe(400);
    expect((await save({ itemId: ITEM, label: 'x', amount: 0 })).status).toBe(400);
    // an existing one changes just what is given
    expect(
      (await budgetOperation(OWNER, ID, { op: 'payment_save', payment: { id: PAY, amount: 7 } }, d)).status,
    ).toBe(200);
  });

  it('a link outside the event is 400, not theirs is 404', async () => {
    const run = async (answer: unknown) => {
      const d = deps();
      d.results.planning_payment_save = answer;
      return budgetOperation(
        OWNER,
        ID,
        { op: 'payment_save', payment: { itemId: ITEM, label: 'x', amount: 1 } },
        d,
      );
    };
    expect(await run({ ok: false, code: 'invalid_link' })).toMatchObject({ status: 400 });
    expect(await run(null)).toMatchObject({ status: 404 });
  });

  it('deletes by ids', async () => {
    const d = deps();
    d.results.planning_payment_delete = 3;
    expect(await budgetOperation(OWNER, ID, { op: 'payment_delete', ids: [PAY] }, d)).toEqual({
      status: 200,
      body: { ok: true, deleted: 3 },
    });
  });

  it('marks one paid or not and answers the payment with what became of its item', async () => {
    const d = deps();
    d.results.planning_payment_paid = {
      payment: { id: PAY, paidAt: '2027-01-01T00:00:00Z' },
      itemStatus: 'paid',
    };
    expect(await budgetOperation(OWNER, ID, { op: 'payment_paid', id: PAY, paid: true }, d)).toEqual({
      status: 200,
      body: { ok: true, payment: { id: PAY, paidAt: '2027-01-01T00:00:00Z' }, itemStatus: 'paid' },
    });
    expect(last(d, 'planning_payment_paid').args).toEqual({
      p_id: ID,
      p_owner: OWNER,
      p_payment: PAY,
      p_paid: true,
    });
    d.results.planning_payment_paid = null;
    expect((await budgetOperation(OWNER, ID, { op: 'payment_paid', id: PAY, paid: false }, d)).status).toBe(
      404,
    );
  });
});

describe('the contract other tools rely on', () => {
  it('accepts exactly the operations and shapes that were promised', () => {
    const ok = [
      {
        op: 'category_save',
        category: {
          id: CAT,
          key: 'dj',
          name: 'x',
          plannedAmount: 1,
          costBasis: 'per_table',
          unitPrice: 2,
          childPrice: 3,
          required: true,
          sort: 4,
        },
      },
      { op: 'category_delete', ids: [CAT] },
      {
        op: 'item_save',
        item: {
          id: ITEM,
          categoryId: CAT,
          vendorId: ITEM,
          title: 't',
          estimate: 1,
          quoted: 2,
          final: 3,
          status: 'paid',
          vatIncluded: false,
          attachments: [],
          notes: 'n',
          sort: 5,
        },
        payments: [
          {
            id: PAY,
            label: 'l',
            amount: 1,
            dueDate: '2027-01-01',
            paidAt: '2027-01-01T10:00:00+02:00',
            payOnEventDay: true,
            payer: 'p',
          },
        ],
      },
      { op: 'item_delete', ids: [ITEM] },
      {
        op: 'payment_save',
        payment: {
          id: PAY,
          itemId: ITEM,
          label: 'l',
          amount: 1,
          dueDate: null,
          paidAt: null,
          payOnEventDay: false,
          payer: null,
        },
      },
      { op: 'payment_delete', ids: [PAY] },
      { op: 'payment_paid', id: PAY, paid: false },
    ];
    for (const body of ok) expect(BudgetOp.safeParse(body).success, JSON.stringify(body)).toBe(true);
  });
});

// ─── the event day's payments ───────────────────────────────────────────────────────────────────

describe('the payments of the event day', () => {
  const state = (integrations: object | undefined): RawPlanState =>
    ({
      invitation: {
        id: ID,
        slug: 's',
        status: 'published',
        eventType: 'wedding',
        date: '2026-10-03',
        timezone: null,
        rsvpDeadline: null,
      },
      settings: integrations === undefined ? null : { integrations },
      tasks: [],
      categories: [],
      items: [],
      payments: [],
      vendors: [],
      ideas: [],
    }) as unknown as RawPlanState;
  const rows = [{ id: PAY, label: 'יתרה', amount: 3000, paidAt: null, itemTitle: 'DJ', vendorName: null }];

  it('are listed for the owner when the plan follows the event day', async () => {
    const d = deps({ state: state({ mode: 'full' }) });
    d.results.planning_event_day_payments = rows;
    expect(await todayPayments(OWNER, ID, d)).toEqual(rows);
    expect(last(d, 'planning_event_day_payments').args).toEqual({ p_id: ID, p_owner: OWNER });
  });

  it('are not, without a plan, with the link switched off, for a stranger, or without the planning feature', async () => {
    const withRows = (s: RawPlanState | null, i = input()) => {
      const d = deps({ state: s, input: i });
      d.results.planning_event_day_payments = rows;
      return d;
    };
    expect(await todayPayments(OWNER, ID, withRows(state(undefined)))).toBeNull();
    expect(await todayPayments(OWNER, ID, withRows(null))).toBeNull();
    expect(await todayPayments(OWNER, ID, withRows(state({ mode: 'recommended' })))).toBeNull();
    expect(
      await todayPayments(OWNER, ID, withRows(state({ mode: 'standalone', eventDay: false }))),
    ).toBeNull();
    expect(
      await todayPayments(
        OWNER,
        ID,
        withRows(state({ eventDay: true }), input({ overrides: { off: ['planning'], grant: [] } })),
      ),
    ).toBeNull();
    const d = withRows(state({ mode: 'full' }));
    expect(await todayPayments(STRANGER, ID, d)).toBeNull();
    // nothing was asked of the database for the ones that are not allowed
    expect(d.calls.some((c) => c.fn === 'planning_event_day_payments')).toBe(false);
  });

  it('an event that answers nothing shows nothing', async () => {
    const d = deps({ state: state({ eventDay: true }) });
    d.results.planning_event_day_payments = null;
    expect(await todayPayments(OWNER, ID, d)).toBeNull();
  });
});

// ─── the Excel file ─────────────────────────────────────────────────────────────────────────────

describe('the Excel file', () => {
  const words: BudgetSheetWords = {
    ...planningBudgetEn.excel,
    vatModes: planningBudgetEn.vat.modes,
    statuses: planningBudgetEn.status,
    bases: planningBudgetEn.basis,
    categories: planningEn.categories,
  };
  const raw = {
    settings: { vatMode: 'excluded', vatPct: 18 },
    categories: [
      category('c1', { key: 'catering', costBasis: 'per_adult', unitPrice: 400, childPrice: 200, sort: 20 }),
      category('c2', { key: null, name: 'מתנות', sort: 10, plannedAmount: 500 }),
    ],
    items: [
      item('i1', 'c1', {
        title: 'קייטרינג',
        estimate: 30000,
        final: 28000,
        status: 'booked',
        vendorId: 'v1',
        notes: 'ללא גלוטן',
      }),
      item('i2', 'c2', { title: 'שוקולדים', estimate: 100 }),
    ],
    payments: [
      payment('p1', 'i1', {
        label: 'מקדמה',
        amount: 10000,
        dueDate: '2027-01-01',
        paidAt: '2026-12-30T08:00:00Z',
        payer: 'אבא',
      }),
      payment('p2', 'i1', { label: 'יתרה', amount: 18000, payOnEventDay: true }),
    ],
    vendors: [{ id: 'v1', name: 'שף יוסי' }],
    totals: totals({
      planned: 1900,
      expected: 28118,
      committed: 33040,
      paid: 10000,
      unpaid: 18000,
      remaining: 66960,
      perGuest: 330.4,
      byCategory: [
        { id: 'c1', planned: 1400, expected: 33040, committed: 33040, paid: 10000 },
        { id: 'c2', planned: 500, expected: 118, committed: 0, paid: 0 },
      ],
    }),
    headcount: { adults: 100, children: 0, tables: 10 },
  } as unknown as Parameters<typeof budgetSheets>[0];

  const sheets = budgetSheets(raw, words);
  const by = (name: string) => sheets.find((s) => s.name === name)!;

  it('has the four sheets, each with its header row', () => {
    expect(sheets.map((s) => s.name)).toEqual(['Summary', 'Categories', 'Items', 'Payments']);
    expect(by('Categories').rows[0]).toEqual([
      'Category',
      'How it is counted',
      'Unit price',
      'Price per child',
      'Planned',
      'Expected (all items)',
      'Committed',
      'Paid',
    ]);
    for (const s of sheets) expect(s.widths.length, s.name).toBe(s.rows[0]!.length);
  });

  it('lists the numbers the screen shows, with the VAT and the guest numbers they follow', () => {
    const rows = Object.fromEntries(
      by('Summary')
        .rows.slice(1)
        .map((r) => [r[0], r[1]]),
    );
    expect(rows).toMatchObject({
      'Total budget': 10000,
      Planned: 1900,
      Committed: 33040,
      Paid: 10000,
      'Not paid yet': 18000,
      Left: 66960,
      'Cost per guest': 330.4,
      VAT: 'Before VAT (18%)',
      Adults: 100,
      Tables: 10,
    });
  });

  it('names categories (the system’s by the dictionary, the host’s as typed), in the order of the budget', () => {
    expect(
      by('Categories')
        .rows.slice(1)
        .map((r) => r[0]),
    ).toEqual(['מתנות', 'Catering']);
    expect(by('Categories').rows[2]).toEqual(['Catering', 'Per adult', 400, 200, 1400, 33040, 33040, 10000]);
    expect(by('Categories').rows[1]![1]).toBe('Fixed amount');
  });

  it('has every item with its vendor, stage and the amount with VAT', () => {
    const items = by('Items').rows.slice(1);
    expect(items[0]).toEqual(['מתנות', 'שוקולדים', null, 'Estimate', 100, null, null, 118, null]);
    expect(items[1]).toEqual([
      'Catering',
      'קייטרינג',
      'שף יוסי',
      'Closed',
      30000,
      null,
      28000,
      33040,
      'ללא גלוטן',
    ]);
  });

  it('has the payments by date with when they were paid and which are for the day itself', () => {
    const pays = by('Payments').rows.slice(1);
    expect(pays[0]).toEqual([
      '2027-01-01',
      'קייטרינג',
      'Catering',
      'מקדמה',
      10000,
      '2026-12-30',
      'אבא',
      null,
    ]);
    expect(pays[1]).toEqual(['No date', 'קייטרינג', 'Catering', 'יתרה', 18000, 'Not yet', null, 'Yes']);
    expect(by('Payments').money).toEqual([4]);
  });
});

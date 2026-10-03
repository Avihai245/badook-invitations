import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AMOUNT_CASES, PLANNED_CASES } from '../support/planning-budget-cases';
import { as, createTestDatabase } from './harness';

// Event planning, budget (supabase/migrations/*_planning_budget.sql): categories, items and payments are the
// owner's alone, every link stays inside the event, the caps hold, deleting a category takes its items and
// their payments, a payment marked paid moves its item in the same step, and only the service role may call
// any of it. The formulas are asserted on the same cases as the TypeScript mirror (planning-budget.test.ts).

const OWNER = '88888888-8888-4888-8888-888888888881';
const OTHER = '88888888-8888-4888-8888-888888888882';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let other: string;
let doc: unknown;

// pg sends a JS array as a Postgres array: an array of ids stays one (uuid[]), the rest are jsonb
const wire = (args: unknown[]) =>
  args.map((a) =>
    Array.isArray(a) && !(a.length > 0 && a.every((x) => typeof x === 'string')) ? JSON.stringify(a) : a,
  );
async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return as(
    c,
    'service_role',
    null,
    async () => (await c.query(`select public.${fn}(${params}) as r`, wire(args))).rows[0].r,
  );
}
async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, wire(args))).rows[0].r;
}
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows[0] as T;
const count = async (table: string, id = inv) =>
  Number((await one<{ n: string }>(`select count(*) n from ${table} where invitation_id = $1`, [id])).n);

type Cat = {
  id: string;
  key: string | null;
  name: string | null;
  plannedAmount: number;
  costBasis: string;
  unitPrice: number | null;
  childPrice: number | null;
  required: boolean;
  sort: number;
};
type Item = {
  id: string;
  categoryId: string;
  vendorId: string | null;
  title: string;
  estimate: number | null;
  quoted: number | null;
  final: number | null;
  status: string;
  vatIncluded: boolean | null;
  attachments: unknown[];
  notes: string | null;
  sort: number;
};
type Pay = {
  id: string;
  itemId: string;
  label: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  payOnEventDay: boolean;
  payer: string | null;
};
type Refusal = { ok: false; code: string };
type Saved = { item: Item; payments: Pay[] };
type Totals = { committed: number; paid: number; unpaid: number; remaining: number | null };

const saveCategory = (cat: Record<string, unknown>, id = inv, owner = OWNER) =>
  commit<Cat | Refusal | null>('planning_category_save', [id, owner, cat]);
const saveItem = (
  item: Record<string, unknown>,
  payments: unknown[] | null = null,
  id = inv,
  owner = OWNER,
) => commit<Saved | Refusal | null>('planning_item_save', [id, owner, item, payments]);
const savePayment = (p: Record<string, unknown>, id = inv, owner = OWNER) =>
  commit<Pay | Refusal | null>('planning_payment_save', [id, owner, p]);
const paid = (payment: string, value: boolean, id = inv, owner = OWNER) =>
  commit<{ payment: Pay; itemStatus: string } | null>('planning_payment_paid', [id, owner, payment, value]);
const state = (id = inv, owner = OWNER) =>
  commit<{ categories: Cat[]; items: Item[]; payments: Pay[]; totals: Totals }>('planning_state', [
    id,
    owner,
  ]);
const itemRow = async (id: string) =>
  one<{ status: string }>(`select status from budget_items where id = $1`, [id]);

async function newInvitation(slug: string, owner = OWNER) {
  return (await commit<{ id: string }>('create_invitation', [owner, 'sahar-bordeaux', 'wedding', slug, doc]))
    .id;
}
const settings = {
  templateKey: 'wedding',
  variant: 'default',
  totalBudget: 100000,
  vatMode: 'none',
  vatPct: 18,
  guestBasis: 'manual',
  manualAdults: 100,
  manualChildren: 0,
  integrations: { mode: 'standalone', guests: false, seating: false },
  reminders: {},
  requiredVendors: [],
  onboardingDone: true,
  anchorDate: '2027-06-17',
};

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
       ($1, 'budget-owner@example.com', 'scrypt:x:y', '{}'), ($2, 'budget-other@example.com', 'scrypt:x:y', '{}')`,
    [OWNER, OTHER],
  );
  doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = await newInvitation('budget-db');
  other = await newInvitation('budget-other', OTHER);
  await commit('planning_init', [inv, OWNER, settings, [], []]);
  await commit('planning_init', [other, OTHER, settings, [], []]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('categories', () => {
  let venue: Cat;
  let custom: Cat;

  it('are the owner’s alone, and a standard one is made once per event', async () => {
    expect(await saveCategory({ key: 'venue', plannedAmount: 30000 }, inv, OTHER)).toBeNull();
    expect(await count('budget_categories')).toBe(0);

    venue = (await saveCategory({ key: 'venue', plannedAmount: 30000 })) as Cat;
    expect(venue).toMatchObject({
      key: 'venue',
      name: null,
      plannedAmount: 30000,
      costBasis: 'fixed',
      unitPrice: null,
      required: false,
    });
    expect(venue.sort).toBeGreaterThan(0);
    expect(await saveCategory({ key: 'venue' })).toEqual({ ok: false, code: 'duplicate' });
    expect(await count('budget_categories')).toBe(1);
    // another event has its own
    expect(await saveCategory({ key: 'venue' }, other, OTHER)).toMatchObject({ key: 'venue' });
  });

  it('the host’s own has a name and no key; one with neither is refused', async () => {
    custom = (await saveCategory({ name: 'כיבוד קל', plannedAmount: 1200 })) as Cat;
    expect(custom).toMatchObject({ key: null, name: 'כיבוד קל', plannedAmount: 1200 });
    // a second one with the same kind of name is fine: only the system's are one per event
    expect(await saveCategory({ name: 'כיבוד קל' })).toMatchObject({ key: null });
    expect(await saveCategory({})).toEqual({ ok: false, code: 'invalid' });
    expect(await saveCategory({ id: custom.id, name: null })).toEqual({ ok: false, code: 'invalid' });
  });

  it('changes only the keys given, and clears a price with null', async () => {
    const priced = (await saveCategory({
      id: venue.id,
      costBasis: 'per_guest',
      unitPrice: 120.5,
      childPrice: 60,
      required: true,
    })) as Cat;
    expect(priced).toMatchObject({
      key: 'venue',
      plannedAmount: 30000,
      costBasis: 'per_guest',
      unitPrice: 120.5,
      childPrice: 60,
      required: true,
    });
    const cleared = (await saveCategory({ id: venue.id, unitPrice: null, childPrice: null })) as Cat;
    expect(cleared).toMatchObject({ unitPrice: null, childPrice: null, costBasis: 'per_guest' });
    // renaming into a standard category that exists is a repeat; into a free one it is fine
    expect(await saveCategory({ id: custom.id, key: 'venue' })).toEqual({ ok: false, code: 'duplicate' });
    expect(await saveCategory({ id: venue.id, key: 'venue' })).toMatchObject({ id: venue.id });
  });

  it('an id that is another event’s category is not theirs to take', async () => {
    const theirs = (await saveCategory({ name: 'שלהם' }, other, OTHER)) as Cat;
    expect(await saveCategory({ id: theirs.id, name: 'גנוב' })).toBeNull();
    expect((await state(other, OTHER)).categories.find((x) => x.id === theirs.id)!.name).toBe('שלהם');
  });

  it('puts the same category back with the same id (undo)', async () => {
    const x = (await saveCategory({ key: 'flowers', plannedAmount: 4000, sort: 55 })) as Cat;
    expect(await commit('planning_category_delete', [inv, OWNER, [x.id]])).toBe(1);
    const back = (await saveCategory({ id: x.id, key: 'flowers', plannedAmount: 4000, sort: 55 })) as Cat;
    expect(back).toMatchObject({ id: x.id, key: 'flowers', plannedAmount: 4000, sort: 55 });
  });

  it('refuses a sixty-first', async () => {
    const tmp = await newInvitation('budget-cap-cat');
    await c.query(
      `insert into budget_categories (invitation_id, name) select $1, 'c' || g from generate_series(1, 60) g`,
      [tmp],
    );
    expect(await saveCategory({ name: 'one more' }, tmp)).toEqual({ ok: false, code: 'too_many' });
    // changing one that exists is not adding
    const first = await one<{ id: string }>(
      `select id from budget_categories where invitation_id = $1 limit 1`,
      [tmp],
    );
    expect(await saveCategory({ id: first.id, name: 'renamed' }, tmp)).toMatchObject({ name: 'renamed' });
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('what a category is planned to cost, and what an item amounts to', () => {
  it('the database gives the numbers of every case of the TypeScript mirror', async () => {
    const tmp = await newInvitation('budget-formulas');
    for (const k of PLANNED_CASES) {
      const cat = (await saveCategory(
        {
          name: k.name,
          plannedAmount: k.category.plannedAmount,
          costBasis: k.category.costBasis,
          unitPrice: k.category.unitPrice,
          childPrice: k.category.childPrice,
        },
        tmp,
      )) as Cat;
      const { r } = await one<{ r: string }>(
        `select public.planning_category_planned(c, $2, $3, $4) as r from budget_categories c where id = $1`,
        [cat.id, k.counts.adults, k.counts.children, k.counts.tables],
      );
      expect(Number(r), k.name).toBe(k.planned);
    }
    const holder = (await saveCategory({ name: 'x' }, tmp)) as Cat;
    for (const k of AMOUNT_CASES) {
      const saved = (await saveItem(
        { categoryId: holder.id, title: k.name.slice(0, 100), ...k.item },
        null,
        tmp,
      )) as Saved;
      const { r } = await one<{ r: string }>(
        `select public.planning_item_amount(i, $2, $3) as r from budget_items i where id = $1`,
        [saved.item.id, k.vatMode, k.vatPct],
      );
      expect(Number(r), k.name).toBe(k.amount);
    }
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('items', () => {
  let cat: Cat;
  let otherCat: Cat;

  it('are the owner’s alone, and belong to a category and a vendor of the event', async () => {
    cat = (await saveCategory({ key: 'photographer', plannedAmount: 8000 })) as Cat;
    otherCat = (await saveCategory({ key: 'photographer', plannedAmount: 1 }, other, OTHER)) as Cat;
    const theirVendor = await one<{ id: string }>(
      `insert into plan_vendors (invitation_id, name) values ($1, 'שלהם') returning id`,
      [other],
    );

    expect(await saveItem({ categoryId: cat.id, title: 'x' }, null, inv, OTHER)).toBeNull();
    expect(await saveItem({ categoryId: otherCat.id, title: 'x' })).toEqual({
      ok: false,
      code: 'invalid_link',
    });
    expect(await saveItem({ categoryId: cat.id, title: 'x', vendorId: theirVendor.id })).toEqual({
      ok: false,
      code: 'invalid_link',
    });
    expect(await saveItem({ title: 'no category' })).toEqual({ ok: false, code: 'invalid_link' });
    expect(await saveItem({ categoryId: cat.id })).toEqual({ ok: false, code: 'invalid' });
    expect(await count('budget_items')).toBe(0);
  });

  it('makes one with its own id (undo puts it back) and changes only the keys given', async () => {
    const vendor = await one<{ id: string }>(
      `insert into plan_vendors (invitation_id, name) values ($1, 'סטודיו') returning id`,
      [inv],
    );
    const id = '99999999-9999-4999-8999-999999999991';
    const made = (await saveItem({
      id,
      categoryId: cat.id,
      vendorId: vendor.id,
      title: 'צילום',
      estimate: 8000,
      vatIncluded: false,
      notes: 'הערה',
    })) as Saved;
    expect(made.item).toMatchObject({
      id,
      categoryId: cat.id,
      vendorId: vendor.id,
      title: 'צילום',
      estimate: 8000,
      quoted: null,
      final: null,
      status: 'estimate',
      vatIncluded: false,
      attachments: [],
      notes: 'הערה',
    });
    expect(made.item.sort).toBeGreaterThan(0);
    expect(made.payments).toEqual([]);

    const closed = (await saveItem({ id, status: 'booked', final: 7500, notes: null })) as Saved;
    expect(closed.item).toMatchObject({
      title: 'צילום',
      estimate: 8000,
      final: 7500,
      status: 'booked',
      vendorId: vendor.id,
      vatIncluded: false,
      notes: null,
    });
    // a vendor can be taken off
    expect(((await saveItem({ id, vendorId: null })) as Saved).item.vendorId).toBeNull();

    expect(await commit('planning_item_delete', [inv, OWNER, [id]])).toBe(1);
    const back = (await saveItem({
      id,
      categoryId: cat.id,
      title: 'צילום',
      final: 7500,
      status: 'booked',
    })) as Saved;
    expect(back.item).toMatchObject({ id, final: 7500, status: 'booked' });
  });

  it('an id that is another event’s item is not theirs to take', async () => {
    const theirs = (await saveItem({ categoryId: otherCat.id, title: 'שלהם' }, null, other, OTHER)) as Saved;
    expect(await saveItem({ id: theirs.item.id, title: 'גנוב' })).toBeNull();
    expect((await state(other, OTHER)).items.find((x) => x.id === theirs.item.id)!.title).toBe('שלהם');
  });

  it('moves to another category of the event, not to another event’s', async () => {
    const dj = (await saveCategory({ key: 'dj' })) as Cat;
    const it1 = (await saveItem({ categoryId: cat.id, title: 'נודד' })) as Saved;
    expect(((await saveItem({ id: it1.item.id, categoryId: dj.id })) as Saved).item.categoryId).toBe(dj.id);
    expect(await saveItem({ id: it1.item.id, categoryId: otherCat.id })).toEqual({
      ok: false,
      code: 'invalid_link',
    });
    expect((await state()).items.find((x) => x.id === it1.item.id)!.categoryId).toBe(dj.id);
  });

  it('refuses a six hundred and first', async () => {
    const tmp = await newInvitation('budget-cap-items');
    const holder = (await saveCategory({ name: 'x' }, tmp)) as Cat;
    await c.query(
      `insert into budget_items (invitation_id, category_id, title)
       select $1, $2, 'i' || g from generate_series(1, 600) g`,
      [tmp, holder.id],
    );
    expect(await saveItem({ categoryId: holder.id, title: 'one more' }, null, tmp)).toEqual({
      ok: false,
      code: 'too_many',
    });
    const first = await one<{ id: string }>(`select id from budget_items where invitation_id = $1 limit 1`, [
      tmp,
    ]);
    expect(await saveItem({ id: first.id, title: 'renamed' }, null, tmp)).toMatchObject({
      item: { title: 'renamed' },
    });
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('an item’s payment schedule', () => {
  let cat: Cat;
  beforeAll(async () => {
    cat = (await saveCategory({ key: 'catering', plannedAmount: 40000 })) as Cat;
  });
  const pay = (label: string, amount: number, over: Record<string, unknown> = {}) => ({
    label,
    amount,
    ...over,
  });

  it('is replaced as a whole, with the payments listed kept and the others gone', async () => {
    const made = (await saveItem({ categoryId: cat.id, title: 'אולם', final: 30000, status: 'booked' }, [
      pay('מקדמה', 10000, { dueDate: '2027-01-01', payer: 'אמא' }),
      pay('יתרה', 20000, { dueDate: '2027-06-17', payOnEventDay: true }),
    ])) as Saved;
    expect(
      made.payments.map((p) => [p.label, p.amount, p.dueDate, p.payOnEventDay, p.payer, p.paidAt]),
    ).toEqual([
      ['מקדמה', 10000, '2027-01-01', false, 'אמא', null],
      ['יתרה', 20000, '2027-06-17', true, null, null],
    ]);
    const [deposit, balance] = made.payments as [Pay, Pay];

    // mark the deposit paid, then replace the schedule without saying anything about paidAt: it keeps it
    await paid(deposit.id, true);
    const replaced = (await saveItem({ id: made.item.id }, [
      { id: deposit.id, label: 'מקדמה', amount: 12000 },
      pay('תשלום ביניים', 8000, { dueDate: '2027-03-01' }),
      { id: balance.id, label: 'יתרה', amount: 10000, dueDate: '2027-06-17' },
    ])) as Saved;
    // (by due date: the deposit kept its own)
    expect(replaced.payments.map((p) => [p.label, p.amount, p.dueDate, p.paidAt !== null])).toEqual([
      ['מקדמה', 12000, '2027-01-01', true],
      ['תשלום ביניים', 8000, '2027-03-01', false],
      ['יתרה', 10000, '2027-06-17', false],
    ]);
    expect(replaced.item.status).toBe('booked');

    // a payment that is not listed is gone; an empty array clears the schedule
    const one3 = (await saveItem({ id: made.item.id }, [
      { id: deposit.id, label: 'מקדמה', amount: 12000 },
    ])) as Saved;
    expect(one3.payments).toHaveLength(1);
    expect(((await saveItem({ id: made.item.id }, [])) as Saved).payments).toEqual([]);
    expect(await count('budget_payments')).toBe(0);
    // without p_payments the schedule is left alone
    await saveItem({ id: made.item.id }, [pay('x', 5)]);
    expect(((await saveItem({ id: made.item.id, notes: 'n' })) as Saved).payments).toHaveLength(1);
  });

  it('changes nothing when a payment of the list is another item’s or another event’s', async () => {
    const a = (await saveItem({ categoryId: cat.id, title: 'א' }, [pay('א1', 100)])) as Saved;
    const b = (await saveItem({ categoryId: cat.id, title: 'ב' }, [pay('ב1', 200)])) as Saved;
    const theirCat = (await saveCategory({ name: 'x' }, other, OTHER)) as Cat;
    const theirs = (await saveItem(
      { categoryId: theirCat.id, title: 'שלהם' },
      [pay('ש', 300)],
      other,
      OTHER,
    )) as Saved;

    const before = await count('budget_payments');
    const itemsBefore = await count('budget_items');
    // another item's payment
    expect(
      await saveItem({ id: a.item.id, title: 'א מחדש' }, [
        { id: b.payments[0]!.id, label: 'גנוב', amount: 1 },
      ]),
    ).toEqual({ ok: false, code: 'invalid_link' });
    // another event's payment, on an item that does not exist yet: the item is not made either
    expect(
      await saveItem({ categoryId: cat.id, title: 'חדש' }, [
        { id: theirs.payments[0]!.id, label: 'גנוב', amount: 1 },
      ]),
    ).toEqual({ ok: false, code: 'invalid_link' });
    // the same id twice, a list that is not a list, a row without an amount
    const dup = '99999999-9999-4999-8999-999999999992';
    expect(
      await saveItem({ id: a.item.id }, [
        { id: dup, label: 'a', amount: 1 },
        { id: dup, label: 'b', amount: 2 },
      ]),
    ).toEqual({ ok: false, code: 'invalid' });
    expect(await commit('planning_item_save', [inv, OWNER, { id: a.item.id }, { not: 'a list' }])).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(await saveItem({ id: a.item.id }, [{ label: 'no amount' }])).toEqual({
      ok: false,
      code: 'invalid',
    });

    expect(await count('budget_payments')).toBe(before);
    expect(await count('budget_items')).toBe(itemsBefore);
    expect((await state()).items.find((x) => x.id === a.item.id)!.title).toBe('א');
    expect((await state(other, OTHER)).payments.find((x) => x.id === theirs.payments[0]!.id)!.label).toBe(
      'ש',
    );
  });

  it('refuses more than twelve hundred payments, before anything is written', async () => {
    const tmp = await newInvitation('budget-cap-pay');
    const holder = (await saveCategory({ name: 'x' }, tmp)) as Cat;
    const it1 = (await saveItem({ categoryId: holder.id, title: 'i' }, null, tmp)) as Saved;
    await c.query(
      `insert into budget_payments (invitation_id, item_id, label, amount)
       select $1, $2, 'p' || g, 1 from generate_series(1, 1200) g`,
      [tmp, it1.item.id],
    );
    const other2 = (await saveItem({ categoryId: holder.id, title: 'j' }, null, tmp)) as Saved;
    expect(await savePayment({ itemId: other2.item.id, label: 'one more', amount: 5 }, tmp)).toEqual({
      ok: false,
      code: 'too_many',
    });
    expect(
      await saveItem({ id: other2.item.id, title: 'changed' }, [{ label: 'one more', amount: 5 }], tmp),
    ).toEqual({ ok: false, code: 'too_many' });
    expect(
      (await one<{ title: string }>(`select title from budget_items where id = $1`, [other2.item.id])).title,
    ).toBe('j');
    // replacing the item that holds them all is within the cap
    expect(
      ((await saveItem({ id: it1.item.id }, [{ label: 'only', amount: 5 }], tmp)) as Saved).payments,
    ).toHaveLength(1);
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });

  it('a payment of its own: the owner’s alone, to an item of the event, with an id of its choice', async () => {
    const it1 = (await saveItem({
      categoryId: cat.id,
      title: 'להקה',
      final: 9000,
      status: 'booked',
    })) as Saved;
    const theirCat = (await saveCategory({ name: 'y' }, other, OTHER)) as Cat;
    const theirItem = (await saveItem(
      { categoryId: theirCat.id, title: 'שלהם' },
      null,
      other,
      OTHER,
    )) as Saved;

    expect(await savePayment({ itemId: it1.item.id, label: 'x', amount: 1 }, inv, OTHER)).toBeNull();
    expect(await savePayment({ itemId: theirItem.item.id, label: 'x', amount: 1 })).toEqual({
      ok: false,
      code: 'invalid_link',
    });
    expect(await savePayment({ label: 'x', amount: 1 })).toEqual({ ok: false, code: 'invalid_link' });
    expect(await savePayment({ itemId: it1.item.id, label: 'x' })).toEqual({ ok: false, code: 'invalid' });

    const id = '99999999-9999-4999-8999-999999999993';
    const made = (await savePayment({
      id,
      itemId: it1.item.id,
      label: 'מקדמה',
      amount: 3000,
      dueDate: '2027-02-02',
      payer: 'אבא',
    })) as Pay;
    expect(made).toMatchObject({
      id,
      itemId: it1.item.id,
      label: 'מקדמה',
      amount: 3000,
      dueDate: '2027-02-02',
      payer: 'אבא',
      paidAt: null,
    });
    // only the keys given change
    expect(await savePayment({ id, amount: 3500 })).toMatchObject({
      label: 'מקדמה',
      amount: 3500,
      payer: 'אבא',
    });
    expect(await savePayment({ id, payer: null })).toMatchObject({ payer: null, amount: 3500 });
    // another event's payment id is not theirs to take
    const theirPay = (await savePayment(
      { itemId: theirItem.item.id, label: 'ש', amount: 1 },
      other,
      OTHER,
    )) as Pay;
    expect(await savePayment({ id: theirPay.id, amount: 99 })).toBeNull();
    // delete and put back (undo)
    expect(await commit('planning_payment_delete', [inv, OTHER, [id]])).toBeNull();
    expect(await commit('planning_payment_delete', [inv, OWNER, [id, theirPay.id]])).toBe(1);
    expect(await savePayment({ id, itemId: it1.item.id, label: 'מקדמה', amount: 3500 })).toMatchObject({
      id,
    });
  });
});

describe('paid and unpaid', () => {
  let cat: Cat;
  beforeAll(async () => {
    cat = (await saveCategory({ key: 'band', plannedAmount: 20000 })) as Cat;
  });

  it('marking the last open payment paid makes the item paid, in the same step; un-paying one takes it back', async () => {
    const made = (await saveItem({ categoryId: cat.id, title: 'להקה', final: 20000, status: 'booked' }, [
      { label: 'מקדמה', amount: 5000, dueDate: '2027-01-01' },
      { label: 'יתרה', amount: 15000, dueDate: '2027-06-17' },
    ])) as Saved;
    const [a, b] = made.payments as [Pay, Pay];
    const before = (await state()).totals.paid;

    const first = (await paid(a.id, true))!;
    expect(first.payment.paidAt).not.toBeNull();
    expect(first.itemStatus).toBe('booked');
    expect((await state()).totals.paid).toBe(before + 5000);

    const last = (await paid(b.id, true))!;
    expect(last.itemStatus).toBe('paid');
    expect((await itemRow(made.item.id)).status).toBe('paid');
    // marking it again keeps the first time
    expect((await paid(b.id, true))!.payment.paidAt).toBe(last.payment.paidAt);

    const undone = (await paid(b.id, false))!;
    expect(undone.payment.paidAt).toBeNull();
    expect(undone.itemStatus).toBe('booked');
    expect((await itemRow(made.item.id)).status).toBe('booked');
    expect((await state()).totals.paid).toBe(before + 5000);
  });

  it('is the owner’s alone, and only for the event’s own payments', async () => {
    const theirCat = (await saveCategory({ key: 'band' }, other, OTHER)) as Cat;
    const theirItem = (await saveItem(
      { categoryId: theirCat.id, title: 'ש' },
      [{ label: 'ש1', amount: 10 }],
      other,
      OTHER,
    )) as Saved;
    const mine = (await saveItem({ categoryId: cat.id, title: 'שלי' }, [
      { label: 'ש', amount: 10 },
    ])) as Saved;
    expect(await paid(mine.payments[0]!.id, true, inv, OTHER)).toBeNull();
    expect(await paid(theirItem.payments[0]!.id, true)).toBeNull();
    expect(
      (await state(other, OTHER)).payments.find((x) => x.id === theirItem.payments[0]!.id)!.paidAt,
    ).toBeNull();
    expect(await paid('99999999-9999-4999-8999-999999999999', true)).toBeNull();
  });

  it('adding, deleting and editing payments keeps the item in step; an item without payments keeps its status', async () => {
    const lone = (await saveItem({
      categoryId: cat.id,
      title: 'בלי תשלומים',
      status: 'paid',
      final: 100,
    })) as Saved;
    expect(lone.item.status).toBe('paid');

    const made = (await saveItem({ categoryId: cat.id, title: 'DJ', final: 1000, status: 'booked' }, [
      { label: 'מקדמה', amount: 400 },
      { label: 'יתרה', amount: 600 },
    ])) as Saved;
    const [a, b] = made.payments as [Pay, Pay];
    await paid(a.id, true);
    await paid(b.id, true);
    expect((await itemRow(made.item.id)).status).toBe('paid');
    // a new open payment on a paid item opens it again
    const extra = (await savePayment({ itemId: made.item.id, label: 'תוספת', amount: 50 })) as Pay;
    expect((await itemRow(made.item.id)).status).toBe('booked');
    // and deleting the only open one closes it
    expect(await commit('planning_payment_delete', [inv, OWNER, [extra.id]])).toBe(1);
    expect((await itemRow(made.item.id)).status).toBe('paid');
    // a schedule given whole: all paid → paid; one open → back to booked
    const whole = (await saveItem({ id: made.item.id }, [
      { id: a.id, label: 'מקדמה', amount: 400 },
      { label: 'חדש', amount: 10 },
    ])) as Saved;
    expect(whole.item.status).toBe('booked');
    const closed = (await saveItem({ id: made.item.id }, [
      { label: 'הכול', amount: 1000, paidAt: '2027-01-05T10:00:00Z' },
    ])) as Saved;
    expect(closed.item.status).toBe('paid');
  });

  it('the plan’s totals follow: committed, paid and still to pay', async () => {
    const t = (await state()).totals;
    expect(t.committed).toBeGreaterThan(0);
    expect(t.paid).toBeGreaterThan(0);
    expect(t.unpaid).toBeGreaterThan(0);
    expect(t.remaining).toBe(100000 - t.committed);
  });
});

describe('deleting', () => {
  it('an item takes its payments with it, and only the event’s own go', async () => {
    const cat = (await saveCategory({ key: 'cakes_sweets' })) as Cat;
    const theirCat = (await saveCategory({ key: 'cakes_sweets' }, other, OTHER)) as Cat;
    const mine = (await saveItem({ categoryId: cat.id, title: 'עוגה' }, [
      { label: 'a', amount: 1 },
      { label: 'b', amount: 2 },
    ])) as Saved;
    const theirs = (await saveItem(
      { categoryId: theirCat.id, title: 'ש' },
      [{ label: 'a', amount: 1 }],
      other,
      OTHER,
    )) as Saved;

    expect(await commit('planning_item_delete', [inv, OTHER, [mine.item.id]])).toBeNull();
    expect(await commit('planning_item_delete', [inv, OWNER, [theirs.item.id]])).toBe(0);
    expect(await count('budget_items', other)).toBeGreaterThanOrEqual(1);
    const payBefore = await count('budget_payments');
    expect(await commit('planning_item_delete', [inv, OWNER, [mine.item.id]])).toBe(1);
    expect(await count('budget_payments')).toBe(payBefore - 2);
    expect(
      Number(
        (
          await one<{ n: string }>(`select count(*) n from budget_payments where item_id = $1`, [
            mine.item.id,
          ])
        ).n,
      ),
    ).toBe(0);
  });

  it('a category takes its items and their payments with it, and answers how many categories went', async () => {
    const cat = (await saveCategory({ key: 'transport' })) as Cat;
    const keep = (await saveCategory({ key: 'rental' })) as Cat;
    const a = (await saveItem({ categoryId: cat.id, title: 'אוטובוס' }, [
      { label: 'a', amount: 1 },
    ])) as Saved;
    const b = (await saveItem({ categoryId: cat.id, title: 'מונית' }, [{ label: 'b', amount: 2 }])) as Saved;
    const stays = (await saveItem({ categoryId: keep.id, title: 'כיסאות' }, [
      { label: 'c', amount: 3 },
    ])) as Saved;
    const theirCat = (await saveCategory({ key: 'transport' }, other, OTHER)) as Cat;

    expect(await commit('planning_category_delete', [inv, OTHER, [cat.id]])).toBeNull();
    expect(await commit('planning_category_delete', [inv, OWNER, [theirCat.id]])).toBe(0);
    expect(
      await commit('planning_category_delete', [
        inv,
        OWNER,
        [cat.id, '99999999-9999-4999-8999-999999999998'],
      ]),
    ).toBe(1);
    const s = await state();
    expect(s.categories.some((x) => x.id === cat.id)).toBe(false);
    expect(s.items.some((x) => x.id === a.item.id || x.id === b.item.id)).toBe(false);
    expect(s.payments.some((x) => x.itemId === a.item.id || x.itemId === b.item.id)).toBe(false);
    expect(s.items.some((x) => x.id === stays.item.id)).toBe(true);
    expect(s.payments.some((x) => x.itemId === stays.item.id)).toBe(true);
    // the other event keeps its own
    expect((await state(other, OTHER)).categories.some((x) => x.id === theirCat.id)).toBe(true);
  });

  it('putting a category back with its items and payments (undo) restores the same ids', async () => {
    const cat = (await saveCategory({ key: 'makeup_hair', plannedAmount: 2000 })) as Cat;
    const it1 = (await saveItem({ categoryId: cat.id, title: 'איפור', final: 1500, status: 'booked' }, [
      { label: 'מקדמה', amount: 500, dueDate: '2027-02-01' },
    ])) as Saved;
    expect(await commit('planning_category_delete', [inv, OWNER, [cat.id]])).toBe(1);
    await saveCategory({ id: cat.id, key: 'makeup_hair', plannedAmount: 2000 });
    const back = (await saveItem(
      { id: it1.item.id, categoryId: cat.id, title: 'איפור', final: 1500, status: 'booked' },
      [{ id: it1.payments[0]!.id, label: 'מקדמה', amount: 500, dueDate: '2027-02-01' }],
    )) as Saved;
    expect(back.item.id).toBe(it1.item.id);
    expect(back.payments[0]!.id).toBe(it1.payments[0]!.id);
  });

  it('deleting the invitation deletes the budget', async () => {
    const tmp = await newInvitation('budget-gone');
    await commit('planning_init', [tmp, OWNER, settings, [], []]);
    const cat = (await saveCategory({ name: 'x' }, tmp)) as Cat;
    await saveItem({ categoryId: cat.id, title: 'i' }, [{ label: 'p', amount: 1 }], tmp);
    await c.query(`delete from invitations where id = $1`, [tmp]);
    for (const t of ['budget_categories', 'budget_items', 'budget_payments'])
      expect(await count(t, tmp)).toBe(0);
  });
});

describe('the payments due at the event', () => {
  it('lists those marked for the event day, the open ones first, with the item and its vendor', async () => {
    const tmp = await newInvitation('budget-day');
    const cat = (await saveCategory({ key: 'dj' }, tmp)) as Cat;
    const vendor = await one<{ id: string }>(
      `insert into plan_vendors (invitation_id, name) values ($1, 'DJ רועי') returning id`,
      [tmp],
    );
    const dj = (await saveItem(
      { categoryId: cat.id, vendorId: vendor.id, title: 'תקליטן', final: 4000, status: 'booked' },
      [
        { label: 'מקדמה', amount: 1000, dueDate: '2027-01-01' },
        { label: 'יתרה במזומן', amount: 3000, payOnEventDay: true },
      ],
      tmp,
    )) as Saved;
    const cake = (await saveItem(
      { categoryId: cat.id, title: 'עוגה', final: 800, status: 'booked' },
      [{ label: 'במקום', amount: 800, payOnEventDay: true }],
      tmp,
    )) as Saved;
    await commit('planning_payment_paid', [tmp, OWNER, cake.payments[0]!.id, true]);

    expect(await commit('planning_event_day_payments', [tmp, OTHER])).toBeNull();
    expect(await call('planning_event_day_payments', [inv, OTHER])).toBeNull();
    const rows = (await commit<
      {
        id: string;
        label: string;
        amount: number;
        paidAt: string | null;
        itemTitle: string;
        vendorName: string | null;
      }[]
    >('planning_event_day_payments', [tmp, OWNER]))!;
    expect(rows.map((r) => [r.label, r.amount, r.itemTitle, r.vendorName, r.paidAt !== null])).toEqual([
      ['יתרה במזומן', 3000, 'תקליטן', 'DJ רועי', false],
      ['במקום', 800, 'עוגה', null, true],
    ]);
    expect(rows[0]!.id).toBe(dj.payments.find((p) => p.label === 'יתרה במזומן')!.id);
    // nothing for an event with none
    expect(await commit('planning_event_day_payments', [other, OTHER])).toEqual([]);
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('privileges', () => {
  const CALLS: [string, string][] = [
    [
      'planning_category_save(uuid, uuid, jsonb)',
      `select public.planning_category_save('%I', '%O', '{"name":"x"}')`,
    ],
    [
      'planning_category_delete(uuid, uuid, uuid[])',
      `select public.planning_category_delete('%I', '%O', array[gen_random_uuid()])`,
    ],
    [
      'planning_item_save(uuid, uuid, jsonb, jsonb)',
      `select public.planning_item_save('%I', '%O', '{"title":"x"}')`,
    ],
    [
      'planning_item_delete(uuid, uuid, uuid[])',
      `select public.planning_item_delete('%I', '%O', array[gen_random_uuid()])`,
    ],
    [
      'planning_payment_save(uuid, uuid, jsonb)',
      `select public.planning_payment_save('%I', '%O', '{"label":"x"}')`,
    ],
    [
      'planning_payment_delete(uuid, uuid, uuid[])',
      `select public.planning_payment_delete('%I', '%O', array[gen_random_uuid()])`,
    ],
    [
      'planning_payment_paid(uuid, uuid, uuid, boolean)',
      `select public.planning_payment_paid('%I', '%O', gen_random_uuid(), true)`,
    ],
    ['planning_event_day_payments(uuid, uuid)', `select public.planning_event_day_payments('%I', '%O')`],
    ['planning_item_sync(uuid)', `select public.planning_item_sync(gen_random_uuid())`],
  ];
  const TABLES = ['budget_categories', 'budget_items', 'budget_payments'];

  it('nobody but the service role reads the tables or calls the functions', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const t of TABLES)
        await expect(as(c, role, OWNER, () => c.query(`select * from public.${t}`))).rejects.toThrow(
          /permission denied/,
        );
      for (const [, template] of CALLS) {
        const sql = template.replace('%I', inv).replace('%O', OWNER);
        await expect(as(c, role, OWNER, () => c.query(sql))).rejects.toThrow(/permission denied/);
      }
    }
    // the service role runs them: through a rolled-back call
    expect(await call('planning_event_day_payments', [inv, OWNER])).toEqual(expect.any(Array));
    expect(await call('planning_category_save', [inv, OWNER, { name: 'שירות' }])).toMatchObject({
      name: 'שירות',
    });
  });

  it('every function is security definer with an empty search path, and nobody else has execute on it', async () => {
    const names = CALLS.map(([sig]) => sig.split('(')[0]!);
    const rows = (
      await c.query(
        `select p.proname, p.prosecdef, p.proconfig,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as auth,
                has_function_privilege('service_role', p.oid, 'execute') as service
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = any($1::text[])`,
        [names],
      )
    ).rows as {
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
      anon: boolean;
      auth: boolean;
      service: boolean;
    }[];
    expect(rows.map((r) => r.proname).sort()).toEqual([...names].sort());
    for (const r of rows) {
      expect(r.prosecdef, r.proname).toBe(true);
      expect(r.proconfig, r.proname).toContain('search_path=""');
      expect(r.anon, r.proname).toBe(false);
      expect(r.auth, r.proname).toBe(false);
      if (r.proname !== 'planning_item_sync') expect(r.service, r.proname).toBe(true);
    }
  });
});

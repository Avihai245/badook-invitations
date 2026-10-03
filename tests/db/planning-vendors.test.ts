import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Event planning, vendors (supabase/migrations/*_planning_vendors.sql): the vendors are the owner's
// alone; closing one opens its budget item, payments and tasks in one atomic step (nothing partial when
// a part is refused) and undoing it removes exactly what it made and nothing else; and only the service
// role may call any of it.

const OWNER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';
const V1 = '10000000-0000-4000-8000-000000000001';
const V2 = '10000000-0000-4000-8000-000000000002';
const V3 = '10000000-0000-4000-8000-000000000003';
const UNKNOWN = '99999999-9999-4999-8999-999999999999';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
let other: string;

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
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows as T[];
const count = async (table: string, where = 'true', args: unknown[] = []) =>
  Number((await q<{ n: string }>(`select count(*) as n from public.${table} where ${where}`, args))[0]!.n);

type Vendor = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  status: string;
  quoteAmount: number | null;
  paymentTerms: string | null;
  included: string | null;
  rating: number | null;
  notes: string | null;
  attachments: unknown[];
  sort: number;
};
type Closed = {
  vendor: Vendor;
  previous: { status: string; quoteAmount: number | null };
  created: { categoryId?: string; itemId: string | null; paymentIds: string[]; taskIds: string[] };
};
type Refusal = { ok: false; code: string };
type State = {
  categories: { id: string; key: string | null; plannedAmount: number }[];
  items: {
    id: string;
    categoryId: string;
    vendorId: string | null;
    title: string;
    final: number | null;
    status: string;
  }[];
  payments: {
    id: string;
    itemId: string;
    label: string;
    amount: number;
    dueDate: string | null;
    payOnEventDay: boolean;
  }[];
  tasks: {
    id: string;
    title: string | null;
    vendorId: string | null;
    dueDate: string | null;
    dueIsManual: boolean;
    category: string | null;
    status: string;
  }[];
  vendors: Vendor[];
  totals: { committed: number; expected: number };
};
const state = (id = inv, owner = OWNER) => commit<State | null>('planning_state', [id, owner]);
const save = (vendor: Record<string, unknown>, id = inv, owner = OWNER) =>
  commit<Vendor | Refusal | null>('planning_vendor_save', [id, owner, vendor]);
const close = (vendor: string, plan: unknown, id = inv, owner = OWNER) =>
  commit<Closed | Refusal | null>('planning_vendor_close', [id, owner, vendor, plan]);
const undo = (vendor: string, previous: unknown, created: unknown, id = inv, owner = OWNER) =>
  commit<boolean>('planning_vendor_undo_close', [id, owner, vendor, previous, created]);

const settings = {
  templateKey: 'wedding',
  variant: 'default',
  totalBudget: 100000,
  vatMode: 'none',
  vatPct: 18,
  guestBasis: 'invited',
  integrations: { mode: 'recommended' },
  reminders: { email: true },
  requiredVendors: ['venue', 'catering'],
  onboardingDone: true,
  anchorDate: '2027-06-17',
};
const cat = (key: string, planned: number) => ({
  key,
  name: null,
  plannedAmount: planned,
  costBasis: 'fixed',
  required: false,
});

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
       ($1, 'vendors-owner@example.com', 'scrypt:x:y', '{}'), ($2, 'vendors-other@example.com', 'scrypt:x:y', '{}')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'v-db', doc]))
    .id;
  other = (
    await commit<{ id: string }>('create_invitation', [OTHER, 'sahar-bordeaux', 'wedding', 'v-other', doc])
  ).id;
  for (const [id, owner] of [
    [inv, OWNER],
    [other, OTHER],
  ] as const)
    await commit('planning_init', [id, owner, settings, [], [cat('venue', 30000), cat('catering', 40000)]]);
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('saving and deleting vendors', () => {
  it('is the owner’s alone: a stranger and another event’s id get null and change nothing', async () => {
    expect(await save({ id: V1, name: 'אולם הגן' }, inv, OTHER)).toBeNull();
    expect(await save({ id: V1, name: 'אולם הגן' }, other, OWNER)).toBeNull();
    expect(await count('plan_vendors')).toBe(0);

    const made = (await save({ id: V1, name: 'אולם הגן', category: 'venue' })) as Vendor;
    expect(made).toMatchObject({ id: V1, name: 'אולם הגן', category: 'venue', status: 'idea', sort: 10 });

    // the other owner may not touch it by id, from their own event or from this one
    expect(await save({ id: V1, name: 'חטוף' }, other, OTHER)).toBeNull();
    expect(await save({ id: V1, name: 'חטוף' }, inv, OTHER)).toBeNull();
    expect((await state())!.vendors.map((v) => v.name)).toEqual(['אולם הגן']);
    expect((await state(other, OTHER))!.vendors).toEqual([]);
    expect(await commit('planning_vendor_delete', [inv, OTHER, [V1]])).toBeNull();
    // ids of another event are not deleted through this one
    expect(await commit('planning_vendor_delete', [other, OTHER, [V1]])).toBe(0);
    expect((await state())!.vendors).toHaveLength(1);
  });

  it('a quick add needs only a name; a later save changes only the keys it carries', async () => {
    const quick = (await save({ id: V2, name: '  דנה צילום  ', phone: '+972501234567' })) as Vendor;
    expect(quick).toMatchObject({
      id: V2,
      name: 'דנה צילום',
      phone: '+972501234567',
      category: null,
      status: 'idea',
      quoteAmount: null,
      attachments: [],
      sort: 20,
    });

    const edited = (await save({
      id: V2,
      category: 'photographer',
      status: 'quote',
      quoteAmount: 7500.5,
      paymentTerms: '30% מקדמה, 70% ביום האירוע',
      included: 'שמונה שעות, אלבום',
      rating: 4,
      notes: ' ממליצים ',
      email: 'dana@example.com',
      url: 'https://example.com/dana',
      attachments: [{ path: 'p/a.pdf', name: 'a.pdf', size: 10, type: 'application/pdf' }],
    })) as Vendor;
    expect(edited).toMatchObject({
      name: 'דנה צילום',
      phone: '+972501234567',
      category: 'photographer',
      status: 'quote',
      quoteAmount: 7500.5,
      paymentTerms: '30% מקדמה, 70% ביום האירוע',
      included: 'שמונה שעות, אלבום',
      rating: 4,
      notes: 'ממליצים',
      email: 'dana@example.com',
      url: 'https://example.com/dana',
    });
    expect(edited.attachments).toHaveLength(1);

    // nulls and blanks clear a field; a key that is absent is left alone
    const cleared = (await save({ id: V2, phone: '', rating: null, quoteAmount: null })) as Vendor;
    expect(cleared).toMatchObject({ phone: null, rating: null, quoteAmount: null, category: 'photographer' });
    expect(cleared.included).toBe('שמונה שעות, אלבום');
  });

  it('refuses what is not a vendor: no name, a made-up status, a rating out of range, a long text', async () => {
    expect(await save({ id: UNKNOWN })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ name: '   ' })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ id: V2, name: '' })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ id: V2, status: 'maybe' })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ id: V2, rating: 9 })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ id: V2, category: 'Not A Key' })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ id: V2, notes: 'x'.repeat(2001) })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ name: 'x'.repeat(121) })).toEqual({ ok: false, code: 'invalid' });
    expect((await state())!.vendors.map((v) => v.name)).toEqual(['אולם הגן', 'דנה צילום']);
  });

  it('puts a deleted vendor back with the same id (Undo), and clears the links that pointed at it', async () => {
    const GONE = '10000000-0000-4000-8000-0000000000d1';
    await save({ id: GONE, name: 'צלם שלישי', category: 'videographer', status: 'quote', quoteAmount: 2000 });
    const closed = (await close(GONE, {
      item: { categoryKey: 'videographer', title: 'וידאו', amount: 2000 },
      tasks: [{ title: 'לחתום על חוזה', dueDate: '2027-01-10', category: 'videographer' }],
    })) as Closed;
    const before = (await state())!.vendors.find((v) => v.id === GONE)!;
    expect(
      await commit('planning_vendor_delete', [inv, OWNER, [GONE, GONE, UNKNOWN.replace('9', '6')]]),
    ).toBe(1);
    let s = (await state())!;
    expect(s.vendors.some((v) => v.id === GONE)).toBe(false);
    // the item and the task stay, unlinked
    expect(s.items.find((i) => i.id === closed.created.itemId)!.vendorId).toBeNull();
    expect(s.tasks.find((t) => t.id === closed.created.taskIds[0])!.vendorId).toBeNull();

    const back = (await save({ ...before })) as Vendor;
    expect(back).toMatchObject({ id: GONE, name: 'צלם שלישי', status: 'booked', sort: before.sort });
    s = (await state())!;
    expect(s.vendors.filter((v) => v.id === GONE)).toHaveLength(1);

    await commit('planning_vendor_delete', [inv, OWNER, [GONE]]);
    await c.query(`delete from public.budget_items where id = $1`, [closed.created.itemId]);
    await c.query(`delete from public.plan_tasks where id = $1`, [closed.created.taskIds[0]]);
    await c.query(`delete from public.budget_categories where id = $1`, [closed.created.categoryId]);
  });

  it('holds at 300 vendors per event, and the cap is per event', async () => {
    const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
    const tmp = (
      await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'v-cap', doc])
    ).id;
    await c.query(
      `insert into plan_vendors (invitation_id, name, sort)
       select $1, 'ספק ' || g, g from generate_series(1, 300) g`,
      [tmp],
    );
    expect(await save({ name: 'ספק 301' }, tmp)).toEqual({ ok: false, code: 'too_many' });
    // a vendor already there can still be changed
    const first = (
      await q<{ id: string }>(`select id from plan_vendors where invitation_id = $1 limit 1`, [tmp])
    )[0]!;
    expect(await save({ id: first.id, name: 'שונה' }, tmp)).toMatchObject({ name: 'שונה' });
    expect(await save({ name: 'ספק בלי בעיה' })).toMatchObject({ name: 'ספק בלי בעיה' });
    await c.query(`delete from public.plan_vendors where invitation_id = $1 and name = 'ספק בלי בעיה'`, [
      inv,
    ]);
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('closing a vendor', () => {
  it('makes the budget item (booked, final = the amount), its payments and the follow-up tasks, and the category when the event has none', async () => {
    const planned = (await state())!;
    expect(planned.categories.map((x) => x.key)).toEqual(['venue', 'catering']);
    expect(planned.totals.committed).toBe(0);

    const r = (await close(V1, {
      amount: 32000,
      item: { categoryKey: 'venue', title: 'אולם הגן', amount: 32000 },
      payments: [
        { label: 'מקדמה', amount: 9600, dueDate: '2026-10-03', payOnEventDay: false },
        { label: 'יתרה', amount: 22400, dueDate: '2027-06-17', payOnEventDay: true },
      ],
      tasks: [
        { title: 'לחתום על חוזה', dueDate: '2026-10-06', category: 'venue' },
        { title: 'אישור סופי', dueDate: '2027-06-10', category: null },
      ],
    })) as Closed;
    expect(r.vendor).toMatchObject({ id: V1, status: 'booked', quoteAmount: 32000 });
    expect(r.previous).toEqual({ status: 'idea', quoteAmount: null });
    // the venue category is the event's own: nothing new was made
    expect(r.created.categoryId).toBeUndefined();
    expect(r.created.itemId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.created.paymentIds).toHaveLength(2);
    expect(r.created.taskIds).toHaveLength(2);

    const s = (await state())!;
    expect(s.categories.map((x) => x.key)).toEqual(['venue', 'catering']);
    const item = s.items.find((i) => i.id === r.created.itemId)!;
    expect(item).toMatchObject({
      vendorId: V1,
      title: 'אולם הגן',
      final: 32000,
      status: 'booked',
      categoryId: s.categories.find((x) => x.key === 'venue')!.id,
    });
    expect(
      s.payments.filter((p) => p.itemId === item.id).map((p) => [p.label, p.amount, p.payOnEventDay]),
    ).toEqual([
      ['מקדמה', 9600, false],
      ['יתרה', 22400, true],
    ]);
    const tasks = s.tasks.filter((t) => t.vendorId === V1);
    expect(tasks.map((t) => [t.title, t.dueDate, t.dueIsManual, t.category, t.status])).toEqual([
      ['לחתום על חוזה', '2026-10-06', true, 'venue', 'todo'],
      // no category of its own: the vendor's
      ['אישור סופי', '2027-06-10', true, 'venue', 'todo'],
    ]);
    // the money is the database's: the item is committed
    expect(s.totals.committed).toBe(32000);
  });

  it('creates the category (planned = the amount) when the event has none for that key, and reuses it after', async () => {
    const r = (await close(V2, {
      item: { categoryKey: 'photographer', title: 'דנה צילום', amount: 7500 },
    })) as Closed;
    expect(r.previous).toEqual({ status: 'quote', quoteAmount: null });
    expect(r.vendor.quoteAmount).toBe(7500);
    expect(r.created.categoryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.created.paymentIds).toEqual([]);
    expect(r.created.taskIds).toEqual([]);
    const s = (await state())!;
    const made = s.categories.find((x) => x.key === 'photographer')!;
    expect(made).toMatchObject({ id: r.created.categoryId, plannedAmount: 7500 });
    expect(s.items.find((i) => i.id === r.created.itemId)!.categoryId).toBe(made.id);

    // another vendor of the same key lands in the existing category and makes none
    await save({ id: V3, name: 'צלם שני', category: 'photographer' });
    const again = (await close(V3, {
      item: { categoryKey: 'photographer', title: 'צלם שני', amount: 3000 },
    })) as Closed;
    expect(again.created.categoryId).toBeUndefined();
    expect((await state())!.categories.filter((x) => x.key === 'photographer')).toHaveLength(1);
  });

  it('uses a category id of this event, and refuses another event’s with nothing written', async () => {
    const mine = (await state())!.categories.find((x) => x.key === 'catering')!.id;
    const theirs = (await state(other, OTHER))!.categories.find((x) => x.key === 'catering')!.id;
    await save({ id: UNKNOWN, name: 'קייטרינג הים', category: 'catering' });
    const before = {
      items: await count('budget_items'),
      payments: await count('budget_payments'),
      tasks: await count('plan_tasks'),
      categories: await count('budget_categories'),
    };

    const bad = await close(UNKNOWN, {
      amount: 40000,
      item: { categoryId: theirs, title: 'קייטרינג', amount: 40000 },
      payments: [{ label: 'מקדמה', amount: 10000, dueDate: null, payOnEventDay: false }],
      tasks: [{ title: 'טעימות', dueDate: null, category: 'catering' }],
    });
    expect(bad).toEqual({ ok: false, code: 'invalid_link' });
    expect({
      items: await count('budget_items'),
      payments: await count('budget_payments'),
      tasks: await count('plan_tasks'),
      categories: await count('budget_categories'),
    }).toEqual(before);
    expect((await state())!.vendors.find((v) => v.id === UNKNOWN)).toMatchObject({
      status: 'idea',
      quoteAmount: null,
    });

    const good = (await close(UNKNOWN, {
      item: { categoryId: mine, title: 'קייטרינג', amount: 40000 },
    })) as Closed;
    expect(good.created.categoryId).toBeUndefined();
    expect((await state())!.items.find((i) => i.id === good.created.itemId)!.categoryId).toBe(mine);
  });

  it('is all or nothing: a payment the table refuses undoes the category, the item and the status', async () => {
    const BAND = '10000000-0000-4000-8000-0000000000a1';
    await save({ id: BAND, name: 'להקה', category: 'band', status: 'quote', quoteAmount: 9000 });
    const before = {
      items: await count('budget_items'),
      payments: await count('budget_payments'),
      tasks: await count('plan_tasks'),
      categories: await count('budget_categories'),
    };
    const plan = (payment: Record<string, unknown>) => ({
      amount: 9500,
      item: { categoryKey: 'band', title: 'להקה', amount: 9500 },
      payments: [{ label: 'מקדמה', amount: 3000, dueDate: null, payOnEventDay: false }, payment],
      tasks: [{ title: 'לתאם שירים', dueDate: null, category: 'band' }],
    });
    for (const bad of [
      { label: 'יתרה', amount: 0, dueDate: null, payOnEventDay: false },
      { label: '', amount: 6500, dueDate: null, payOnEventDay: false },
      { label: 'יתרה', amount: 6500, dueDate: 'not-a-date', payOnEventDay: false },
    ]) {
      expect(await close(BAND, plan(bad))).toEqual({ ok: false, code: 'invalid' });
      expect({
        items: await count('budget_items'),
        payments: await count('budget_payments'),
        tasks: await count('plan_tasks'),
        categories: await count('budget_categories'),
      }).toEqual(before);
      expect((await state())!.vendors.find((v) => v.id === BAND)).toMatchObject({
        status: 'quote',
        quoteAmount: 9000,
      });
    }
    // an untitled task fails after the item and payments were made: still nothing is left
    expect(
      await close(BAND, {
        item: { categoryKey: 'band', title: 'להקה', amount: 9500 },
        payments: [{ label: 'מקדמה', amount: 3000, dueDate: null, payOnEventDay: false }],
        tasks: [{ title: '', dueDate: null, category: null }],
      }),
    ).toEqual({ ok: false, code: 'invalid' });
    expect(await count('budget_items')).toBe(before.items);
    expect(await count('budget_categories')).toBe(before.categories);
    expect(await count('budget_payments')).toBe(before.payments);
    await commit('planning_vendor_delete', [inv, OWNER, [BAND]]);
  });

  it('changes only the status without a plan, keeps the quote unless an amount is given, and takes payments to the vendor’s existing item', async () => {
    const SOLO = '10000000-0000-4000-8000-0000000000b1';
    await save({ id: SOLO, name: 'DJ', category: 'dj', status: 'contacted', quoteAmount: 4000 });
    const items = await count('budget_items');
    const plain = (await close(SOLO, null)) as Closed;
    expect(plain.vendor).toMatchObject({ status: 'booked', quoteAmount: 4000 });
    expect(plain.previous).toEqual({ status: 'contacted', quoteAmount: 4000 });
    expect(plain.created).toEqual({ itemId: null, paymentIds: [], taskIds: [] });
    expect(await count('budget_items')).toBe(items);

    // payments with no item to put them on
    expect(
      await close(SOLO, {
        payments: [{ label: 'מקדמה', amount: 1000, dueDate: null, payOnEventDay: false }],
      }),
    ).toEqual({ ok: false, code: 'no_item' });

    // with an item of the vendor's already (made earlier): the payments go on it, and it is not "created"
    const first = (await close(SOLO, {
      amount: 4200,
      item: { categoryKey: 'dj', title: 'DJ', amount: 4200 },
    })) as Closed;
    expect(first.vendor.quoteAmount).toBe(4200);
    const more = (await close(SOLO, {
      payments: [{ label: 'מקדמה', amount: 1000, dueDate: '2026-10-05', payOnEventDay: false }],
    })) as Closed;
    expect(more.created.itemId).toBeNull();
    expect(more.created.paymentIds).toHaveLength(1);
    expect((await state())!.payments.find((p) => p.id === more.created.paymentIds[0])!.itemId).toBe(
      first.created.itemId,
    );
  });

  it('refuses a vendor that is not this owner’s event’s, and too many of anything', async () => {
    expect(await close(V1, {}, inv, OTHER)).toBeNull();
    expect(await close(V1, {}, other, OTHER)).toBeNull();
    expect(await close(UNKNOWN.replace('9', '8'), {})).toBeNull();
    const tasks = Array.from({ length: 21 }, (_, i) => ({
      title: `משימה ${i}`,
      dueDate: null,
      category: null,
    }));
    expect(await close(V1, { tasks })).toEqual({ ok: false, code: 'too_many' });
    const pays = Array.from({ length: 21 }, () => ({
      label: 'x',
      amount: 1,
      dueDate: null,
      payOnEventDay: false,
    }));
    expect(
      await close(V1, { item: { categoryKey: 'venue', title: 'x', amount: 1 }, payments: pays }),
    ).toEqual({
      ok: false,
      code: 'too_many',
    });
  });
});

describe('taking a close back', () => {
  const plan = (vendorCategory: string, title: string) => ({
    amount: 5000,
    item: { categoryKey: vendorCategory, title, amount: 5000 },
    payments: [
      { label: 'מקדמה', amount: 1500, dueDate: '2026-10-03', payOnEventDay: false },
      { label: 'יתרה', amount: 3500, dueDate: '2027-06-17', payOnEventDay: true },
    ],
    tasks: [
      { title: 'חוזה', dueDate: '2026-10-06', category: vendorCategory },
      { title: 'תיאום', dueDate: '2027-05-01', category: vendorCategory },
    ],
  });
  const snapshot = async () => ({
    vendors: await q(`select id, status, quote_amount from plan_vendors order by id`),
    categories: await count('budget_categories'),
    items: await count('budget_items'),
    payments: await count('budget_payments'),
    tasks: await count('plan_tasks'),
  });

  it('puts the vendor back and removes exactly what the close made (the category too, when it made it)', async () => {
    const W = '10000000-0000-4000-8000-0000000000c1';
    await save({ id: W, name: 'פרחים', category: 'flowers', status: 'quote', quoteAmount: 4800 });
    const before = await snapshot();
    const r = (await close(W, plan('flowers', 'פרחים'))) as Closed;
    expect(r.created.categoryId).toBeDefined();
    expect(await count('budget_categories')).toBe(before.categories + 1);

    expect(await undo(W, r.previous, r.created)).toBe(true);
    expect(await snapshot()).toEqual(before);
    expect((await state())!.vendors.find((v) => v.id === W)).toMatchObject({
      status: 'quote',
      quoteAmount: 4800,
    });
    await commit('planning_vendor_delete', [inv, OWNER, [W]]);
  });

  it('removes only the listed ids: a payment added since keeps the item (and its category), a paid one stays', async () => {
    const W = '10000000-0000-4000-8000-0000000000c2';
    await save({ id: W, name: 'עוגות', category: 'cakes_sweets' });
    const r = (await close(W, plan('cakes_sweets', 'עוגות'))) as Closed;
    // the host adds a payment of their own to the item, and pays one of the made ones
    const mine = (
      await q<{ id: string }>(
        `insert into budget_payments (invitation_id, item_id, label, amount) values ($1, $2, 'תוספת', 200) returning id`,
        [inv, r.created.itemId],
      )
    )[0]!.id;
    await c.query(`update budget_payments set paid_at = now() where id = $1`, [r.created.paymentIds[0]]);
    const paid = r.created.paymentIds[0]!;
    const unpaid = r.created.paymentIds[1]!;

    expect(await undo(W, r.previous, r.created)).toBe(true);
    const left = (
      await q<{ id: string }>(`select id from budget_payments where item_id = $1 order by label`, [
        r.created.itemId,
      ])
    ).map((p) => p.id);
    expect(left.sort()).toEqual([mine, paid].sort());
    expect(left).not.toContain(unpaid);
    // the item has payments left, so it stays, and so does the category it is in
    expect(await count('budget_items', 'id = $1', [r.created.itemId])).toBe(1);
    expect(await count('budget_categories', 'id = $1', [r.created.categoryId])).toBe(1);
    // the tasks went, the vendor is back
    expect(await count('plan_tasks', 'id = any($1::uuid[])', [r.created.taskIds])).toBe(0);
    expect((await state())!.vendors.find((v) => v.id === W)!.status).toBe('idea');
    await commit('planning_vendor_delete', [inv, OWNER, [W]]);
    await c.query(`delete from budget_items where id = $1`, [r.created.itemId]);
    await c.query(`delete from budget_categories where id = $1`, [r.created.categoryId]);
  });

  it('keeps a category that is not empty, and one that was not made today', async () => {
    const A = '10000000-0000-4000-8000-0000000000c3';
    const B = '10000000-0000-4000-8000-0000000000c4';
    await save({ id: A, name: 'הסעות א', category: 'transport' });
    await save({ id: B, name: 'הסעות ב', category: 'transport' });
    const first = (await close(A, plan('transport', 'הסעה א'))) as Closed;
    expect(first.created.categoryId).toBeDefined();
    const second = (await close(B, plan('transport', 'הסעה ב'))) as Closed;
    expect(second.created.categoryId).toBeUndefined();
    const category = first.created.categoryId!;

    // the first vendor's undo cannot take the category: another vendor's item is in it
    expect(await undo(A, first.previous, first.created)).toBe(true);
    expect(await count('budget_categories', 'id = $1', [category])).toBe(1);
    expect(await count('budget_items', 'id = $1', [second.created.itemId])).toBe(1);

    // an undo that names a category that is days old (not made by a close just now) leaves it, even empty
    await c.query(`update budget_categories set created_at = now() - interval '3 days' where id = $1`, [
      category,
    ]);
    expect(await undo(B, second.previous, { ...second.created, categoryId: category })).toBe(true);
    expect(await count('budget_items', 'id = $1', [second.created.itemId])).toBe(0);
    expect(await count('budget_categories', 'id = $1', [category])).toBe(1);
    await commit('planning_vendor_delete', [inv, OWNER, [A, B]]);
    await c.query(`delete from budget_categories where id = $1`, [category]);
  });

  it('cannot delete other rows: another event’s, other vendors’, or the host’s own', async () => {
    const MINE = '10000000-0000-4000-8000-0000000000c5';
    const THEIRS = '10000000-0000-4000-8000-0000000000c6';
    await save({ id: MINE, name: 'ספק שלי', category: 'rental' });
    await save({ id: THEIRS, name: 'ספק שלהם', category: 'rental' }, other, OTHER);
    const mine = (await close(MINE, plan('rental', 'השכרה'))) as Closed;
    const theirs = (await close(THEIRS, plan('rental', 'השכרה שלהם'), other, OTHER)) as Closed;
    // a task, an item and a payment of the host's own, not linked to the vendor
    const own = (
      await q<{ id: string }>(
        `insert into plan_tasks (invitation_id, title) values ($1, 'משימה שלי') returning id`,
        [inv],
      )
    )[0]!.id;
    const ownItem = (
      await q<{ id: string }>(
        `insert into budget_items (invitation_id, category_id, title) values ($1, $2, 'סעיף שלי') returning id`,
        [inv, mine.created.categoryId],
      )
    )[0]!.id;
    const ownPay = (
      await q<{ id: string }>(
        `insert into budget_payments (invitation_id, item_id, label, amount) values ($1, $2, 'שלי', 10) returning id`,
        [inv, ownItem],
      )
    )[0]!.id;
    const otherTheirs = await snapshot();

    // another owner, another event's vendor, a vendor that does not exist: false, nothing changes
    expect(await undo(MINE, mine.previous, mine.created, inv, OTHER)).toBe(false);
    expect(await undo(MINE, mine.previous, mine.created, other, OTHER)).toBe(false);
    expect(await undo(THEIRS, theirs.previous, theirs.created, inv, OWNER)).toBe(false);
    expect(await undo(UNKNOWN.replace('9', '7'), mine.previous, mine.created)).toBe(false);
    expect(await undo(MINE, { status: 'nonsense', quoteAmount: null }, mine.created)).toBe(false);
    expect(await snapshot()).toEqual(otherTheirs);

    // this vendor's undo, carrying the other event's ids and the host's own ids, deletes none of them
    expect(
      await undo(MINE, mine.previous, {
        categoryId: theirs.created.categoryId,
        itemId: theirs.created.itemId,
        paymentIds: [...theirs.created.paymentIds, ownPay],
        taskIds: [...theirs.created.taskIds, own],
      }),
    ).toBe(true);
    expect(await count('budget_items', 'id = $1', [theirs.created.itemId])).toBe(1);
    expect(await count('budget_payments', 'id = any($1::uuid[])', [theirs.created.paymentIds])).toBe(2);
    expect(await count('plan_tasks', 'id = any($1::uuid[])', [theirs.created.taskIds])).toBe(2);
    expect(await count('budget_categories', 'id = $1', [theirs.created.categoryId])).toBe(1);
    expect(await count('budget_payments', 'id = $1', [ownPay])).toBe(1);
    expect(await count('plan_tasks', 'id = $1', [own])).toBe(1);
    // its own rows were not in the list this time, so they are still there too
    expect(await count('budget_items', 'id = $1', [mine.created.itemId])).toBe(1);

    // a list that names nothing removes nothing; garbage ids are refused, not half-applied
    expect(await undo(MINE, mine.previous, {})).toBe(true);
    expect(await count('budget_items', 'id = $1', [mine.created.itemId])).toBe(1);
    expect(await undo(MINE, mine.previous, { itemId: 'nope' })).toBe(false);
  });
});

describe('privileges', () => {
  it('nobody but the service role may call the vendor functions', async () => {
    const sql = [
      `select public.planning_vendor_save('${inv}', '${OWNER}', '{"name":"x"}')`,
      `select public.planning_vendor_delete('${inv}', '${OWNER}', '{}')`,
      `select public.planning_vendor_close('${inv}', '${OWNER}', '${V1}', '{}')`,
      `select public.planning_vendor_undo_close('${inv}', '${OWNER}', '${V1}', '{}', '{}')`,
    ];
    for (const role of ['anon', 'authenticated'] as const)
      for (const s of sql)
        await expect(as(c, role, OWNER, () => c.query(s))).rejects.toThrow(/permission denied/);
    expect(await call('planning_vendor_delete', [inv, OWNER, '{}'])).toBe(0);
    expect(await call('planning_vendor_save', [inv, OWNER, { id: UNKNOWN, name: 'x' }])).toMatchObject({
      name: 'x',
    });
  });

  it('the vendors table stays closed to everyone else', async () => {
    for (const role of ['anon', 'authenticated'] as const)
      await expect(as(c, role, OWNER, () => c.query(`select * from public.plan_vendors`))).rejects.toThrow(
        /permission denied/,
      );
  });
});

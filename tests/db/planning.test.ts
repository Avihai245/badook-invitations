import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Event planning (supabase/migrations/*_planning_*.sql): the plan is the owner's alone, its numbers are
// computed here (guest numbers by basis, costs per head and per table, VAT, what is committed and paid),
// dates move only for tasks the host never dated, and that only the service role may call any of it.

const OWNER = '66666666-6666-4666-8666-666666666661';
const OTHER = '66666666-6666-4666-8666-666666666662';

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
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows[0] as T;
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) =>
  (await c.query(sql, args)).rows as T[];

type Totals = {
  totalBudget: number | null;
  planned: number;
  expected: number;
  committed: number;
  paid: number;
  unpaid: number;
  remaining: number | null;
  perGuest: number | null;
  byCategory: { id: string; planned: number; expected: number; committed: number; paid: number }[];
};
type State = {
  invitation: { id: string; eventType: string; date: string; timezone: string };
  settings: Record<string, unknown> | null;
  tasks: {
    id: string;
    title: string | null;
    dueDate: string | null;
    systemKey: string | null;
    tplKey: string | null;
    dueIsManual: boolean;
  }[];
  categories: { id: string; key: string | null; plannedAmount: number }[];
  items: unknown[];
  payments: unknown[];
  headcount: {
    basis: string;
    adults: number;
    children: number;
    guests: number;
    tables: number;
    invited: number;
  };
  totals: Totals;
  headcountChange: { adults: number; children: number; tables: number; cost: number } | null;
  facts: { tables: number; confirmedUnseated: number; stationReady: boolean };
};
const state = (id = inv, owner = OWNER) => commit<State | null>('planning_state', [id, owner]);

const settings = (over: Record<string, unknown> = {}) => ({
  templateKey: 'wedding',
  variant: 'default',
  totalBudget: 100000,
  vatMode: 'included',
  vatPct: 18,
  guestBasis: 'invited',
  integrations: { mode: 'recommended' },
  reminders: { email: true },
  requiredVendors: ['venue', 'catering'],
  onboardingDone: true,
  anchorDate: '2027-06-17',
  ...over,
});
const task = (title: string | null, over: Record<string, unknown> = {}) => ({
  title,
  tplKey: null,
  notes: null,
  offsetDays: -30,
  dueDate: '2027-05-18',
  category: null,
  priority: 0,
  systemKey: null,
  suggestHide: false,
  ...over,
});
const category = (key: string, planned: number, over: Record<string, unknown> = {}) => ({
  key,
  name: null,
  plannedAmount: planned,
  costBasis: 'fixed',
  required: false,
  ...over,
});

async function guest(name: string, partySize: number | null) {
  return (
    await one<{ id: string }>(
      `insert into invitation_guests (invitation_id, name, party_size, token)
       values ($1, $2, $3, $4) returning id`,
      [inv, name, partySize, `tok-${Math.random().toString(36).slice(2)}-0123456789abcdef`],
    )
  ).id;
}
async function reply(attending: boolean, adults: number, children = 0) {
  await c.query(
    `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, children_count, edit_token_hash)
     values ($1, $2, 'he', 'x', $3, $4, $5)`,
    [inv, attending, adults, children, `h-${Math.random()}`],
  );
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
       ($1, 'plan-owner@example.com', 'scrypt:x:y', '{}'), ($2, 'plan-other@example.com', 'scrypt:x:y', '{}')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'plan-db', doc])
  ).id;
  other = (
    await commit<{ id: string }>('create_invitation', [OTHER, 'sahar-bordeaux', 'wedding', 'plan-other', doc])
  ).id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('setting a plan up', () => {
  it('is the owner’s alone, and happens once', async () => {
    expect(await state(inv, OTHER)).toBeNull();
    expect(await state(other, OWNER)).toBeNull();
    expect(await commit('planning_init', [inv, OTHER, settings(), [], []])).toBeNull();
    expect((await state())!.settings).toBeNull();

    const made = await commit('planning_init', [
      inv,
      OWNER,
      settings(),
      [
        task('לסגור אולם', { offsetDays: -300, dueDate: '2026-08-21' }),
        task(null, { systemKey: 'invitation_published', offsetDays: -70, dueDate: '2027-04-08' }),
        task(null, { systemKey: 'rsvp_deadline', offsetDays: -14, dueDate: '2027-06-03' }),
        task(null, { systemKey: 'final_headcount', offsetDays: -13, dueDate: '2027-06-04' }),
        task(null, { tplKey: 'book_venue', offsetDays: -300, dueDate: '2026-08-21' }),
      ],
      [category('venue', 30000), category('catering', 40000, { costBasis: 'per_adult' })],
    ]);
    expect(made).toEqual({ ok: true });
    expect(await commit('planning_init', [inv, OWNER, settings(), [], []])).toEqual({
      ok: false,
      code: 'exists',
    });

    const s = (await state())!;
    expect(s.invitation).toMatchObject({ id: inv, eventType: 'wedding' });
    expect(s.invitation.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.settings).toMatchObject({ templateKey: 'wedding', totalBudget: 100000, guestBasis: 'invited' });
    expect(s.tasks.map((t) => t.title ?? t.systemKey ?? t.tplKey)).toEqual([
      'לסגור אולם',
      'invitation_published',
      'rsvp_deadline',
      'final_headcount',
      'book_venue',
    ]);
    // the two tasks that come from data follow the invitation's own deadline (the day after, for the head-count)
    const byKey = (k: string) => s.tasks.find((t) => t.systemKey === k)!;
    expect(byKey('rsvp_deadline').dueDate).toBe('2027-06-01');
    expect(byKey('final_headcount').dueDate).toBe('2027-06-02');
    expect(s.categories.map((x) => x.key)).toEqual(['venue', 'catering']);
    // the other owner's plan is untouched
    expect((await state(other, OTHER))!.settings).toBeNull();
  });

  it('refuses a system task without a name only when it is not a system task', async () => {
    await expect(
      c.query(`insert into plan_tasks (invitation_id, title) values ($1, null)`, [inv]),
    ).rejects.toThrow(/plan_tasks_named/);
    await expect(
      c.query(`insert into plan_tasks (invitation_id, system_key) values ($1, 'invitation_published')`, [
        inv,
      ]),
    ).rejects.toThrow(/plan_tasks_system/);
  });
});

describe('the guest numbers a cost follows', () => {
  it('invited: the list’s party sizes, all counted as adults; confirmed: the replies; manual: the host’s own', async () => {
    await guest('משפחת כהן', 4);
    await guest('דני לוי', null);
    await reply(true, 2, 1);
    await reply(true, 1, 0);
    await reply(false, 0, 0);
    expect((await state())!.headcount).toMatchObject({
      basis: 'invited',
      adults: 5,
      children: 0,
      guests: 5,
      invited: 5,
    });

    await commit('planning_settings_save', [inv, OWNER, { guestBasis: 'confirmed' }]);
    expect((await state())!.headcount).toMatchObject({
      basis: 'confirmed',
      adults: 3,
      children: 1,
      guests: 4,
    });

    await commit('planning_settings_save', [
      inv,
      OWNER,
      { guestBasis: 'manual', manualAdults: 120, manualChildren: 15 },
    ]);
    expect((await state())!.headcount).toMatchObject({
      basis: 'manual',
      adults: 120,
      children: 15,
      guests: 135,
    });
    await commit('planning_settings_save', [inv, OWNER, { guestBasis: 'confirmed' }]);
  });
});

describe('costs that follow the guests', () => {
  it('per adult (with the child supplement), per child, per guest and per table; fixed or unpriced stays as planned', async () => {
    // confirmed: 3 adults, 1 child; no tables yet
    const cats = (await state())!.categories;
    const cat = (key: string) => cats.find((x) => x.key === key)!.id;
    await c.query(
      `update budget_categories set unit_price = 400, child_price = 200, cost_basis = 'per_adult' where id = $1`,
      [cat('catering')],
    );
    let s = (await state())!;
    // 3 × 400 + 1 × 200
    expect(s.totals.byCategory.find((x) => x.id === cat('catering'))!.planned).toBe(1400);
    expect(s.totals.byCategory.find((x) => x.id === cat('venue'))!.planned).toBe(30000);
    expect(s.totals.planned).toBe(31400);

    await c.query(`update budget_categories set cost_basis = 'per_child', unit_price = 150 where id = $1`, [
      cat('catering'),
    ]);
    s = (await state())!;
    expect(s.totals.byCategory.find((x) => x.id === cat('catering'))!.planned).toBe(150);
    await c.query(`update budget_categories set cost_basis = 'per_guest', unit_price = 100 where id = $1`, [
      cat('catering'),
    ]);
    expect((await state())!.totals.byCategory.find((x) => x.id === cat('catering'))!.planned).toBe(400);

    // per table: two live tables and a removed one
    await c.query(
      `insert into seating_tables (invitation_id, number, shape, capacity, x, y, w, h, deleted_at) values
         ($1, 1, 'round', 10, 1, 1, 1, 1, null), ($1, 2, 'round', 10, 2, 2, 1, 1, null),
         ($1, 3, 'round', 10, 3, 3, 1, 1, now())`,
      [inv],
    );
    await c.query(`update budget_categories set cost_basis = 'per_table', unit_price = 250 where id = $1`, [
      cat('catering'),
    ]);
    s = (await state())!;
    expect(s.headcount.tables).toBe(2);
    expect(s.totals.byCategory.find((x) => x.id === cat('catering'))!.planned).toBe(500);

    // priced per head but no price yet: stays at its planned amount
    await c.query(`update budget_categories set cost_basis = 'per_guest', unit_price = null where id = $1`, [
      cat('catering'),
    ]);
    expect((await state())!.totals.byCategory.find((x) => x.id === cat('catering'))!.planned).toBe(40000);
  });
});

describe('what is committed, paid and left', () => {
  it('counts booked and paid items, with VAT on the plan’s terms, and the payments made and still to make', async () => {
    const cats = (await state())!.categories;
    const venue = cats.find((x) => x.key === 'venue')!.id;
    const item = async (title: string, over: Record<string, unknown>) =>
      (
        await one<{ id: string }>(
          `insert into budget_items (invitation_id, category_id, title, estimate, quoted, final, status, vat_included)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
          [
            inv,
            venue,
            title,
            over.estimate ?? null,
            over.quoted ?? null,
            over.final ?? null,
            over.status ?? 'estimate',
            over.vat ?? null,
          ],
        )
      ).id;
    const hall = await item('אולם', { estimate: 30000, quoted: 28000, final: 29000, status: 'booked' });
    await item('צלם', { estimate: 5000, quoted: 4800, status: 'quoted' });
    await item('די ג׳י', { estimate: 3000, status: 'paid', vat: false });

    // included: amounts as entered, except the one marked without VAT (3000 → 3540)
    let t = (await state())!.totals;
    expect(t.expected).toBe(29000 + 4800 + 3540);
    expect(t.committed).toBe(29000 + 3540);
    expect(t.remaining).toBe(100000 - 32540);

    // excluded: everything is shown with VAT, except an item marked as already with it
    await commit('planning_settings_save', [inv, OWNER, { vatMode: 'excluded' }]);
    t = (await state())!.totals;
    expect(t.committed).toBe(Math.round(29000 * 1.18 * 100) / 100 + Math.round(3000 * 1.18 * 100) / 100);
    await commit('planning_settings_save', [inv, OWNER, { vatMode: 'none' }]);
    t = (await state())!.totals;
    expect(t.committed).toBe(29000 + 3000);
    await commit('planning_settings_save', [inv, OWNER, { vatMode: 'included' }]);

    await c.query(
      `insert into budget_payments (invitation_id, item_id, label, amount, due_date, paid_at) values
         ($1, $2, 'מקדמה', 10000, '2027-01-01', now()), ($1, $2, 'יתרה', 19000, '2027-06-17', null)`,
      [inv, hall],
    );
    t = (await state())!.totals;
    expect(t.paid).toBe(10000);
    expect(t.unpaid).toBe(19000);
    expect(t.byCategory.find((x) => x.id === venue)!.paid).toBe(10000);
    expect(t.perGuest).toBe(Math.round((32540 / 4) * 100) / 100);

    await commit('planning_settings_save', [inv, OWNER, { totalBudget: null }]);
    expect((await state())!.totals.remaining).toBeNull();
    await commit('planning_settings_save', [inv, OWNER, { totalBudget: 100000 }]);
  });

  it('an item or a payment cannot point at another event’s category or item', async () => {
    const otherCat = (
      await one<{ id: string }>(
        `insert into budget_categories (invitation_id, category_key) values ($1, 'venue') returning id`,
        [other],
      )
    ).id;
    await expect(
      c.query(`insert into budget_items (invitation_id, category_id, title) values ($1, $2, 'x')`, [
        inv,
        otherCat,
      ]),
    ).rejects.toThrow(/budget_items_category/);
  });
});

describe('when the guest numbers move', () => {
  it('says how many and what it costs, until the host has seen it', async () => {
    const cats = (await state())!.categories;
    const cat = cats.find((x) => x.key === 'catering')!.id;
    await c.query(
      `update budget_categories set cost_basis = 'per_adult', unit_price = 300, child_price = 0 where id = $1`,
      [cat],
    );
    await commit('planning_headcount_ack', [inv, OWNER]);
    expect((await state())!.headcountChange).toBeNull();
    await reply(true, 12, 0);
    const change = (await state())!.headcountChange!;
    expect(change).toMatchObject({ adults: 12, children: 0, tables: 0, cost: 3600 });
    expect(await commit('planning_headcount_ack', [inv, OWNER])).toBe(true);
    expect((await state())!.headcountChange).toBeNull();
    // someone else's ack does nothing
    expect(await commit('planning_headcount_ack', [inv, OTHER])).toBe(false);
  });

  it('changing where the numbers come from is not itself a change', async () => {
    await commit('planning_settings_save', [inv, OWNER, { guestBasis: 'invited' }]);
    expect((await state())!.headcountChange).toBeNull();
    await commit('planning_settings_save', [inv, OWNER, { guestBasis: 'confirmed' }]);
  });
});

describe('moving the dates with the event', () => {
  it('moves only the tasks the host never dated, and remembers the date', async () => {
    const tasks = (await state())!.tasks;
    const hall = tasks.find((t) => t.title === 'לסגור אולם')!;
    const published = tasks.find((t) => t.systemKey === 'invitation_published')!;
    const deadline = tasks.find((t) => t.systemKey === 'rsvp_deadline')!;
    await c.query(`update plan_tasks set due_date = '2026-09-01', due_is_manual = true where id = $1`, [
      published.id,
    ]);
    const moved = await commit('planning_dates_apply', [
      inv,
      OWNER,
      [
        { id: hall.id, due: '2026-09-30' },
        { id: published.id, due: '2027-04-20' },
        { id: deadline.id, due: '2027-06-10' },
      ],
      '2027-07-01',
    ]);
    expect(moved).toBe(1);
    const after = (await state())!;
    const by = (id: string) => after.tasks.find((t) => t.id === id)!;
    expect(by(hall.id).dueDate).toBe('2026-09-30');
    expect(by(published.id).dueDate).toBe('2026-09-01');
    // the deadline task follows the invitation's own deadline, whatever was stored
    expect(by(deadline.id).dueDate).toBe('2027-06-01');
    expect(after.settings!.anchorDate).toBe('2027-07-01');
    expect(await commit('planning_dates_apply', [inv, OTHER, [], '2027-07-01'])).toBeNull();
  });
});

describe('what the system knows', () => {
  it('counts the tables and the families still without one, and whether the entrance station exists', async () => {
    const f = (await state())!.facts;
    expect(f.tables).toBe(2);
    expect(f.stationReady).toBe(false);
    await c.query(`select public.seating_sync_units($1)`, [inv]);
    expect((await state())!.facts.confirmedUnseated).toBeGreaterThan(0);
  });
});

describe('the overview', () => {
  it('lists what is due soon and which required vendors have none closed', async () => {
    const o = await commit<{
      tasks: { title: string | null }[];
      vendors: { total: number; closed: number; missing: string[] };
      taskTotals: { total: number; done: number };
    }>('planning_overview', [inv, OWNER, '2027-06-01']);
    // the deadline (2027-06-03) is within three weeks; the hall (2026-09-30) is overdue; the date-less none
    expect(o.tasks.length).toBeGreaterThanOrEqual(2);
    expect(o.vendors).toEqual({ total: 0, closed: 0, missing: ['venue', 'catering'] });
    expect(o.taskTotals.total).toBe(5);
    // the head-count (06-02) and the deadline (06-01) are on the list at their invitation-derived dates
    expect(o.tasks.some((t) => (t as { systemKey?: string }).systemKey === 'final_headcount')).toBe(true);
    expect(await commit('planning_overview', [inv, OTHER, '2027-06-01'])).toBeNull();
    const none = await commit<{ settings: unknown }>('planning_overview', [other, OTHER, '2027-06-01']);
    expect(none.settings).toBeNull();
  });
});

describe('tasks', () => {
  type T = {
    id: string;
    title: string | null;
    status: string;
    dueDate: string | null;
    dueIsManual: boolean;
    completedAt: string | null;
    systemKey: string | null;
    sort: number;
    suggestHide: boolean;
  };
  const save = (t: Record<string, unknown>, id = inv, owner = OWNER) =>
    commit<T | { ok: false; code: string } | null>('planning_task_save', [id, owner, t]);
  const tasks = async () => (await state())!.tasks as unknown as T[];

  it('adds a task (a date the host sets makes it theirs), changes it, and stamps when it was done', async () => {
    const made = (await save({ title: 'לבחור להקה', dueDate: '2027-01-10', category: 'band' })) as T;
    expect(made).toMatchObject({
      title: 'לבחור להקה',
      status: 'todo',
      dueDate: '2027-01-10',
      dueIsManual: true,
      completedAt: null,
    });
    const done = (await save({ id: made.id, status: 'done' })) as T;
    expect(done.status).toBe('done');
    expect(done.completedAt).not.toBeNull();
    // saving done again keeps the first time
    expect(((await save({ id: made.id, status: 'done', notes: 'x' })) as T).completedAt).toBe(
      done.completedAt,
    );
    const back = (await save({ id: made.id, status: 'todo' })) as T;
    expect(back.completedAt).toBeNull();
    // only the keys present change
    expect(back).toMatchObject({ title: 'לבחור להקה', dueDate: '2027-01-10' });
    // clearing the date
    expect(((await save({ id: made.id, dueDate: null })) as T).dueDate).toBeNull();
  });

  it('is the owner’s alone, and an id of another event’s task is not theirs to take', async () => {
    expect(await save({ title: 'x' }, inv, OTHER)).toBeNull();
    const theirs = (await save({ title: 'שלהם' }, other, OTHER)) as T;
    expect(await save({ id: theirs.id, title: 'גנוב' })).toBeNull();
    expect((await commit<{ tasks: T[] }>('planning_state', [other, OTHER]))!.tasks[0]!.title).toBe('שלהם');
  });

  it('links only to the event’s own budget items and vendors', async () => {
    const mine = (await save({ title: 'קישור' })) as T;
    const otherCat = (
      await one<{ id: string }>(
        `insert into budget_categories (invitation_id, category_key) values ($1, 'dj') returning id`,
        [other],
      )
    ).id;
    const otherItem = (
      await one<{ id: string }>(
        `insert into budget_items (invitation_id, category_id, title) values ($1, $2, 'x') returning id`,
        [other, otherCat],
      )
    ).id;
    const otherVendor = (
      await one<{ id: string }>(
        `insert into plan_vendors (invitation_id, name) values ($1, 'x') returning id`,
        [other],
      )
    ).id;
    expect(await save({ id: mine.id, budgetItemId: otherItem })).toEqual({ ok: false, code: 'invalid_link' });
    expect(await save({ id: mine.id, vendorId: otherVendor })).toEqual({ ok: false, code: 'invalid_link' });
    const cat = (await state())!.categories[0]!.id;
    const item = (
      await one<{ id: string }>(
        `insert into budget_items (invitation_id, category_id, title) values ($1, $2, 'שלי') returning id`,
        [inv, cat],
      )
    ).id;
    expect(await save({ id: mine.id, budgetItemId: item })).toMatchObject({ budgetItemId: item });
    // deleting the item leaves the task, unlinked
    await c.query(`delete from budget_items where id = $1`, [item]);
    expect((await tasks()).find((t) => t.id === mine.id)).toMatchObject({ id: mine.id });
  });

  it('a system task keeps its name and its key: it can be hidden, never deleted', async () => {
    const sys = (await tasks()).find((t) => t.systemKey === 'invitation_published')!;
    expect(((await save({ id: sys.id, title: 'שם אחר', status: 'skipped' })) as T).title).toBeNull();
    expect((await tasks()).find((t) => t.id === sys.id)!.status).toBe('skipped');
    expect(await commit('planning_task_delete', [inv, OWNER, [sys.id]])).toBe(0);
    expect((await tasks()).some((t) => t.id === sys.id)).toBe(true);
    await save({ id: sys.id, status: 'todo' });
  });

  it('deletes the host’s own tasks, and putting the same one back (undo) keeps its id', async () => {
    const t = (await save({ title: 'למחוק', notes: 'הערה', dueDate: '2027-02-02' })) as T;
    expect(await commit('planning_task_delete', [inv, OTHER, [t.id]])).toBeNull();
    expect(await commit('planning_task_delete', [inv, OWNER, [t.id]])).toBe(1);
    expect((await tasks()).some((x) => x.id === t.id)).toBe(false);
    const again = (await save({ id: t.id, title: 'למחוק', notes: 'הערה', dueDate: '2027-02-02' })) as T;
    expect(again.id).toBe(t.id);
  });

  it('reorders the listed tasks and hides several at once', async () => {
    const all = await tasks();
    const ids = all.map((t) => t.id).reverse();
    expect(await commit('planning_tasks_reorder', [inv, OWNER, ids])).toBe(ids.length);
    expect((await tasks()).map((t) => t.id)).toEqual(ids);
    expect(await commit('planning_tasks_reorder', [inv, OTHER, ids])).toBeNull();

    const pair = ids.slice(0, 2);
    const hidden = (await commit<T[]>('planning_tasks_bulk', [
      inv,
      OWNER,
      pair,
      { status: 'skipped', suggestHide: false },
    ]))!;
    expect(hidden.map((t) => t.status)).toEqual(['skipped', 'skipped']);
    expect(await commit('planning_tasks_bulk', [inv, OTHER, pair, { status: 'todo' }])).toBeNull();
    await commit('planning_tasks_bulk', [inv, OWNER, pair, { status: 'todo' }]);
  });

  it('refuses a seventh hundred tasks', async () => {
    const tmp = (
      await commit<{ id: string }>('create_invitation', [
        OWNER,
        'sahar-bordeaux',
        'wedding',
        'plan-cap',
        (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft,
      ])
    ).id;
    await c.query(
      `insert into plan_tasks (invitation_id, title) select $1, 't' || g from generate_series(1, 600) g`,
      [tmp],
    );
    expect(await commit('planning_task_save', [tmp, OWNER, { title: 'one more' }])).toEqual({
      ok: false,
      code: 'too_many',
    });
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('privileges', () => {
  const TABLES = [
    'plan_templates',
    'plan_settings',
    'plan_vendors',
    'budget_categories',
    'budget_items',
    'budget_payments',
    'plan_tasks',
    'plan_ideas',
  ];
  const FUNCTIONS = [
    'planning_state(uuid, uuid)',
    'planning_overview(uuid, uuid, date)',
    'planning_settings_save(uuid, uuid, jsonb)',
    'planning_task_save(uuid, uuid, jsonb)',
  ];

  it('nobody but the service role reads the tables or calls the functions', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const t of TABLES)
        await expect(as(c, role, OWNER, () => c.query(`select * from public.${t}`))).rejects.toThrow(
          /permission denied/,
        );
      for (const f of FUNCTIONS) {
        const sql = f.startsWith('planning_overview')
          ? `select public.planning_overview('${inv}', '${OWNER}', current_date)`
          : f.startsWith('planning_settings_save')
            ? `select public.planning_settings_save('${inv}', '${OWNER}', '{}')`
            : f.startsWith('planning_task_save')
              ? `select public.planning_task_save('${inv}', '${OWNER}', '{}')`
              : `select public.planning_state('${inv}', '${OWNER}')`;
        await expect(as(c, role, OWNER, () => c.query(sql))).rejects.toThrow(/permission denied/);
      }
    }
    expect(await call('planning_state', [inv, OWNER])).not.toBeNull();
  });

  it('row level security is on for every table, and the files bucket is private', async () => {
    const rls = await q<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relname = any($1::text[]) and relkind = 'r'`,
      [TABLES],
    );
    expect(rls.length).toBe(TABLES.length);
    for (const r of rls) expect(r.relrowsecurity, r.relname).toBe(true);
    expect(
      await one(
        `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'plan-files'`,
      ),
    ).toEqual({
      public: false,
      file_size_limit: '10485760',
      allowed_mime_types: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    });
  });

  it('deleting the invitation deletes its plan', async () => {
    const tmp = (
      await commit<{ id: string }>('create_invitation', [
        OWNER,
        'sahar-bordeaux',
        'wedding',
        'plan-gone',
        (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft,
      ])
    ).id;
    await commit('planning_init', [tmp, OWNER, settings(), [task('x')], [category('venue', 1)]]);
    expect(
      (await one<{ n: string }>(`select count(*) n from plan_tasks where invitation_id = $1`, [tmp])).n,
    ).toBe('1');
    await c.query(`delete from invitations where id = $1`, [tmp]);
    for (const t of ['plan_settings', 'plan_tasks', 'budget_categories'])
      expect(
        (await one<{ n: string }>(`select count(*) n from ${t} where invitation_id = $1`, [tmp])).n,
      ).toBe('0');
  });
});

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// Event planning, notes & ideas (supabase/migrations/*_planning_ideas.sql): the cards are the owner's
// alone, a picture is one of the event's own files, the caps hold, a card becomes a task / vendor /
// budget line with a link both ways (all or nothing), and only the service role may call any of it.

const OWNER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';

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

type Idea = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  url: string | null;
  ogPreview: Record<string, string> | null;
  imagePath: string | null;
  color: string;
  tags: string[];
  pinned: boolean;
  items: { text: string; done: boolean }[];
  linkedTaskId: string | null;
  linkedVendorId: string | null;
  linkedBudgetItemId: string | null;
  sort: number;
};
type Refusal = { ok: false; code: string };
type Converted = { idea: Idea; created: { taskId?: string; vendorId?: string; itemId?: string } };

const save = (idea: Record<string, unknown>, id = inv, owner = OWNER) =>
  commit<Idea | Refusal | null>('planning_idea_save', [id, owner, idea]);
const convert = (idea: string, kind: string, data: Record<string, unknown>, id = inv, owner = OWNER) =>
  commit<Converted | Refusal | null>('planning_idea_convert', [id, owner, idea, kind, data]);
const del = (ids: string[], id = inv, owner = OWNER) =>
  commit<number | null>('planning_idea_delete', [id, owner, ids]);
const state = (id = inv, owner = OWNER) =>
  commit<{ ideas: Idea[]; tasks: { id: string }[]; vendors: { id: string }[] } | null>('planning_state', [
    id,
    owner,
  ]);
const idea = async (idea_id: string) => (await state())!.ideas.find((i) => i.id === idea_id);

async function makeInvitation(owner: string, name: string) {
  return (await commit<{ id: string }>('create_invitation', [owner, 'sahar-bordeaux', 'wedding', name, doc]))
    .id;
}
async function category(invitation: string, key = 'venue') {
  return (
    await one<{ id: string }>(
      `insert into budget_categories (invitation_id, category_key) values ($1, $2) returning id`,
      [invitation, key],
    )
  ).id;
}

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values
       ($1, 'ideas-owner@example.com', 'scrypt:x:y', '{}'), ($2, 'ideas-other@example.com', 'scrypt:x:y', '{}')`,
    [OWNER, OTHER],
  );
  doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = await makeInvitation(OWNER, 'ideas-db');
  other = await makeInvitation(OTHER, 'ideas-other');
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('saving a card', () => {
  it('a quick note or link needs only its content; the card goes to the top and is the owner’s alone', async () => {
    expect(await save({ type: 'note', body: 'x' }, inv, OTHER)).toBeNull();
    expect(await save({ type: 'note', body: 'x' }, other, OWNER)).toBeNull();
    expect(await count('plan_ideas')).toBe(0);

    const note = (await save({ type: 'note', body: '  לבדוק צבעים לפרחים  ' })) as Idea;
    expect(note).toMatchObject({
      type: 'note',
      title: null,
      body: 'לבדוק צבעים לפרחים',
      url: null,
      ogPreview: null,
      imagePath: null,
      color: 'default',
      tags: [],
      pinned: false,
      items: [],
      linkedTaskId: null,
      linkedVendorId: null,
      linkedBudgetItemId: null,
    });
    const link = (await save({ type: 'link', url: 'https://example.com/hall' })) as Idea;
    expect(link).toMatchObject({ type: 'link', url: 'https://example.com/hall' });
    // the newer card is first on the board
    expect(link.sort).toBeLessThan(note.sort);
    expect((await state())!.ideas.map((i) => i.id)).toEqual([link.id, note.id]);
    // type defaults to a note
    expect(((await save({ body: 'בלי סוג' })) as Idea).type).toBe('note');
    // the other event's board is untouched
    expect((await state(other, OTHER))!.ideas).toEqual([]);
  });

  it('keeps only the keys given when it changes a card, and clears what is set to null or empty', async () => {
    const made = (await save({
      type: 'link',
      title: 'אולם בגליל',
      body: 'נראה מקסים',
      url: 'https://example.com/galil',
      ogPreview: { title: 'אולם', site: 'example.com' },
      color: 'brand',
      tags: ['אולם', 'גליל'],
      pinned: true,
      sort: 7,
    })) as Idea;
    expect(made).toMatchObject({ color: 'brand', pinned: true, sort: 7, ogPreview: { title: 'אולם' } });

    const renamed = (await save({ id: made.id, title: 'אולם בצפון' })) as Idea;
    expect(renamed).toMatchObject({
      title: 'אולם בצפון',
      body: 'נראה מקסים',
      url: 'https://example.com/galil',
      color: 'brand',
      pinned: true,
      sort: 7,
      tags: ['אולם', 'גליל'],
    });
    const cleared = (await save({
      id: made.id,
      body: '',
      ogPreview: null,
      pinned: false,
      color: 'info',
    })) as Idea;
    expect(cleared).toMatchObject({
      body: null,
      ogPreview: null,
      pinned: false,
      color: 'info',
      title: 'אולם בצפון',
    });
  });

  it('refuses a card with no content at all, and a made-up type or color', async () => {
    expect(await save({ type: 'note' })).toEqual({ ok: false, code: 'empty' });
    expect(await save({ type: 'note', body: '   ', title: ' ' })).toEqual({ ok: false, code: 'empty' });
    // a card that loses its last content is refused, and stays as it was
    const keep = (await save({ type: 'note', body: 'רק זה' })) as Idea;
    expect(await save({ id: keep.id, body: null })).toEqual({ ok: false, code: 'empty' });
    expect((await idea(keep.id))!.body).toBe('רק זה');
    expect(await save({ type: 'sticker', body: 'x' })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ type: 'note', body: 'x', color: 'neon' })).toEqual({ ok: false, code: 'invalid' });
    expect(await save({ type: 'note', title: 'x'.repeat(161) })).toEqual({ ok: false, code: 'invalid' });
  });

  it('a picture must be one of this event’s own files, directly in its folder', async () => {
    const own = `${OWNER}/${inv}/0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b.png`;
    expect(await save({ type: 'image', title: 'שמלה', imagePath: own })).toMatchObject({
      type: 'image',
      imagePath: own,
    });
    for (const bad of [
      `${OWNER}/${other}/x.png`,
      `${OTHER}/${inv}/x.png`,
      `${OWNER}/${inv}/../${other}/x.png`,
      `${OWNER}/${inv}/sub/x.png`,
      `${OWNER}/${inv}/`,
      'x.png',
      `${OWNER}/${inv}/${'a'.repeat(300)}.png`,
    ])
      expect(await save({ type: 'image', title: 'x', imagePath: bad }), bad).toEqual({
        ok: false,
        code: 'invalid_image',
      });
    // changing an existing card's picture to someone else's is refused the same way
    const made = (await save({ type: 'image', title: 'עוד', imagePath: own })) as Idea;
    expect(await save({ id: made.id, imagePath: `${OTHER}/${other}/y.png` })).toEqual({
      ok: false,
      code: 'invalid_image',
    });
    expect((await idea(made.id))!.imagePath).toBe(own);
  });

  it('tags: trimmed, no repeats, at most twelve of up to thirty characters', async () => {
    const made = (await save({ type: 'note', body: 'x', tags: [' אולם ', 'אולם', '', 'פרחים'] })) as Idea;
    expect(made.tags).toEqual(['אולם', 'פרחים']);
    const twelve = Array.from({ length: 12 }, (_, i) => `t${i}`);
    expect(((await save({ id: made.id, tags: twelve })) as Idea).tags).toEqual(twelve);
    expect(await save({ id: made.id, tags: [...twelve, 'עוד'] })).toEqual({ ok: false, code: 'too_many' });
    expect(await save({ id: made.id, tags: ['x'.repeat(31)] })).toEqual({ ok: false, code: 'invalid' });
    expect((await idea(made.id))!.tags).toEqual(twelve);
  });

  it('a checklist keeps its lines in order and drops empty ones; a hundred at most, within what the table holds', async () => {
    const made = (await save({
      type: 'list',
      title: 'לקנות',
      items: [{ text: ' נרות ', done: true }, { text: '', done: false }, { text: 'מפיות' }],
    })) as Idea;
    expect(made.items).toEqual([
      { text: 'נרות', done: true },
      { text: 'מפיות', done: false },
    ]);
    const ticked = (await save({
      id: made.id,
      items: [...made.items, { text: 'בלונים', done: false }],
    })) as Idea;
    expect(ticked.items.map((l) => l.text)).toEqual(['נרות', 'מפיות', 'בלונים']);
    expect(
      await save({ id: made.id, items: Array.from({ length: 101 }, (_, i) => ({ text: `l${i}` })) }),
    ).toEqual({ ok: false, code: 'too_many' });
    expect(await save({ id: made.id, items: [{ text: 'x'.repeat(201) }] })).toEqual({
      ok: false,
      code: 'invalid',
    });
    // a hundred long lines would not fit the table's 16 KB for the list: refused, not an error
    expect(
      await save({ id: made.id, items: Array.from({ length: 100 }, () => ({ text: 'א'.repeat(200) })) }),
    ).toEqual({ ok: false, code: 'too_large' });
    expect((await idea(made.id))!.items.length).toBe(3);
    // a list with only empty lines and no other content is empty
    expect(await save({ type: 'list', items: [{ text: ' ' }] })).toEqual({ ok: false, code: 'empty' });
  });

  it('a client-chosen id makes the card with that id, and a stranger’s id is not theirs to take', async () => {
    const id = '99999999-9999-4999-8999-999999999991';
    expect(((await save({ id, type: 'note', body: 'שלי' })) as Idea).id).toBe(id);
    const theirs = (await save({ type: 'note', body: 'שלהם' }, other, OTHER)) as Idea;
    expect(await save({ id: theirs.id, body: 'גנוב' })).toBeNull();
    expect(await del([theirs.id])).toBe(0);
    expect((await state(other, OTHER))!.ideas.find((i) => i.id === theirs.id)!.body).toBe('שלהם');
  });

  it('refuses a five hundred and first card, but still changes the ones it has', async () => {
    const tmp = await makeInvitation(OWNER, 'ideas-cap');
    await c.query(
      `insert into plan_ideas (invitation_id, body) select $1, 'n' || g from generate_series(1, 500) g`,
      [tmp],
    );
    expect(await save({ type: 'note', body: 'one more' }, tmp)).toEqual({ ok: false, code: 'too_many' });
    const first = (
      await one<{ id: string }>(`select id from plan_ideas where invitation_id = $1 limit 1`, [tmp])
    ).id;
    expect(await save({ id: first, body: 'changed' }, tmp)).toMatchObject({ body: 'changed' });
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('deleting cards', () => {
  it('deletes the owner’s cards only, and putting the same one back (undo) keeps its id and place', async () => {
    const made = (await save({
      type: 'note',
      title: 'למחוק',
      body: 'תוכן',
      color: 'success',
      tags: ['א'],
      pinned: true,
      sort: 3,
    })) as Idea;
    expect(await del([made.id], inv, OTHER)).toBeNull();
    expect(await idea(made.id)).toBeTruthy();
    // another event's cards are not reachable with this event's id
    expect(await del([made.id], other, OTHER)).toBe(0);
    expect(await del([made.id])).toBe(1);
    expect(await idea(made.id)).toBeUndefined();
    expect(await del([made.id])).toBe(0);

    const again = (await save({
      id: made.id,
      type: made.type,
      title: made.title,
      body: made.body,
      color: made.color,
      tags: made.tags,
      pinned: made.pinned,
      sort: made.sort,
    })) as Idea;
    expect(again).toMatchObject({ id: made.id, color: 'success', pinned: true, sort: 3, tags: ['א'] });
  });

  it('a card that became a task, a vendor or a budget line leaves it behind', async () => {
    const cat = await category(inv, 'dj');
    const card = (await save({ type: 'note', title: 'להשאיר' })) as Idea;
    const t = (await convert(card.id, 'task', { title: 'משימה שנשארת' })) as Converted;
    const v = (await convert(card.id, 'vendor', { name: 'ספק שנשאר' })) as Converted;
    const i = (await convert(card.id, 'item', { categoryId: cat, title: 'סעיף שנשאר' })) as Converted;
    expect(await del([card.id])).toBe(1);
    expect(await one(`select 1 as x from plan_tasks where id = $1`, [t.created.taskId])).toBeTruthy();
    expect(await one(`select 1 as x from plan_vendors where id = $1`, [v.created.vendorId])).toBeTruthy();
    expect(await one(`select 1 as x from budget_items where id = $1`, [i.created.itemId])).toBeTruthy();
  });
});

describe('turning a card into something', () => {
  it('a task: the card’s title, an optional date that makes it the host’s own, and the link both ways', async () => {
    const card = (await save({ type: 'note', title: 'להזמין חופה', body: 'לשאול את דנה' })) as Idea;
    const dated = (await convert(card.id, 'task', {
      title: 'להזמין חופה',
      dueDate: '2027-03-01',
      category: 'design',
      notes: 'לשאול את דנה',
    })) as Converted;
    const taskId = dated.created.taskId!;
    expect(dated.idea).toMatchObject({
      id: card.id,
      linkedTaskId: taskId,
      linkedVendorId: null,
      linkedBudgetItemId: null,
    });
    expect(dated.created).toEqual({ taskId });
    const row = await one<Record<string, unknown>>(`select * from plan_tasks where id = $1`, [taskId]);
    expect(row).toMatchObject({
      invitation_id: inv,
      title: 'להזמין חופה',
      notes: 'לשאול את דנה',
      due_is_manual: true,
      tpl_key: null,
      system_key: null,
      category_key: 'design',
      status: 'todo',
    });
    expect(String(row.due_date)).toContain('2027');
    // the board and the tasks list both show it
    expect((await idea(card.id))!.linkedTaskId).toBe(taskId);
    expect((await state())!.tasks.some((t) => t.id === taskId)).toBe(true);

    // without a date the task is not dated by the host
    const plain = (await save({ type: 'note', body: 'בלי תאריך' })) as Idea;
    const undated = (await convert(plain.id, 'task', { title: 'בלי תאריך' })) as Converted;
    expect(
      await one(`select due_date, due_is_manual, notes, category_key from plan_tasks where id = $1`, [
        undated.created.taskId,
      ]),
    ).toEqual({ due_date: null, due_is_manual: false, notes: null, category_key: null });
  });

  it('a vendor: the name, a category, the link and the notes; and a budget line in one of the event’s categories', async () => {
    const card = (await save({ type: 'link', title: 'צלם', url: 'https://example.com/photo' })) as Idea;
    const v = (await convert(card.id, 'vendor', {
      name: 'סטודיו אור',
      category: 'photographer',
      url: 'https://example.com/photo',
      notes: 'מצאתי באינסטגרם',
    })) as Converted;
    expect(v.idea.linkedVendorId).toBe(v.created.vendorId);
    expect(
      await one(`select name, category_key, url, notes, status from plan_vendors where id = $1`, [
        v.created.vendorId,
      ]),
    ).toEqual({
      name: 'סטודיו אור',
      category_key: 'photographer',
      url: 'https://example.com/photo',
      notes: 'מצאתי באינסטגרם',
      status: 'idea',
    });
    expect(((await state())!.vendors as { id: string }[]).some((x) => x.id === v.created.vendorId)).toBe(
      true,
    );

    const cat = await category(inv, 'flowers');
    const i = (await convert(card.id, 'item', {
      categoryId: cat,
      title: 'זר כלה',
      estimate: 850.5,
    })) as Converted;
    expect(i.idea).toMatchObject({
      linkedBudgetItemId: i.created.itemId,
      linkedVendorId: v.created.vendorId,
    });
    expect(
      await one(`select category_id, title, estimate, status, vendor_id from budget_items where id = $1`, [
        i.created.itemId,
      ]),
    ).toEqual({ category_id: cat, title: 'זר כלה', estimate: '850.50', status: 'estimate', vendor_id: null });
    // a budget line needs no estimate
    const free = (await convert(card.id, 'item', { categoryId: cat, title: 'בלי מחיר' })) as Converted;
    expect(
      await one<{ estimate: string | null }>(`select estimate from budget_items where id = $1`, [
        free.created.itemId,
      ]),
    ).toEqual({ estimate: null });
  });

  it('is the owner’s alone: not another owner, not another event’s card, not an unknown card', async () => {
    const card = (await save({ type: 'note', body: 'פרטי' })) as Idea;
    const theirs = (await save({ type: 'note', body: 'שלהם' }, other, OTHER)) as Idea;
    const tasks = await count('plan_tasks');
    expect(await convert(card.id, 'task', { title: 'x' }, inv, OTHER)).toBeNull();
    expect(await convert(theirs.id, 'task', { title: 'x' }, inv, OWNER)).toBeNull();
    expect(await convert(theirs.id, 'task', { title: 'x' }, other, OWNER)).toBeNull();
    expect(await convert('99999999-9999-4999-8999-999999999992', 'task', { title: 'x' })).toBeNull();
    expect(await count('plan_tasks')).toBe(tasks);
    expect((await idea(card.id))!.linkedTaskId).toBeNull();
  });

  it('refuses a budget category of another event, and creates nothing', async () => {
    const card = (await save({ type: 'note', body: 'סעיף' })) as Idea;
    const foreign = await category(other, 'band');
    const before = await count('budget_items');
    expect(await convert(card.id, 'item', { categoryId: foreign, title: 'x' })).toEqual({
      ok: false,
      code: 'invalid_link',
    });
    expect(await convert(card.id, 'item', { title: 'x' })).toEqual({ ok: false, code: 'invalid_link' });
    expect(await convert(card.id, 'item', { categoryId: 'not-a-uuid', title: 'x' })).toEqual({
      ok: false,
      code: 'invalid_link',
    });
    expect(await count('budget_items')).toBe(before);
    expect(await count('budget_items', other)).toBe(0);
    expect((await idea(card.id))!.linkedBudgetItemId).toBeNull();
  });

  it('refuses what it cannot make (no title, a made-up kind or date) and creates nothing', async () => {
    const card = (await save({ type: 'note', body: 'משהו' })) as Idea;
    const cat = await category(inv, 'transport');
    const before = [await count('plan_tasks'), await count('plan_vendors'), await count('budget_items')];
    for (const [kind, data] of [
      ['task', {}],
      ['task', { title: '   ' }],
      ['task', { title: 'x'.repeat(201) }],
      ['task', { title: 'x', dueDate: 'tomorrow' }],
      ['task', { title: 'x', category: 'Not A Key' }],
      ['vendor', { name: '' }],
      ['vendor', { name: 'x'.repeat(121) }],
      ['vendor', { name: 'x', url: 'https://e.com/' + 'a'.repeat(500) }],
      ['item', { categoryId: cat, title: '' }],
      ['item', { categoryId: cat, title: 'x', estimate: -1 }],
      ['item', { categoryId: cat, title: 'x', estimate: 2e9 }],
      ['event', { title: 'x' }],
    ] as const)
      expect(await convert(card.id, kind, data), `${kind} ${JSON.stringify(data)}`).toEqual({
        ok: false,
        code: 'invalid',
      });
    expect([await count('plan_tasks'), await count('plan_vendors'), await count('budget_items')]).toEqual(
      before,
    );
  });

  it('is all or nothing: if the link cannot be made, the new row is not left behind', async () => {
    const card = (await save({ type: 'note', body: 'אטומי' })) as Idea;
    const before = [await count('plan_tasks'), await count('plan_vendors'), await count('budget_items')];
    await c.query(`
      create function public.test_ideas_break() returns trigger language plpgsql as $$
      begin raise exception 'link broke'; end $$;
      create trigger test_ideas_break before update on public.plan_ideas
        for each row execute function public.test_ideas_break();`);
    try {
      const cat = await category(inv, 'rental');
      await expect(convert(card.id, 'task', { title: 'לא יישאר' })).rejects.toThrow(/link broke/);
      await expect(convert(card.id, 'vendor', { name: 'לא יישאר' })).rejects.toThrow(/link broke/);
      await expect(convert(card.id, 'item', { categoryId: cat, title: 'לא יישאר' })).rejects.toThrow(
        /link broke/,
      );
    } finally {
      await c.query(
        `drop trigger test_ideas_break on public.plan_ideas; drop function public.test_ideas_break()`,
      );
    }
    expect([await count('plan_tasks'), await count('plan_vendors'), await count('budget_items')]).toEqual(
      before,
    );
    expect(await idea(card.id)).toMatchObject({
      linkedTaskId: null,
      linkedVendorId: null,
      linkedBudgetItemId: null,
    });
  });

  it('stops at the caps of the tables it fills: 600 tasks, 300 vendors, 600 budget lines', async () => {
    const tmp = await makeInvitation(OWNER, 'ideas-convert-cap');
    const cat = await category(tmp, 'venue');
    const card = (await save({ type: 'note', body: 'כמעט' }, tmp)) as Idea;
    await c.query(
      `insert into plan_tasks (invitation_id, title) select $1, 't' || g from generate_series(1, 600) g`,
      [tmp],
    );
    await c.query(
      `insert into plan_vendors (invitation_id, name) select $1, 'v' || g from generate_series(1, 300) g`,
      [tmp],
    );
    await c.query(
      `insert into budget_items (invitation_id, category_id, title) select $1, $2, 'i' || g from generate_series(1, 600) g`,
      [tmp, cat],
    );
    expect(await convert(card.id, 'task', { title: 'עוד' }, tmp)).toEqual({ ok: false, code: 'too_many' });
    expect(await convert(card.id, 'vendor', { name: 'עוד' }, tmp)).toEqual({ ok: false, code: 'too_many' });
    expect(await convert(card.id, 'item', { categoryId: cat, title: 'עוד' }, tmp)).toEqual({
      ok: false,
      code: 'too_many',
    });
    expect(await count('plan_tasks', tmp)).toBe(600);
    expect(await count('plan_vendors', tmp)).toBe(300);
    expect(await count('budget_items', tmp)).toBe(600);
    // one below each cap is allowed
    await c.query(
      `delete from plan_tasks where id = (select id from plan_tasks where invitation_id = $1 limit 1)`,
      [tmp],
    );
    expect(await convert(card.id, 'task', { title: 'נכנס' }, tmp)).toMatchObject({
      created: { taskId: expect.any(String) },
    });
    await c.query(`delete from invitations where id = $1`, [tmp]);
  });
});

describe('the link between a card and what it became', () => {
  it('deleting the task, the vendor or the budget line unlinks the card and keeps it', async () => {
    const cat = await category(inv, 'photographer');
    const card = (await save({ type: 'note', title: 'שלושה קישורים' })) as Idea;
    const t = (await convert(card.id, 'task', { title: 'ת' })) as Converted;
    const v = (await convert(card.id, 'vendor', { name: 'ס' })) as Converted;
    const i = (await convert(card.id, 'item', { categoryId: cat, title: 'ב' })) as Converted;
    expect(await idea(card.id)).toMatchObject({
      linkedTaskId: t.created.taskId,
      linkedVendorId: v.created.vendorId,
      linkedBudgetItemId: i.created.itemId,
    });
    await c.query(`delete from plan_tasks where id = $1`, [t.created.taskId]);
    expect(await idea(card.id)).toMatchObject({ linkedTaskId: null, linkedVendorId: v.created.vendorId });
    await c.query(`delete from plan_vendors where id = $1`, [v.created.vendorId]);
    expect(await idea(card.id)).toMatchObject({ linkedVendorId: null, linkedBudgetItemId: i.created.itemId });
    await c.query(`delete from budget_items where id = $1`, [i.created.itemId]);
    expect(await idea(card.id)).toMatchObject({
      title: 'שלושה קישורים',
      linkedTaskId: null,
      linkedVendorId: null,
      linkedBudgetItemId: null,
    });
  });

  it('deleting the invitation deletes its cards', async () => {
    const tmp = await makeInvitation(OWNER, 'ideas-gone');
    await save({ type: 'note', body: 'x' }, tmp);
    expect(await count('plan_ideas', tmp)).toBe(1);
    await c.query(`delete from invitations where id = $1`, [tmp]);
    expect(await count('plan_ideas', tmp)).toBe(0);
  });
});

describe('privileges', () => {
  it('nobody but the service role calls the functions or reads the cards', async () => {
    const calls = [
      `select public.planning_idea_save('${inv}', '${OWNER}', '{"body":"x"}')`,
      `select public.planning_idea_delete('${inv}', '${OWNER}', '{}'::uuid[])`,
      `select public.planning_idea_convert('${inv}', '${OWNER}', '${inv}', 'task', '{"title":"x"}')`,
    ];
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(as(c, role, OWNER, () => c.query(`select * from public.plan_ideas`))).rejects.toThrow(
        /permission denied/,
      );
      for (const sql of calls)
        await expect(as(c, role, OWNER, () => c.query(sql))).rejects.toThrow(/permission denied/);
    }
    expect(
      await as(
        c,
        'service_role',
        null,
        async () =>
          (await c.query(`select public.planning_idea_delete('${inv}', '${OWNER}', '{}'::uuid[]) as r`))
            .rows[0].r,
      ),
    ).toBe(0);
    expect(await call('planning_idea_save', [inv, OTHER, { body: 'x' }])).toBeNull();
  });

  it('every function is security definer with an empty search path', async () => {
    const rows = (
      await c.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
        `select proname, prosecdef, proconfig from pg_proc where proname in ('planning_idea_save', 'planning_idea_delete', 'planning_idea_convert')`,
      )
    ).rows;
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(r.prosecdef, r.proname).toBe(true);
      expect(r.proconfig, r.proname).toContain('search_path=""');
    }
  });
});

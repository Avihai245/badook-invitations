import { expect, test, type Page } from '@playwright/test';
import { LOCAL, api, newHost, open, setPlan, sql, type Host } from '../support/phase5b';

// Event planning, the budget, the vendors and the ideas board in a browser: the budget follows the guest
// list and the replies (and stops when the link is switched off), a new expense, a vendor closed with its
// budget line and payments and then taken back, an idea turned into a task, and the assistant's steps.

test.skip(!LOCAL, 'reads and writes rows of the local database');

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const plan = (host: Host, tool = '') => `/app/invitations/${host.id}/plan${tool}`;
const planning = (host: Host, tool = '') => `/api/invitations/${host.id}/planning${tool}`;

async function planned(
  page: Page,
  prefix: string,
  opts: {
    plan?: 'free' | 'pro' | 'business';
    days?: number;
    mode?: 'standalone' | 'recommended' | 'full';
  } = {},
) {
  const host = await newHost(page, prefix, opts.plan ?? 'free', { date: day(opts.days ?? 120) });
  const res = await api(page, planning(host), 'POST', {
    op: 'init',
    template: 'wedding',
    totalBudget: 150000,
    integrationsMode: opts.mode ?? 'recommended',
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return host;
}

/** `n` guests of two people each, straight into the invitation's list. */
const addGuests = (host: Host, n: number, from = 1) =>
  sql(
    `insert into invitation_guests (invitation_id, name, party_size, token)
     select $1, 'אורח ' || g, 2, md5(random()::text || g::text) || md5(g::text) from generate_series($2::int, $3::int) g`,
    [host.id, from, from + n - 1],
  );

// the tool's page is there once its save line is
const content = (page: Page) => page.getByText('כל השינויים נשמרו').first().waitFor({ timeout: 30_000 });

interface View {
  headcount: { basis: string; adults: number };
  headcountChange: { adults: number } | null;
  totals: { byCategory: { id: string; planned: number }[] };
  categories: { id: string; key: string | null }[];
}
const readView = async (page: Page, host: Host) =>
  (await api<{ view: View }>(page, planning(host))).body.view;

test('the budget follows the guest list, tells what a change costs, and stops following when the link is off', async ({
  page,
}) => {
  // the recommended level links the vendors, tasks and overview — the budget keeps its own numbers
  const host = await planned(page, 'tool-budget', { mode: 'recommended' });
  await addGuests(host, 10); // 20 people
  let view = await readView(page, host);
  expect(view.headcount).toMatchObject({ basis: 'manual', adults: 0 });
  const catering = view.categories.find((c) => c.key === 'catering')!;

  // the host links the budget to the guest list: it follows the invitation's list from now on
  const on = await api(page, planning(host), 'POST', {
    op: 'settings',
    patch: { integrations: { guests: true } },
  });
  expect(on.status, JSON.stringify(on.body)).toBe(200);
  view = await readView(page, host);
  expect(view.headcount).toMatchObject({ basis: 'invited', adults: 20 });

  // 300 per adult
  const saved = await api(page, planning(host, '/budget'), 'POST', {
    op: 'category_save',
    category: { id: catering.id, costBasis: 'per_adult', unitPrice: 300 },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  view = await readView(page, host);
  expect(view.totals.byCategory.find((c) => c.id === catering.id)!.planned).toBe(6000);

  // the host looks at the budget (that is the number they have seen), then 10 more people are invited
  await open(page, plan(host, '/budget'));
  await content(page);
  await expect(page.getByTestId('budget-summary')).toContainText('150,000');
  await expect(page.getByTestId('budget-category').first()).toBeVisible();
  await api(page, planning(host), 'POST', { op: 'ack_headcount' });
  await addGuests(host, 5, 11);
  view = await readView(page, host);
  expect(view.totals.byCategory.find((c) => c.id === catering.id)!.planned).toBe(9000);
  expect(view.headcountChange).toMatchObject({ adults: 10 });
  await page.reload();
  await content(page);
  await expect(page.getByText('נוספו 10 מבוגרים').first()).toBeVisible();

  // the link to the guest list off: the budget keeps the host's own numbers, and nothing is deleted
  const off = await api(page, planning(host), 'POST', {
    op: 'settings',
    patch: { integrations: { guests: false }, manualAdults: 40 },
  });
  expect(off.status, JSON.stringify(off.body)).toBe(200);
  view = await readView(page, host);
  expect(view.headcount).toMatchObject({ basis: 'manual', adults: 40 });
  expect(view.totals.byCategory.find((c) => c.id === catering.id)!.planned).toBe(12000);
  const guests = await sql<{ n: string }>(
    `select count(*) n from invitation_guests where invitation_id = $1`,
    [host.id],
  );
  expect(Number(guests[0]!.n)).toBe(15);
});

test('a new expense lands in its category and is saved', async ({ page }) => {
  const host = await planned(page, 'tool-expense');
  await open(page, plan(host, '/budget'));
  await content(page);
  await page.getByRole('button', { name: 'הוספת הוצאה' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'הוצאה חדשה' });
  await dialog.getByLabel('מה זה?').fill('צלם לאירוע');
  await dialog.getByLabel('קטגוריה').selectOption({ label: 'צלם / צלמת' });
  await dialog.getByLabel('הערכה').fill('8000');
  await dialog.getByRole('button', { name: 'להוספה' }).click();
  await expect(dialog).toHaveCount(0);
  const rows = await sql<{ estimate: string }>(
    `select estimate from budget_items where invitation_id = $1 and title = 'צלם לאירוע'`,
    [host.id],
  );
  expect(Number(rows[0]!.estimate)).toBe(8000);
});

test('a vendor is added, closed with its budget line and payments, and the close is taken back', async ({
  page,
}) => {
  const host = await planned(page, 'tool-vendor');
  await open(page, plan(host, '/vendors'));
  await content(page);

  // a vendor with a quote and payment terms, as the host would have filled in the details
  const made = await api<{ vendor: { id: string } }>(page, planning(host, '/vendors'), 'POST', {
    op: 'save',
    vendor: {
      name: 'דנה צילום',
      category: 'photographer',
      status: 'quote',
      quoteAmount: 8000,
      paymentTerms: '30% מקדמה, 70% ביום האירוע',
    },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  await page.reload();
  await content(page);
  await expect(page.getByText('דנה צילום').first()).toBeVisible();

  // "close vendor" from the card's menu: a budget line, a payment schedule from the terms, follow-up tasks
  await page.getByRole('button', { name: 'פעולות עבור דנה צילום' }).first().click();
  await page.getByRole('menuitem', { name: 'סגירת ספק' }).click();
  const dialog = page.getByRole('dialog', { name: 'סגירת ספק' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('לוח תשלומים')).toBeVisible();
  await dialog.getByRole('button', { name: 'סגירת ספק', exact: true }).last().click();
  await expect(page.getByText('הספק נסגר', { exact: true })).toBeVisible();

  const vendor = await sql<{ status: string }>(`select status from plan_vendors where id = $1`, [
    made.body.vendor.id,
  ]);
  expect(vendor[0]!.status).toBe('booked');
  const item = await sql<{ id: string; final: string | null; quoted: string | null }>(
    `select id, final, quoted from budget_items where invitation_id = $1 and vendor_id = $2`,
    [host.id, made.body.vendor.id],
  );
  expect(item).toHaveLength(1);
  const payments = await sql<{ amount: string }>(
    `select amount from budget_payments where item_id = $1 order by amount`,
    [item[0]!.id],
  );
  // 30% and 70% of 8,000, to the agora
  expect(payments.map((p) => Number(p.amount))).toEqual([2400, 5600]);

  // Undo: the vendor is back where it was, and what the close made is gone
  await page.getByRole('button', { name: 'ביטול', exact: true }).click();
  await expect(page.getByText('הסגירה בוטלה', { exact: true })).toBeVisible();
  const back = await sql<{ status: string }>(`select status from plan_vendors where id = $1`, [
    made.body.vendor.id,
  ]);
  expect(back[0]!.status).toBe('quote');
  const gone = await sql<{ n: string }>(`select count(*) n from budget_items where vendor_id = $1`, [
    made.body.vendor.id,
  ]);
  expect(Number(gone[0]!.n)).toBe(0);
});

test('a vendor is added in two fields from the page, and "what is missing" offers the rest', async ({
  page,
}) => {
  const host = await planned(page, 'tool-vendor-add');
  await open(page, plan(host, '/vendors'));
  await content(page);
  await page.getByRole('button', { name: 'הוספת ספק' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'ספק חדש' });
  await dialog.getByLabel('שם הספק').fill('אולם הגן');
  await dialog.getByLabel('קטגוריה').selectOption({ label: 'אולם / מקום' });
  await dialog.getByRole('button', { name: 'הוספה' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('אולם הגן').first()).toBeVisible();
  const rows = await sql<{ status: string; category_key: string }>(
    `select status, category_key from plan_vendors where invitation_id = $1 and name = 'אולם הגן'`,
    [host.id],
  );
  expect(rows[0]).toMatchObject({ status: 'idea', category_key: 'venue' });
});

test('an idea is written in one line, kept, and turned into a task that keeps the link', async ({ page }) => {
  const host = await planned(page, 'tool-idea');
  await open(page, plan(host, '/ideas'));
  await content(page).catch(() => undefined);
  const composer = page.getByRole('textbox', { name: 'רעיון חדש' }).first();
  await composer.fill('להזמין חופה מעץ');
  await composer.press('Enter');
  await expect(page.getByText('להזמין חופה מעץ').first()).toBeVisible();
  await expect
    .poll(async () => (await sql(`select 1 from plan_ideas where invitation_id = $1`, [host.id])).length)
    .toBe(1);

  await page
    .getByRole('button', { name: /הפיכת הרעיון/ })
    .first()
    .click();
  await page.getByRole('menuitem', { name: 'משימה' }).click();
  const dialog = page.getByRole('dialog', { name: 'הפיכה למשימה' });
  await expect(dialog.getByLabel('שם המשימה')).toHaveValue(/חופה/);
  await dialog.getByRole('button', { name: 'ליצירת משימה' }).click();
  await expect(page.getByText('המשימה נוצרה', { exact: true })).toBeVisible();
  const linked = await sql<{ title: string }>(
    `select t.title from plan_ideas i join plan_tasks t on t.id = i.linked_task_id where i.invitation_id = $1`,
    [host.id],
  );
  expect(linked[0]!.title).toContain('חופה');
  // the card links to the task
  await expect(page.getByRole('link', { name: /משימה:/ }).first()).toBeVisible();
});

test('the assistant summarizes an idea and its ticked steps become tasks (Pro); the free plan sees a gentle lock', async ({
  page,
}) => {
  const host = await planned(page, 'tool-idea-ai', { plan: 'free' });
  await api(page, planning(host, '/ideas'), 'POST', {
    op: 'save',
    idea: { type: 'note', title: 'קייטרינג', body: 'המלצה מדנה על שף' },
  });
  await open(page, plan(host, '/ideas'));
  await page.getByRole('button', { name: 'פעולות לרעיון' }).first().click();
  await page.getByRole('menuitem', { name: 'סיכום והצעת צעדים' }).click();
  const locked = page.getByRole('dialog', { name: 'סיכום והצעת צעדים' });
  await expect(locked.getByTestId('ai-locked')).toBeVisible();
  await expect(locked.getByRole('link', { name: 'מעבר ל-Pro' })).toHaveAttribute(
    'href',
    '/app/billing?plan=pro',
  );
  await page.keyboard.press('Escape');

  const email = (
    await sql<{ email: string }>(
      `select u.email from auth.users u join invitations i on i.owner_id = u.id where i.id = $1`,
      [host.id],
    )
  )[0]!.email;
  await setPlan(email, 'pro');
  await page.reload();
  await page.getByRole('button', { name: 'פעולות לרעיון' }).first().click();
  await page.getByRole('menuitem', { name: 'סיכום והצעת צעדים' }).click();
  const dialog = page.getByRole('dialog', { name: 'סיכום והצעת צעדים' });
  await expect(dialog.getByTestId('ai-result')).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText('A caterer worth a call')).toBeVisible();
  // nothing is saved by asking
  const before = await sql<{ n: string }>(
    `select count(*) n from plan_tasks where invitation_id = $1 and title like 'Call the caterer%'`,
    [host.id],
  );
  expect(Number(before[0]!.n)).toBe(0);
  await dialog.getByRole('button', { name: 'להוסיף 2 משימות' }).click();
  await expect(page.getByText('נוספו 2 משימות', { exact: true })).toBeVisible();
  const after = await sql<{ title: string; category_key: string | null }>(
    `select title, category_key from plan_tasks where invitation_id = $1 and title in
       ('Call the caterer and ask for a quote', 'Book a tasting') order by title`,
    [host.id],
  );
  expect(after).toEqual([
    { title: 'Book a tasting', category_key: 'catering' },
    { title: 'Call the caterer and ask for a quote', category_key: 'catering' },
  ]);
});

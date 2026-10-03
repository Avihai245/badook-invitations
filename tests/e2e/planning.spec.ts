import { expect, test, type Page } from '@playwright/test';
import { navItem, navTo } from '../support/event-nav';
import { LOCAL, api, newHost, open, publish, setPlan, sql, type Host } from '../support/phase5b';

// Event planning (feature planning): the tab and its first-run, the tasks (add, tick with undo, hide,
// the details), a system task that ticks itself, the event's date moving the tasks' dates, the plan's
// settings, the tools' pages, a past event, who may open a plan, and English.

test.skip(!LOCAL, 'reads and writes rows of the local database');

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const plan = (host: Host, tool = '') => `/app/invitations/${host.id}/plan${tool}`;

/** A host with a wedding `days` days away, signed in, with the plan set up through the API. */
async function planned(
  page: Page,
  prefix: string,
  opts: {
    days?: number;
    plan?: 'free' | 'pro' | 'business';
    mode?: 'standalone' | 'recommended' | 'full';
    budget?: number | null;
  } = {},
) {
  const host = await newHost(page, prefix, opts.plan ?? 'free', { date: day(opts.days ?? 120) });
  const res = await api(page, `/api/invitations/${host.id}/planning`, 'POST', {
    op: 'init',
    template: 'wedding',
    totalBudget: opts.budget === undefined ? 150000 : opts.budget,
    integrationsMode: opts.mode ?? 'recommended',
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return host;
}

// a planning screen's content, or the event's home (where /plan leads once the plan exists)
const content = (page: Page) =>
  page
    .locator('[data-group], [data-plan-card], [data-testid="home-next"]')
    .first()
    .waitFor({ timeout: 30_000 });

test('a new host sets the plan up in three short steps and lands on the event home, the stage shows what is open', async ({
  page,
}) => {
  const host = await newHost(page, 'plan-first', 'free', { date: day(150) });
  await open(page, `/app/invitations/${host.id}`);
  // the planning stage is in the event's navigation before any plan exists
  await expect(navItem(page, 'tasks')).toHaveCount(1);
  await open(page, plan(host));
  await expect(page.getByRole('heading', { name: 'נסתכל' }).or(page.getByText('נתחיל לתכנן'))).toBeVisible();
  await page
    .getByLabel('התקציב הכולל')
    .waitFor({ state: 'detached' })
    .catch(() => undefined);

  await page.getByRole('button', { name: 'הבא' }).click();
  await page.getByLabel('התקציב הכולל').fill('120000');
  await expect(page.getByLabel('מבוגרים')).toBeVisible();
  await page.getByRole('button', { name: 'הבא' }).click();
  await page.getByRole('radio', { name: /מומלץ/ }).click();
  await page.getByRole('button', { name: 'להתחיל לתכנן' }).click();
  // set up: the event's home takes over (one next step; the budget as a gauge)
  await page.waitForURL(new RegExp(`/app/invitations/${host.id}$`), { timeout: 30_000 });
  await expect(page.getByTestId('home-next')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('home-budget')).toContainText('120,000');

  // a wedding's plan: many tasks, the system ones among them, and a budget in its categories
  const state = await api<{ view: { tasks: { systemKey: string | null }[]; categories: unknown[] } }>(
    page,
    `/api/invitations/${host.id}/planning`,
  );
  expect(state.body.view.tasks.length).toBeGreaterThan(60);
  expect(state.body.view.tasks.some((t) => t.systemKey === 'invitation_published')).toBe(true);
  expect(state.body.view.categories.length).toBeGreaterThan(10);

  // the stage says how many tasks are open; the home's tasks widget, what is due this week
  await open(page, `/app/invitations/${host.id}`);
  await expect(page.getByTestId('event-sidebar').locator('[data-stage="plan"]')).toContainText('פתוחים');
  await expect(page.getByTestId('home-tasks')).toBeVisible();
});

test('tasks: add with Enter, tick with Undo, hide, and the details drawer keeps a date the host set', async ({
  page,
}) => {
  const host = await planned(page, 'plan-tasks');
  await open(page, plan(host, '/tasks'));
  await content(page);

  await page.getByRole('textbox', { name: 'להוספת משימה' }).fill('להזמין שמלה לאמא');
  await page.keyboard.press('Enter');
  const row = page.locator('[data-task]', { hasText: 'להזמין שמלה לאמא' });
  await expect(row).toBeVisible();
  // saved: a reload still has it
  await expect(page.getByText('כל השינויים נשמרו')).toBeVisible();
  await page.waitForTimeout(800);
  await page.reload();
  await content(page);
  await expect(row).toBeVisible();

  // tick it → it moves into the (collapsed) done group, and Undo brings it back
  await row.getByRole('checkbox').click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'ביטול', exact: true }).click();
  await expect(row).toBeVisible();

  // details: a date of the host's own
  await row.getByRole('button', { name: 'להזמין שמלה לאמא' }).click();
  await page.getByLabel('תאריך יעד').fill(day(9));
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect(row).toContainText('בעוד 9 ימים');
  const stored = await sql<{ due_is_manual: boolean }>(
    `select due_is_manual from plan_tasks where title = 'להזמין שמלה לאמא' and invitation_id = $1`,
    [host.id],
  );
  expect(stored[0]!.due_is_manual).toBe(true);

  // hide it: it leaves the list and shows under "hidden"
  await row.getByRole('button', { name: 'פעולות' }).click();
  await page.getByRole('menuitem', { name: 'הסתרה' }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'הוסתרו', exact: true }).click();
  await expect(row).toBeVisible();
});

test('a system task ticks itself when the invitation is published, and its button goes to the place', async ({
  page,
}) => {
  const host = await planned(page, 'plan-system');
  await open(page, plan(host, '/tasks'));
  await content(page);
  await page.getByRole('button', { name: /בהמשך/ }).click();
  const published = page.locator('[data-task]', { hasText: 'פרסום' }).first();
  await expect(published.getByRole('link', { name: 'לביצוע' })).toHaveAttribute(
    'href',
    `/app/invitations/${host.id}/edit?publish=1`,
  );
  await expect(published).not.toHaveAttribute('data-done', '');

  await publish(host.id);
  await page.reload();
  await content(page);
  await page
    .getByRole('button', { name: /בהמשך|בוצעו/ })
    .first()
    .click()
    .catch(() => undefined);
  await page.getByRole('button', { name: /בוצעו/ }).click();
  await expect(page.locator('[data-task][data-done]', { hasText: 'פרסום' })).toBeVisible();
});

test('moving the event’s date offers to move the dates; a date the host set stays, and "keep" stops the question', async ({
  page,
}) => {
  const host = await planned(page, 'plan-date', { days: 200 });
  const before = await sql<{ id: string; due_date: string }>(
    `select id, due_date::text from plan_tasks where invitation_id = $1 and tpl_key = 'book_venue_and_date'`,
    [host.id],
  );
  await sql(
    `update plan_tasks set due_is_manual = true, due_date = $2 where invitation_id = $1 and tpl_key = 'book_dj'`,
    [host.id, day(30)],
  );
  await sql(
    `update invitations set draft = jsonb_set(draft, '{event,date}', to_jsonb($2::text)) where id = $1`,
    [host.id, day(230)],
  );
  await open(page, plan(host, '/tasks'));
  await content(page);
  await expect(page.getByText('תאריך האירוע השתנה')).toBeVisible();
  await page.getByRole('button', { name: 'לעדכון התאריכים' }).click();
  await expect(page.getByText('תאריך האירוע השתנה')).toHaveCount(0);
  const dj = await sql<{ due_date: string }>(
    `select due_date::text from plan_tasks where invitation_id = $1 and tpl_key = 'book_dj'`,
    [host.id],
  );
  expect(dj[0]!.due_date).toBe(day(30));
  const after = await sql<{ due_date: string }>(`select due_date::text from plan_tasks where id = $1`, [
    before[0]!.id,
  ]);
  expect(after[0]!.due_date >= before[0]!.due_date).toBe(true);

  // and "keep them as they are" leaves every date and stops asking about this date
  await sql(
    `update invitations set draft = jsonb_set(draft, '{event,date}', to_jsonb($2::text)) where id = $1`,
    [host.id, day(260)],
  );
  const mid = await sql<{ due_date: string }>(`select due_date::text from plan_tasks where id = $1`, [
    before[0]!.id,
  ]);
  await page.reload();
  await content(page);
  await page.getByRole('button', { name: 'להשאיר כמו שהם' }).click();
  await expect(page.getByText('תאריך האירוע השתנה')).toHaveCount(0);
  const kept = await sql<{ due_date: string }>(`select due_date::text from plan_tasks where id = $1`, [
    before[0]!.id,
  ]);
  expect(kept[0]!.due_date).toBe(mid[0]!.due_date);
  await page.reload();
  await content(page);
  await expect(page.getByText('תאריך האירוע השתנה')).toHaveCount(0);
});

test('the settings: the level of linking and the weekly email, saved without deleting anything', async ({
  page,
}) => {
  const host = await planned(page, 'plan-settings', { mode: 'recommended' });
  await open(page, plan(host, '/tasks'));
  await content(page);
  await page.getByRole('button', { name: 'הגדרות' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'מלא' }).click();
  await expect(page.getByText('ההגדרות נשמרו', { exact: true })).toBeVisible();
  const stored = await sql<{ integrations: Record<string, unknown> }>(
    `select integrations from plan_settings where invitation_id = $1`,
    [host.id],
  );
  expect(stored[0]!.integrations).toMatchObject({
    mode: 'full',
    guests: true,
    seating: true,
    eventDay: true,
  });
  await dialog.getByRole('switch', { name: /סיכום שבועי/ }).click();
  await expect
    .poll(
      async () =>
        (
          await sql<{ r: Record<string, unknown> }>(
            `select reminders r from plan_settings where invitation_id = $1`,
            [host.id],
          )
        )[0]!.r.email,
    )
    .toBe(false);
  // switching a link off keeps the tasks, the budget and the vendors
  const tasks = await sql<{ n: string }>(`select count(*) n from plan_tasks where invitation_id = $1`, [
    host.id,
  ]);
  expect(Number(tasks[0]!.n)).toBeGreaterThan(60);
});

test('every tool’s page opens from the navigation, with its title and the save line', async ({ page }) => {
  const host = await planned(page, 'plan-nav');
  await open(page, `/app/invitations/${host.id}`);
  await page.getByTestId('home-next').waitFor();
  for (const [tool, title] of [
    ['tasks', 'משימות'],
    ['budget', 'תקציב'],
    ['vendors', 'ספקים'],
    ['ideas', 'פתקים ורעיונות'],
  ] as const) {
    await navTo(page, tool);
    await expect(navItem(page, tool)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
    await expect(page.getByText('כל השינויים נשמרו')).toBeVisible();
  }
});

test('a past event’s plan is a summary: what was spent, paid, and no more tasks', async ({ page }) => {
  const host = await newHost(page, 'plan-past', 'free', { date: day(-5) });
  const res = await api(page, `/api/invitations/${host.id}/planning`, 'POST', {
    op: 'init',
    template: 'wedding',
    totalBudget: 90000,
    integrationsMode: 'recommended',
  });
  expect(res.status).toBe(201);
  // after the day the home's next step is the film or the numbers, and nothing is "due this week"
  await open(page, plan(host));
  await page.waitForURL(new RegExp(`/app/invitations/${host.id}$`), { timeout: 30_000 });
  await expect(page.getByTestId('home-next')).toHaveAttribute('data-action', /film|insights/);
  await expect(page.getByTestId('home-tasks')).not.toContainText('השבוע');
  // the budget is a summary
  await open(page, plan(host, '/budget'));
  await expect(page.getByTestId('budget-past')).toBeVisible({ timeout: 30_000 });
});

test('only the owner opens a plan; a save-the-date has no planning stage; switched off, it can be switched back on', async ({
  page,
  browser,
}) => {
  // Pro: a free account has room for one invitation, and this test makes a second (a save-the-date)
  const host = await planned(page, 'plan-owner', { plan: 'pro' });
  const stranger = await browser.newContext({ locale: 'he-IL' });
  const other = await stranger.newPage();
  await newHost(other, 'plan-stranger', 'free');
  // the page is the not-found page (its status can be 200 once the layout has started streaming)
  await other.goto(plan(host));
  await expect(other.getByText('לא מצאנו את העמוד הזה')).toBeVisible();
  await expect(other.locator('[data-plan-card], [data-group]')).toHaveCount(0);
  const denied = await api(other, `/api/invitations/${host.id}/planning`);
  expect(denied.status).toBe(404);
  await stranger.close();

  // a save-the-date: no tab, no page
  const std = await api<{ id: string }>(page, '/api/invitations', 'POST', {
    templateId: 'sahar-bordeaux',
    eventType: 'save_the_date',
    locales: ['he', 'en'],
    defaultLocale: 'he',
    hosts: { primary: { he: 'נועה', en: 'Noa' }, secondary: { he: 'איתי', en: 'Itay' } },
    date: day(100),
    startTime: '19:30',
    timezone: 'Asia/Jerusalem',
  });
  expect(std.status).toBe(201);
  await open(page, `/app/invitations/${std.body.id}`);
  await expect(navItem(page, 'tasks')).toHaveCount(0);
  await page.goto(`/app/invitations/${std.body.id}/plan`);
  await expect(page.getByText('לא מצאנו את העמוד הזה')).toBeVisible();
  await expect(page.locator('[data-plan-card], [data-group]')).toHaveCount(0);

  // the host switches planning off for the event: a way back on, nothing deleted
  const off = await api(page, `/api/invitations/${host.id}/features`, 'PATCH', {
    feature: 'planning',
    off: true,
  });
  expect(off.status).toBe(200);
  await open(page, plan(host));
  await page.getByRole('button', { name: 'להפעלת התכנון' }).click();
  await expect(page.getByTestId('home-next')).toBeVisible({ timeout: 30_000 });
  const tasks = await sql<{ n: string }>(`select count(*) n from plan_tasks where invitation_id = $1`, [
    host.id,
  ]);
  expect(Number(tasks[0]!.n)).toBeGreaterThan(60);
});

test('Pro tools are a gentle lock on the free plan and open on Pro; the AI refuses a free plan', async ({
  page,
}) => {
  const host = await planned(page, 'plan-gating', { plan: 'free' });
  const ai = await api(page, `/api/invitations/${host.id}/planning/ai`, 'POST', {
    kind: 'plan',
    description: 'מסיבת פרישה לשלושים עובדים',
  });
  expect(ai.status).toBe(403);
  expect(ai.body).toMatchObject({ code: 'feature_off', feature: 'planning_ai', package: 'premium' });
  const tpl = await api(page, `/api/invitations/${host.id}/planning/templates`, 'POST', { op: 'list' });
  expect(tpl.body).toMatchObject({ code: 'feature_off', feature: 'planning_templates', package: 'vip' });
  const files = await api(page, `/api/invitations/${host.id}/planning/files`, 'POST', {
    op: 'upload',
    purpose: 'attachment',
    contentType: 'application/pdf',
    size: 1000,
  });
  expect(files.body).toMatchObject({ code: 'feature_off', feature: 'planning_export' });
  const xlsx = await page.request.get(`/api/invitations/${host.id}/planning/budget/export`);
  expect(xlsx.status()).toBe(403);

  await setPlan(
    (
      await sql<{ email: string }>(
        `select u.email from auth.users u join invitations i on i.owner_id = u.id where i.id = $1`,
        [host.id],
      )
    )[0]!.email,
    'pro',
  );
  const pro = await page.request.get(`/api/invitations/${host.id}/planning/budget/export`);
  expect(pro.status()).toBe(200);
  expect(pro.headers()['content-type']).toContain('spreadsheetml');
  const upload = await api<{ path: string }>(page, `/api/invitations/${host.id}/planning/files`, 'POST', {
    op: 'upload',
    purpose: 'attachment',
    contentType: 'application/pdf',
    size: 1000,
  });
  expect(upload.status).toBe(200);
  expect(upload.body.path).toMatch(new RegExp(`^[0-9a-f-]{36}/${host.id}/`));
  // Pro: the AI (the stand-in in this stack) drafts a plan to approve; nothing is saved by asking
  const before = await sql<{ n: string }>(`select count(*) n from plan_tasks where invitation_id = $1`, [
    host.id,
  ]);
  const ai2 = await api<{ draft: { tasks: { title: string }[]; categories: { key: string }[] } }>(
    page,
    `/api/invitations/${host.id}/planning/ai`,
    'POST',
    { kind: 'plan', description: 'מסיבת פרישה לשלושים עובדים', locale: 'he' },
  );
  expect(ai2.status, JSON.stringify(ai2.body)).toBe(200);
  expect(ai2.body.draft.tasks.length).toBeGreaterThan(3);
  expect(ai2.body.draft.categories.map((c) => c.key)).toContain('catering');
  const after = await sql<{ n: string }>(`select count(*) n from plan_tasks where invitation_id = $1`, [
    host.id,
  ]);
  expect(after[0]!.n).toBe(before[0]!.n);
  // a model that fails or answers nonsense is a 502, not a broken screen
  for (const description of ['נפילה במסיבה', 'זבל זבל זבל זבל']) {
    const bad = await api(page, `/api/invitations/${host.id}/planning/ai`, 'POST', {
      kind: 'plan',
      description,
      locale: 'he',
    });
    expect(bad.status).toBe(502);
  }
});

test('the calendar file has the open tasks that have a date, and a stranger cannot read it', async ({
  page,
}) => {
  const host = await planned(page, 'plan-ics');
  const res = await page.request.get(`/api/invitations/${host.id}/planning/calendar`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/calendar');
  const body = await res.text();
  expect(body).toContain('BEGIN:VCALENDAR');
  expect(body.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThan(20);
  expect(body).toContain('DTSTART;VALUE=DATE:');
  const anon = await page.context().browser()!.newContext();
  const status = (
    await anon.request.get(
      `${page.url().split('/app')[0] || 'http://127.0.0.1:3100'}/api/invitations/${host.id}/planning/calendar`,
    )
  ).status();
  expect([401, 404]).toContain(status);
  await anon.close();
});

test.describe('in English', () => {
  test.use({ locale: 'en-GB' });
  test('the tab, the first run and the tasks read in English', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'ui_lang', value: 'en', url: baseURL! }]);
    const host = await newHost(page, 'plan-en', 'free', { date: day(150) });
    await open(page, plan(host));
    await expect(
      page.getByText("Let's start planning").or(page.getByText('Let’s start planning')),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Start planning' }).click();
    await expect(page.getByTestId('home-next')).toBeVisible({ timeout: 30_000 });
    await expect(navItem(page, 'tasks')).toHaveText(/Tasks/);
    await navTo(page, 'tasks');
    await content(page);
    await expect(page.getByRole('textbox', { name: 'Add a task' })).toBeVisible();
    await expect(page.getByText('All changes saved')).toBeVisible();
    // the template's tasks are named in English, the system ones by the overview's steps
    await expect(page.locator('[data-task]').first()).toContainText(/[A-Za-z]/);
  });
});

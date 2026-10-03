import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { LOCAL, api, newHost, open, sql, type Host } from '../support/phase5b';

// Design QA for event planning (not part of the regular run): a wedding 120 days away with a full plan —
// tasks done and open, a budget with payments, vendors in every stage, an ideas board — and a past
// event, photographed in Hebrew and English on a phone (390×844) and a desktop: the first run, the
// overview, the tasks, the budget (categories and payments), the vendors, the ideas, the settings and
// the quick add.
//   PLANNING_SCREENS=1 PW_PORT=… npx playwright test tests/e2e/planning-screens.spec.ts
// Screenshots: tests/.artifacts/qa/planning/ (gitignored).

test.skip(!LOCAL || !process.env.PLANNING_SCREENS, 'design QA: run on request (PLANNING_SCREENS=1)');
test.setTimeout(240_000);

const OUT = 'tests/.artifacts/qa/planning';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const planning = (host: Host, tool = '') => `/api/invitations/${host.id}/planning${tool}`;
const at = (host: Host, tool = '') => `/app/invitations/${host.id}/plan${tool}`;

async function post<T = Record<string, unknown>>(page: Page, host: Host, tool: string, body: unknown) {
  const res = await api<T>(page, planning(host, tool), 'POST', body);
  expect(
    res.status,
    `${tool} ${JSON.stringify(body).slice(0, 120)} → ${JSON.stringify(res.body)}`,
  ).toBeLessThan(300);
  return res.body;
}

/** A wedding with the plan set up and enough in it to look lived in. */
async function lived(page: Page, prefix: string, days: number) {
  const host = await newHost(page, prefix, 'pro', { date: day(days) });
  await post(page, host, '', {
    op: 'init',
    template: 'wedding',
    totalBudget: 180000,
    integrationsMode: 'full',
    guestBasis: 'invited',
  });
  await sql(
    `insert into invitation_guests (invitation_id, name, party_size, token)
     select $1, 'אורח ' || g, case when g % 5 = 0 then 3 else 2 end, md5(random()::text || g::text) || md5(g::text)
     from generate_series(1, 70) g`,
    [host.id],
  );
  // some of the first tasks are done, some are the host's own
  const view = (
    await api<{
      view: {
        tasks: { id: string; tplKey: string | null }[];
        categories: { id: string; key: string | null }[];
      };
    }>(page, planning(host))
  ).body.view;
  const doneIds = view.tasks.slice(0, 7).map((t) => t.id);
  await post(page, host, '/tasks', { op: 'bulk', ids: doneIds, patch: { status: 'done' } });
  await post(page, host, '/tasks', {
    op: 'save',
    task: { title: 'לשאול את סבתא על המתכון לקוגל', dueDate: day(12), assignee: 'נועה' },
  });
  await post(page, host, '/tasks', { op: 'save', task: { title: 'לקנות נעליים לחתונה', priority: 1 } });

  // budget: prices per head, items in stages, payments (some paid)
  const cat = (key: string) => view.categories.find((c) => c.key === key)!.id;
  await post(page, host, '/budget', {
    op: 'category_save',
    category: { id: cat('catering'), costBasis: 'per_adult', unitPrice: 320, plannedAmount: 60000 },
  });
  await post(page, host, '/budget', {
    op: 'category_save',
    category: { id: cat('venue'), costBasis: 'fixed', plannedAmount: 45000 },
  });
  await post(page, host, '/budget', {
    op: 'item_save',
    item: {
      categoryId: cat('venue'),
      title: 'אולם הגן הקסום',
      estimate: 45000,
      quoted: 44000,
      final: 43500,
      status: 'booked',
    },
    payments: [
      { label: 'מקדמה', amount: 10000, dueDate: day(-20), paidAt: day(-20) },
      { label: 'תשלום', amount: 20000, dueDate: day(40) },
      { label: 'יתרה', amount: 13500, dueDate: day(110), payOnEventDay: false },
    ],
  });
  await post(page, host, '/budget', {
    op: 'item_save',
    item: {
      categoryId: cat('photographer'),
      title: 'דנה צילום',
      estimate: 9000,
      quoted: 8500,
      status: 'quoted',
    },
  });
  await post(page, host, '/budget', {
    op: 'item_save',
    item: { categoryId: cat('dj'), title: 'DJ שחר', estimate: 6000, final: 5800, status: 'booked' },
    payments: [
      { label: 'מקדמה', amount: 1800, dueDate: day(5) },
      { label: 'יתרה', amount: 4000, payOnEventDay: true },
    ],
  });

  // vendors in every stage
  for (const v of [
    { name: 'אולם הגן הקסום', category: 'venue', status: 'booked', quoteAmount: 43500, rating: 5 },
    {
      name: 'דנה צילום',
      category: 'photographer',
      status: 'quote',
      quoteAmount: 8500,
      included: '8 שעות, אלבום, גלריה אונליין',
      paymentTerms: '30% מקדמה, 70% ביום האירוע',
      rating: 4,
    },
    {
      name: 'סטודיו לי',
      category: 'photographer',
      status: 'quote',
      quoteAmount: 7200,
      included: '6 שעות, גלריה אונליין',
      rating: 3,
    },
    { name: 'DJ שחר', category: 'dj', status: 'booked', quoteAmount: 5800 },
    { name: 'קייטרינג שפע', category: 'catering', status: 'contacted', phone: '0501234567' },
    { name: 'פרחי הכרמל', category: 'flowers', status: 'idea' },
    { name: 'להקת הגשם', category: 'band', status: 'rejected' },
  ])
    await post(page, host, '/vendors', { op: 'save', vendor: v });

  // ideas: a note, a list, a link (no page to read in the test stack), a pinned one
  await post(page, host, '/ideas', {
    op: 'save',
    idea: {
      type: 'note',
      title: 'רעיון לחופה',
      body: 'חופה מעץ זית עם פרחי בר, בלי בד לבן.',
      color: 'brand',
      tags: ['חופה', 'עיצוב'],
      pinned: true,
    },
  });
  await post(page, host, '/ideas', {
    op: 'save',
    idea: {
      type: 'list',
      title: 'לפני הנסיעה לאולם',
      items: [
        { text: 'טבעות', done: true },
        { text: 'כתובה', done: false },
        { text: 'נעליים להחלפה', done: false },
      ],
      tags: ['יום האירוע'],
    },
  });
  await post(page, host, '/ideas', {
    op: 'save',
    idea: {
      type: 'link',
      url: 'https://example.com/dress',
      title: 'שמלה שמצאתי',
      body: 'לשאול על מידות',
      color: 'info',
      tags: ['שמלה'],
    },
  });
  return host;
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

const ready = (page: Page) =>
  page
    .getByText('כל השינויים נשמרו')
    .or(page.getByText('All changes saved'))
    .first()
    .waitFor({ timeout: 30_000 });

for (const lang of ['he', 'en'] as const) {
  test.describe(lang, () => {
    test.beforeEach(async ({ context, baseURL }, info) => {
      mkdirSync(OUT, { recursive: true });
      await context.addCookies([{ name: 'ui_lang', value: lang, url: baseURL! }]);
      void info;
    });

    test('the first run: three short steps', async ({ page }, info) => {
      const n = (s: string) => `${lang}-${info.project.name}-${s}`;
      const fresh = await newHost(page, `shots-first-${lang}`, 'pro', { date: day(150) });
      await open(page, at(fresh));
      await expect(page.getByRole('button', { name: /הבא|Next/ })).toBeVisible();
      await shot(page, n('01-onboarding-1'));
      await page.getByRole('button', { name: /הבא|Next/ }).click();
      await shot(page, n('02-onboarding-2'));
      await page.getByRole('button', { name: /הבא|Next/ }).click();
      await shot(page, n('03-onboarding-3'));
    });

    test('a lived-in plan, tool by tool', async ({ page }, info) => {
      const n = (s: string) => `${lang}-${info.project.name}-${s}`;
      const host = await lived(page, `shots-lived-${lang}`, 120);
      await open(page, at(host));
      await ready(page);
      await shot(page, n('10-overview'));
      await open(page, at(host, '/tasks'));
      await ready(page);
      await shot(page, n('20-tasks'));
      await open(page, at(host, '/budget'));
      await ready(page);
      await shot(page, n('30-budget'));
      await page
        .getByRole('radio', { name: /לוח תשלומים|Payment schedule/ })
        .click()
        .catch(() => undefined);
      await shot(page, n('31-budget-payments'));
      await open(page, at(host, '/vendors'));
      await ready(page);
      await shot(page, n('40-vendors'));
      await open(page, at(host, '/ideas'));
      await ready(page);
      await shot(page, n('50-ideas'));

      // the settings dialog and the quick add
      await open(page, at(host));
      await ready(page);
      await page
        .getByRole('button', { name: /הגדרות|Settings/ })
        .first()
        .click();
      await shot(page, n('60-settings'), false);
      await page.keyboard.press('Escape');

      // the invitation's overview carries the plan's next step, and the live event day the payments
      await open(page, `/app/invitations/${host.id}`);
      await shot(page, n('70-invitation-overview'));
    });

    test('a past event is a summary', async ({ page }, info) => {
      const host = await lived(page, `shots-past-${lang}`, 90);
      // the event happened: its date moves to five days ago
      await sql(
        `update invitations set draft = jsonb_set(draft, '{event,date}', to_jsonb($2::text)) where id = $1`,
        [host.id, day(-5)],
      );
      await open(page, at(host));
      await expect(page.locator('[data-plan-card="past"]')).toBeVisible({ timeout: 30_000 });
      await shot(page, `${lang}-${info.project.name}-80-past-overview`);
      await open(page, at(host, '/budget'));
      await ready(page);
      await shot(page, `${lang}-${info.project.name}-81-past-budget`);
      await open(page, at(host, '/vendors'));
      await ready(page);
      await shot(page, `${lang}-${info.project.name}-82-past-vendors`);
    });
  });
}

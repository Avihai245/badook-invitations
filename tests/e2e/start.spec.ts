import { expect, test } from '@playwright/test';
import { navItem, navTo } from '../support/event-nav';
import { open, sql } from '../support/phase5b';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// UX report stage 8: a new host from signing up to the event's home, its tour, and a plan that adds up —
// a host who only wants to plan: no invitation, no guests, nothing they didn't ask for
test('a new host: the three-screen start, only planning, the tour, and a budget in whole shekels', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const email = `start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);

  // no events yet: the empty list leads to "new event", which opens on the start, not the gallery
  await open(page, '/app/invitations/new');
  const wizard = page.getByTestId('start-wizard');
  await expect(wizard).toBeVisible();
  await expect(wizard.getByRole('heading', { name: 'איזה אירוע חוגגים?' })).toBeVisible();

  // 1 — the kind of event (a choice moves on by itself)
  await wizard.locator('[data-type="wedding"]').click();

  // 2 — what the host needs: the invitation is ticked; this host only plans
  await expect(wizard.getByRole('heading', { name: 'מה אתם צריכים לאירוע?' })).toBeVisible();
  const invite = wizard.getByRole('checkbox', { name: /הזמנה דיגיטלית ואישורי הגעה/ });
  await expect(invite).toHaveAttribute('aria-checked', 'true');
  await invite.click();
  await expect(wizard.getByText('בחרו לפחות כלי אחד')).toBeVisible();
  await expect(wizard.getByRole('button', { name: 'המשך' })).toBeDisabled();
  await wizard.getByRole('checkbox', { name: /תכנון האירוע/ }).click();
  await wizard.getByRole('button', { name: 'המשך' }).click();

  // 3 — names, when, how many, and the budget (asked only because planning was chosen)
  await expect(wizard.getByRole('heading', { name: 'ספרו לנו קצת' })).toBeVisible();
  await wizard.getByRole('button', { name: 'יוצאים לדרך' }).click();
  await expect(wizard.getByText('בחרו תאריך')).toBeVisible();
  await wizard.getByLabel('שם 1').fill('נועה');
  await wizard.getByLabel('שם 2').fill('איתי');
  await wizard.getByLabel('תאריך האירוע').fill(inDays(150));
  await wizard.getByLabel('כמה אורחים בערך?').fill('126');
  await wizard.getByLabel('תקציב משוער (₪)').fill('100000');
  // without the invitation the event is created at once, with its plan, and lands on its home
  await wizard.getByRole('button', { name: 'יוצאים לדרך' }).click();
  await page.waitForURL(/\/app\/invitations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30_000 });
  const id = /\/app\/invitations\/([0-9a-f-]{36})/.exec(page.url())![1]!;

  // the tour: three short stops, then gone (and not again)
  const tour = page.getByTestId('tour');
  await expect(tour).toBeVisible({ timeout: 10_000 });
  await expect(tour.getByRole('dialog')).toContainText('המסלול שלכם');
  for (let i = 0; i < 4 && (await tour.getByRole('button', { name: 'הבא' }).isVisible()); i++)
    await tour.getByRole('button', { name: 'הבא' }).click();
  await tour.getByRole('button', { name: 'סיימתי' }).click();
  await expect(tour).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('tour')).toBe(false);
  // remembered on the account, not just in this browser: another browser doesn't get it again
  await expect
    .poll(async () => {
      const [u] = await sql<{ done: string | null }>(
        `select raw_user_meta_data->>'badook_tour_done' as done from auth.users where email = $1`,
        [email],
      );
      return u?.done;
    })
    .toBe('true');
  {
    const other = await page
      .context()
      .browser()!
      .newContext({ storageState: await page.context().storageState() });
    const fresh = await other.newPage();
    // a browser that hasn't seen it (and isn't marked automated, which skips the tour on its own)
    await fresh.addInitScript(() => {
      window.localStorage.clear();
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await open(fresh, new URL(`/app/invitations/${id}`, page.url()).toString());
    await expect(fresh.getByTestId('home-journey')).toBeVisible();
    await fresh.waitForTimeout(1200);
    await expect(fresh.getByTestId('tour')).toHaveCount(0);
    await other.close();
  }

  // the home: only what was asked for — the plan's path, its budget and this week; no invitation, no RSVPs
  const [stored] = await sql<{ tools: string[] }>(
    `select features->'tools' as tools from invitations where id = $1`,
    [id],
  );
  expect(stored!.tools).toEqual(['plan']);
  await expect(page.getByTestId('home-journey')).toBeVisible();
  await expect(page.getByTestId('home-next')).toHaveAttribute('data-step', 'plan');
  await expect(page.getByTestId('home-journey').locator('[data-step]')).toHaveCount(1);
  await expect(page.getByTestId('home-budget')).toBeVisible();
  await expect(page.getByTestId('home-tasks')).toBeVisible();
  await expect(page.getByTestId('home-rsvp')).toHaveCount(0);
  await expect(navItem(page, 'guests')).toHaveCount(0);
  await expect(page.getByTestId('home-more-tools')).toBeVisible();

  // the plan adds up to the budget, every amount a whole shekel (B1)
  const [sums] = await sql<{ planned: string; agorot: string }>(
    `select coalesce(sum(public.planning_category_planned(c, (h->>'adults')::int, (h->>'children')::int,
              (h->>'tables')::int)), 0) as planned,
            count(*) filter (where c.planned_amount <> round(c.planned_amount)
              or coalesce(c.unit_price, 0) <> round(coalesce(c.unit_price, 0))) as agorot
       from public.budget_categories c, (select public.planning_headcount($1) as h) x
      where c.invitation_id = $1`,
    [id],
  );
  expect(Number(sums!.planned)).toBe(100000);
  expect(Number(sums!.agorot)).toBe(0);

  // the budget's screen from the event's navigation: the gauge and the same total
  await navTo(page, 'budget');
  await expect(page.getByTestId('budget-summary')).toBeVisible();
  await expect(page.getByRole('meter').first()).toBeVisible();
  await expect(page.getByTestId('budget-summary')).toContainText('100,000');
  await expect(page.getByTestId('budget-summary')).not.toContainText(/\d\.\d\d/);

  // the host changes their mind: the invitation is added from the home — its steps and screens come in
  await navTo(page, 'home');
  await page.waitForURL(new RegExp(`/app/invitations/${id}$`));
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.getByTestId('home-add-tools').filter({ visible: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'הכלים של האירוע' });
  await dialog.getByRole('checkbox', { name: /הזמנה דיגיטלית ואישורי הגעה/ }).click();
  await dialog.getByTestId('tools-save').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('home-journey').locator('[data-step="invitation"]')).toBeVisible();
  await expect(page.getByTestId('home-rsvp')).toHaveCount(0);
  await navTo(page, 'guests');
  await expect(page).toHaveURL(new RegExp(`/app/invitations/${id}/guests`));

  // one event: signing in again (the list) goes straight into it; "all events" still shows the list
  await open(page, '/app/invitations');
  await expect(page).toHaveURL(new RegExp(`/app/invitations/${id}$`));
  await open(page, '/app/invitations?all=1');
  await expect(page.getByTestId('event-card')).toHaveCount(1);
  await expect(page.getByTestId('event-enter')).toHaveAttribute('href', `/app/invitations/${id}`);

  // the design that came with the event (no invitation chosen at the start) can be swapped in the editor: what was written stays
  // (the editor's design tab on a computer; a phone's editor has its own modes)
  if (testInfo.project.name !== 'desktop') return;
  const [before] = await sql<{ template_id: string }>(`select template_id from invitations where id = $1`, [
    id,
  ]);
  await open(page, `/app/invitations/${id}/edit`);
  await page.getByRole('tab', { name: 'עיצוב' }).click();
  await page.getByRole('button', { name: 'עיצוב אחר', exact: true }).click();
  const panel = page.getByTestId('template-panel');
  await expect(panel.locator(`[data-template="${before!.template_id}"]`)).toBeDisabled();
  const other = panel.locator('[data-template]:not([disabled])').first();
  const next = (await other.getAttribute('data-template'))!;
  await other.click();
  await page.getByTestId('template-confirm').click();
  await expect(page.getByText('העיצוב הוחלף', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'כל השינויים נשמרו' })).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(async () => {
      const [row] = await sql<{ template_id: string; primary: string }>(
        `select template_id, draft#>>'{hosts,primary,he}' as primary from invitations where id = $1`,
        [id],
      );
      return `${row!.template_id}|${row!.primary}`;
    })
    .toBe(`${next}|נועה`);
});

test('a new host who wants a digital invitation goes on to the designs, with only the invitation', async ({
  page,
}) => {
  const email = `start-inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('form:has(input[name=password]) button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await open(page, '/app/invitations/new');
  const wizard = page.getByTestId('start-wizard');
  await wizard.locator('[data-type="birthday"]').click();
  // the invitation is already ticked: on, as it is
  await wizard.getByRole('button', { name: 'המשך' }).click();
  // no planning: no budget to ask about
  await expect(wizard.getByRole('heading', { name: 'ספרו לנו קצת' })).toBeVisible();
  await expect(wizard.getByLabel('תקציב משוער (₪)')).toHaveCount(0);
  await wizard.getByLabel('תאריך האירוע').fill(inDays(40));
  for (const field of await wizard.locator('input:not([type=date]):not([inputmode=numeric])').all())
    if (!(await field.inputValue())) await field.fill('דנה');
  await wizard.getByRole('button', { name: 'יוצאים לדרך' }).click();
  await page.waitForURL(/\/app\/invitations\/new\?gallery=1&type=birthday/);
  const answers = await page.evaluate(() => JSON.parse(sessionStorage.getItem('badook:start') ?? '{}'));
  expect(answers.tools).toEqual(['invite']);
});

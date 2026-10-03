import { expect, test } from '@playwright/test';
import { navTo } from '../support/event-nav';
import { open, sql } from '../support/phase5b';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// UX report stage 8: a new host from signing up to the event's home, its tour, and a plan that adds up
test('a new host: the three-screen start, planning first, the tour, and a budget in whole shekels', async ({
  page,
}) => {
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

  // 2 — names, when, how many, the budget
  await expect(wizard.getByRole('heading', { name: 'ספרו לנו קצת' })).toBeVisible();
  await wizard.getByRole('button', { name: 'המשך' }).click();
  await expect(wizard.getByText('בחרו תאריך')).toBeVisible();
  await wizard.getByLabel('שם 1').fill('נועה');
  await wizard.getByLabel('שם 2').fill('איתי');
  await wizard.getByLabel('תאריך האירוע').fill(inDays(150));
  await wizard.getByLabel('כמה אורחים בערך?').fill('126');
  await wizard.getByLabel('תקציב משוער (₪)').fill('100000');
  await wizard.getByRole('button', { name: 'המשך' }).click();

  // 3 — where to start: planning first creates the event and its plan, and lands on its home
  await expect(wizard.getByRole('heading', { name: 'מאיפה מתחילים?' })).toBeVisible();
  await wizard.getByRole('radio', { name: /מתכננים/ }).click();
  await wizard.getByRole('button', { name: 'יוצאים לדרך' }).click();
  await page.waitForURL(/\/app\/invitations\/[0-9a-f-]{36}(\?|$)/, { timeout: 30_000 });
  const id = /\/app\/invitations\/([0-9a-f-]{36})/.exec(page.url())![1]!;

  // the tour: a few short stops, then gone (and not again)
  const tour = page.getByTestId('tour');
  await expect(tour).toBeVisible({ timeout: 10_000 });
  await expect(tour.getByRole('dialog')).toContainText('הצעד הבא');
  for (let i = 0; i < 6 && (await tour.getByRole('button', { name: 'הבא' }).isVisible()); i++)
    await tour.getByRole('button', { name: 'הבא' }).click();
  await tour.getByRole('button', { name: 'סיימתי' }).click();
  await expect(tour).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('tour')).toBe(false);

  // the home: one next step, the budget, the RSVPs, the road
  await expect(page.getByTestId('home-next')).toBeVisible();
  await expect(page.getByTestId('home-budget')).toBeVisible();
  await expect(page.getByTestId('home-rsvp')).toBeVisible();
  await expect(page.getByTestId('home-road')).toBeVisible();

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

  // and the guests' screen, where inviting starts
  await navTo(page, 'guests');
  await expect(page).toHaveURL(new RegExp(`/app/invitations/${id}/guests`));
});

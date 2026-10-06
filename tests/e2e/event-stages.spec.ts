import { expect, test, type Page } from '@playwright/test';
import { navItem, navTo } from '../support/event-nav';
import { LOCAL, api, newHost, open, sql } from '../support/phase5b';

// The event's stages (workspace/EventSpace.tsx): on a computer, numbered steps on one line that open and
// close — what has work left and the stage being looked at are open, a finished stage folds into its ✓
// row, "celebrate" waits for the month before the event; the host's own folding is kept for the event,
// and going to a screen of a folded stage opens it. On a phone, each stage's sheet says which step it is.

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const toggle = (page: Page, stage: string) =>
  page.getByTestId('event-sidebar').locator(`[data-stage-toggle="${stage}"]`);

async function plannedHost(page: Page, days: number) {
  const host = await newHost(page, 'stages', 'business', { date: day(days) });
  const res = await api(page, `/api/invitations/${host.id}/planning`, 'POST', {
    op: 'init',
    template: 'wedding',
    totalBudget: 150000,
    integrationsMode: 'recommended',
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return host;
}

test.describe('the event’s stages', () => {
  test.skip(!LOCAL, 'sets the plan up through the database');

  test('on a computer: numbered steps that open with the work, a finished stage folds, the folding is kept', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the sidebar is a computer’s');
    test.setTimeout(90_000);
    const host = await plannedHost(page, 57);
    const guests = `/app/invitations/${host.id}/guests`;
    await open(page, guests);
    const side = page.getByTestId('event-sidebar');

    // the stages, named as steps, in their order
    await expect(side.getByRole('heading', { name: 'הכלים של האירוע' })).toBeVisible();
    await expect(toggle(page, 'plan')).toHaveAccessibleName(/^שלב 1 מתוך 4: תכנון האירוע/);
    await expect(toggle(page, 'celebrate')).toHaveAccessibleName(/^שלב 4 מתוך 4: ביום האירוע/);

    // open: the plan's open tasks, the stage being looked at, the seating not begun; the day is 57 days away
    await expect(toggle(page, 'plan')).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, 'invite')).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, 'arrange')).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, 'celebrate')).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle(page, 'celebrate')).toContainText('בעוד 57 ימים');
    await expect(navItem(page, 'live')).toBeHidden();
    await expect(navItem(page, 'guests')).toHaveAttribute('aria-current', 'page');

    // opened by the host, and still open after a reload
    await toggle(page, 'celebrate').click();
    await expect(toggle(page, 'celebrate')).toHaveAttribute('aria-expanded', 'true');
    await expect(navItem(page, 'gallery')).toBeVisible();
    // the last stage opens below the fold of a laptop's sidebar: it scrolls into view
    await expect(navItem(page, 'film')).toBeInViewport();
    await open(page, guests);
    await expect(toggle(page, 'celebrate')).toHaveAttribute('aria-expanded', 'true');

    // folded by the host, and kept folded — until they go to one of its screens
    await toggle(page, 'plan').click();
    await expect(toggle(page, 'plan')).toHaveAttribute('aria-expanded', 'false');
    await expect(navItem(page, 'budget')).toBeHidden();
    await open(page, guests);
    await expect(toggle(page, 'plan')).toHaveAttribute('aria-expanded', 'false');
    await open(page, `/app/invitations/${host.id}/plan/budget`);
    await expect(toggle(page, 'plan')).toHaveAttribute('aria-expanded', 'true');
    await expect(navItem(page, 'budget')).toHaveAttribute('aria-current', 'page');
    // …and the fold is forgotten: back on the guests, the stage with open tasks is open again
    await open(page, guests);
    await expect(toggle(page, 'plan')).toHaveAttribute('aria-expanded', 'true');

    // every task taken care of: the stage is finished, its row folds with ✓ — and still opens to go there
    await sql(`update public.plan_tasks set status = 'skipped' where invitation_id = $1`, [host.id]);
    await open(page, guests);
    await expect(toggle(page, 'plan')).toContainText('הושלם');
    await expect(toggle(page, 'plan')).toHaveAttribute('aria-expanded', 'false');
    await navTo(page, 'vendors');
    await page.waitForURL(/\/plan\/vendors$/);
    await expect(navItem(page, 'vendors')).toHaveAttribute('aria-current', 'page');
    await expect(toggle(page, 'plan')).toHaveAttribute('aria-expanded', 'true');
  });

  test('only the tools the host chose: the others are not there, a tap away with "add tools"', async ({
    page,
  }) => {
    const host = await plannedHost(page, 57);
    expect((await api(page, `/api/invitations/${host.id}/tools`, 'PUT', { tools: ['invite'] })).status).toBe(
      200,
    );
    await open(page, `/app/invitations/${host.id}`);
    // the sidebar and the phone's bar: only the invitation's screens
    await expect(navItem(page, 'guests')).toHaveCount(1);
    await expect(navItem(page, 'budget')).toHaveCount(0);
    await expect(navItem(page, 'seating')).toHaveCount(0);
    await expect(page.getByTestId('home-journey').locator('[data-step="plan"]')).toHaveCount(0);
    await expect(page.getByTestId('home-budget')).toHaveCount(0);
    // the plan isn't gone: only hidden — taking the planning back shows it as it was
    await expect(page.getByTestId('home-more-tools')).toContainText('תכנון האירוע');
    await page.goto(`/app/invitations/${host.id}?tools=1`);
    const dialog = page.getByRole('dialog', { name: 'הכלים של האירוע' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('checkbox', { name: /תכנון האירוע/ }).click();
    await dialog.getByTestId('tools-save').click();
    await expect(page.getByTestId('home-budget')).toBeVisible();
    await expect(navItem(page, 'budget')).toHaveCount(1);
  });

  test('a month before the event, "celebrate" is open by itself', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the sidebar is a computer’s');
    const host = await plannedHost(page, 20);
    await open(page, `/app/invitations/${host.id}/guests`);
    await expect(toggle(page, 'celebrate')).toHaveAttribute('aria-expanded', 'true');
    await expect(navItem(page, 'live')).toBeVisible();
  });

  test('on a phone: each stage’s sheet says which step it is', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the bottom bar is a phone’s');
    const host = await plannedHost(page, 57);
    await open(page, `/app/invitations/${host.id}`);
    await page.getByTestId('event-bottom-bar').locator('[data-stage-button="invite"]').click();
    const sheet = page.getByRole('dialog', { name: 'ההזמנה והמוזמנים' });
    await expect(sheet.getByText('שלב 2 מתוך 4', { exact: true })).toBeVisible();
    await expect(sheet.locator('[data-nav="guests"]')).toBeVisible();
  });
});

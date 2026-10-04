import { expect, test } from '@playwright/test';
import { signUpAs, unique } from '../support/admin';

// A tab left open across a deployment (features/site/StaleBuildGuard.client.tsx): once it learns a new
// build is running, its next link click is a full page load — never a client navigation into the old
// build's code, which is what froze pages until a refresh. Without a new build, links stay client-side.

const marked = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __mark?: number }).__mark === 1);

test('after a new deployment, the next link loads the page in full instead of freezing', async ({ page }) => {
  await signUpAs(page, unique('stale'));
  const nav = page.locator('a[href="/app/invitations/new?gallery=1"]:visible').first();

  // the same build: a client-side navigation (the page's own JavaScript stays)
  await page.evaluate(() => ((window as unknown as { __mark?: number }).__mark = 1));
  await nav.click();
  await page.waitForURL(/\/app\/invitations\/new\?gallery=1$/);
  expect(await marked(page)).toBe(true);

  // a new deployment, noticed when the tab comes back to the front
  await page.route('**/api/version', (route) =>
    route.fulfill({ json: { commit: 'a-newer-build' }, headers: { 'cache-control': 'no-store' } }),
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForResponse('**/api/version');
  await page.locator('a[href="/app/invitations"]:visible').first().click();
  await page.waitForURL(/\/app\/invitations$/);
  await page.waitForLoadState('load');
  expect(await marked(page)).toBe(false);
});

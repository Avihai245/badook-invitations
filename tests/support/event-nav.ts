import type { Page } from '@playwright/test';

/** Each screen of an event's space and the stage whose sheet holds it on a phone (workspace/stages.ts). */
const STAGE_OF: Record<string, string> = {
  tasks: 'plan',
  budget: 'plan',
  vendors: 'plan',
  ideas: 'plan',
  design: 'invite',
  guests: 'invite',
  share: 'invite',
  responses: 'invite',
  seating: 'arrange',
  live: 'celebrate',
  gallery: 'celebrate',
  film: 'celebrate',
};

/**
 * A screen of the event's navigation, in the DOM whatever the screen size (the sidebar is in the page
 * on a phone too, just not shown): for "is it offered" checks.
 */
export const navItem = (page: Page, key: string) =>
  page.getByTestId('event-sidebar').locator(`[data-nav="${key}"]`);

/**
 * Goes to a screen of the event the way a host does: the sidebar on a computer (opening its stage first
 * when it's folded), the stage's sheet on a phone.
 */
export async function navTo(page: Page, key: string) {
  const side = page.getByTestId('event-sidebar');
  const stage = STAGE_OF[key];
  if (await side.isVisible()) {
    const toggle = side.locator(`[data-stage-toggle="${stage}"]`);
    if (stage && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    await side.locator(`[data-nav="${key}"]`).click();
    return;
  }
  if (stage) {
    await page.getByTestId('event-bottom-bar').locator(`[data-stage-button="${stage}"]`).click();
    await page.getByRole('dialog').locator(`[data-nav="${key}"]`).click();
  } else
    await page.goto(page.url().replace(/(\/app\/invitations\/[^/]+).*$/, `$1/${key === 'home' ? '' : key}`));
}

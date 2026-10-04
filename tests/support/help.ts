import type { Page } from '@playwright/test';

/**
 * The assistant from the one help panel: the floating button on a phone (or a full-screen page),
 * "Guide & help" in the sidebar on a computer — both open the panel on its guide; the assistant is its
 * second tab.
 */
export async function openAssistant(page: Page) {
  const launcher = page.getByTestId('support-launcher');
  if (await launcher.isVisible()) await launcher.click();
  else await page.locator('[data-tour="help"]:visible').first().click();
  await page
    .getByTestId('support-chat')
    .getByRole('tab', { name: /שאלו את העוזר|Ask the assistant/ })
    .click();
}

import type { BrowserContext, Page } from '@playwright/test';

/**
 * Third-party media a page may load — YouTube / Vimeo stills and players, Google Maps — answered
 * locally, so a test's console stays clean whether or not the machine can reach them.
 */
const EXTERNAL =
  /^https:\/\/([a-z0-9-]+\.)*(ytimg\.com|youtube-nocookie\.com|youtube\.com|vimeo\.com|vimeocdn\.com|google\.com|googleapis\.com|gstatic\.com)\//;
/** a 1×1 GIF */
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function stubExternalMedia(target: Page | BrowserContext): Promise<void> {
  await target.route(EXTERNAL, (route) => {
    const type = route.request().resourceType();
    if (type === 'image') return route.fulfill({ status: 200, contentType: 'image/gif', body: PIXEL });
    if (type === 'document')
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>stub</title>',
      });
    return route.fulfill({ status: 204 });
  });
}

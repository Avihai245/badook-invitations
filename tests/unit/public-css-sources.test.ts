import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publicSourceFiles } from '../../scripts/lib/public-css-sources.mjs';

const root = process.cwd();
const files = publicSourceFiles(root).map((f) => relative(root, f).split('\\').join('/'));
const has = (path: string) => files.includes(path);
const reaches = (prefix: string) => files.filter((f) => f.startsWith(prefix));

/**
 * The public pages' stylesheet (src/styles/public.css) scans only the files these pages can reach. Two
 * ways to get it wrong: a file a public page uses missing (its classes would be unstyled), and the host
 * app's screens reachable from a public page (their utilities would be back in the render-blocking CSS
 * of the home page's first paint — the reason for the split).
 */
describe('the files the public pages reach (public CSS sources)', () => {
  it('has the public site and what it shares', () => {
    for (const path of [
      'src/app/(site)/page.tsx',
      'src/app/(site)/layout.tsx',
      'src/app/(site)/(auth)/layout.tsx',
      'src/app/(site)/contact/page.tsx',
      'src/app/global-not-found.tsx',
      'src/features/site/SiteHeader.client.tsx',
      'src/features/site/AccessibilityMenu.client.tsx',
      'src/features/site/home/DesignCard.tsx',
      'src/features/invitations/app/LazyTemplatePoster.tsx',
      'src/components/app/Button.tsx',
      'src/components/app/StatusPage.tsx',
    ])
      expect(has(path), path).toBe(true);
  });

  it('follows a dynamic import', () => {
    // DemoVideo loads the dialog with next/dynamic(() => import('@/components/app/Dialog'))
    expect(has('src/components/app/Dialog.tsx')).toBe(true);
  });

  it('imports the primitives one by one, never through the components barrel', () => {
    // components/app/index.ts re-exports every primitive: a public page that imported it would put the
    // toasts, menus and tooltips (Radix, ~40 KB of JavaScript) into the home page's first load. (Hint is
    // reached by the lazy dialog's close button, a chunk of its own, so it isn't listed.)
    expect(has('src/components/app/index.ts')).toBe(false);
    for (const path of ['Toast', 'Menu', 'DataTable', 'Drawer'])
      expect(has(`src/components/app/${path}.tsx`), path).toBe(false);
  });

  it('never reaches the host app’s screens', () => {
    for (const prefix of [
      'src/app/(site)/app/',
      'src/app/(site)/dev/',
      'src/features/invitations/editor/',
      'src/features/planning/',
      'src/features/support/',
      'src/features/film/',
      'src/features/admin/ui/',
      'src/features/live-gallery/',
    ])
      expect(reaches(prefix), prefix).toEqual([]);
  });
});

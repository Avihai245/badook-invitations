'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { UiLocale } from './app';

// Each language's dictionary is its own chunk (next.config: ui-he / ui-en, and the public pages'
// ui-site-he / ui-site-en), loaded through next/dynamic: the server render records the one it used, so
// the page sends only that chunk, and hydration waits for it (the server's HTML stays meanwhile — no
// flash).
const UiProviderHe = dynamic(() => import('./ui-he').then((m) => m.UiProviderHe));
const UiProviderEn = dynamic(() => import('./ui-en').then((m) => m.UiProviderEn));
const UiProviderSiteHe = dynamic(() => import('./ui-site-he').then((m) => m.UiProviderSiteHe));
const UiProviderSiteEn = dynamic(() => import('./ui-site-en').then((m) => m.UiProviderSiteEn));

/**
 * The host app's strings for its client components, in the UI language the server resolved — one
 * dictionary per page, not both (they are most of the app's shared JavaScript). `scope="site"` (the
 * root layout): the public pages' part only; the /app and /dev layouts mount the whole one inside it.
 * Tests use provider.tsx, which has both at hand.
 */
export function UiProvider({
  locale,
  scope = 'app',
  children,
}: {
  locale: UiLocale;
  scope?: 'site' | 'app';
  children: ReactNode;
}) {
  if (scope === 'site')
    return locale === 'en' ? (
      <UiProviderSiteEn>{children}</UiProviderSiteEn>
    ) : (
      <UiProviderSiteHe>{children}</UiProviderSiteHe>
    );
  return locale === 'en' ? <UiProviderEn>{children}</UiProviderEn> : <UiProviderHe>{children}</UiProviderHe>;
}

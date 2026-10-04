'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { UiLocale } from './app';

// Each language's dictionary is its own chunk (next.config: ui-he / ui-en), loaded through
// next/dynamic: the server render records the one it used, so the page sends only that chunk, and
// hydration waits for it (the server's HTML stays meanwhile — no flash).
const UiProviderHe = dynamic(() => import('./ui-he').then((m) => m.UiProviderHe));
const UiProviderEn = dynamic(() => import('./ui-en').then((m) => m.UiProviderEn));

/**
 * The host app's strings for its client components, in the UI language the server resolved — one
 * dictionary per page, not both (they are most of the app's shared JavaScript). The root layouts
 * mount this; tests use provider.tsx, which has both at hand.
 */
export function UiProvider({ locale, children }: { locale: UiLocale; children: ReactNode }) {
  return locale === 'en' ? <UiProviderEn>{children}</UiProviderEn> : <UiProviderHe>{children}</UiProviderHe>;
}

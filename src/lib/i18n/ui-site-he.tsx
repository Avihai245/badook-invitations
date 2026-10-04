'use client';

import type { ReactNode } from 'react';
import type { AppDict } from './app';
import { heCore } from './app-core.he';
import { UiProviderWith } from './client';

/**
 * The public pages in Hebrew: the site's dictionary only (app-core.he.ts) — not the app's screens'
 * strings (the editor, guests, planning…), which the /app pages add with the full one (provider-lazy).
 */
export function UiProviderSiteHe({ children }: { children: ReactNode }) {
  return (
    <UiProviderWith locale="he" t={heCore as AppDict}>
      {children}
    </UiProviderWith>
  );
}

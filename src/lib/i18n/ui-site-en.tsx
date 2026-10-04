'use client';

import type { ReactNode } from 'react';
import type { AppDict } from './app';
import { enCore } from './app-core.en';
import { UiProviderWith } from './client';

/**
 * The public pages in English: the site's dictionary only (app-core.en.ts) — not the app's screens'
 * strings (the editor, guests, planning…), which the /app pages add with the full one (provider-lazy).
 */
export function UiProviderSiteEn({ children }: { children: ReactNode }) {
  return (
    <UiProviderWith locale="en" t={enCore as AppDict}>
      {children}
    </UiProviderWith>
  );
}

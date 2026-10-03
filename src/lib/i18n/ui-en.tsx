'use client';

import type { ReactNode } from 'react';
import { en } from './app.en';
import { UiProviderWith } from './client';

/** The host app in English: only the English dictionary is in this module's chunk (provider.tsx). */
export function UiProviderEn({ children }: { children: ReactNode }) {
  return (
    <UiProviderWith locale="en" t={en}>
      {children}
    </UiProviderWith>
  );
}

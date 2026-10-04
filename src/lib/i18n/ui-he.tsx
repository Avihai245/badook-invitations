'use client';

import type { ReactNode } from 'react';
import { he } from './app.he';
import { UiProviderWith } from './client';

/** The host app in Hebrew: only the Hebrew dictionary is in this module's chunk (provider.tsx). */
export function UiProviderHe({ children }: { children: ReactNode }) {
  return (
    <UiProviderWith locale="he" t={he}>
      {children}
    </UiProviderWith>
  );
}

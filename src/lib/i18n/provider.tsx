import type { ReactNode } from 'react';
import type { UiLocale } from './app';
import { UiProviderEn } from './ui-en';
import { UiProviderHe } from './ui-he';

/**
 * The host app's strings in either UI language, both dictionaries at hand — for tests and tools. The
 * site's root layouts use provider-lazy.tsx, which sends a page only its own language's dictionary.
 */
export function UiProvider({ locale, children }: { locale: UiLocale; children: ReactNode }) {
  return locale === 'en' ? <UiProviderEn>{children}</UiProviderEn> : <UiProviderHe>{children}</UiProviderHe>;
}

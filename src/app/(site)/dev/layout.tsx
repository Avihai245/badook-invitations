import type { ReactNode } from 'react';
import '@/styles/app.css';
import { UiProvider } from '@/lib/i18n/provider-lazy';
import { getUiLocale } from '@/lib/i18n/server';

/** The dev pages show the app's screens: the whole UI dictionary (the root layout has the site's part). */
export default async function DevLayout({ children }: { children: ReactNode }) {
  return <UiProvider locale={await getUiLocale()}>{children}</UiProvider>;
}

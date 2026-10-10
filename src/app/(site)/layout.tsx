import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteRoot } from '@/features/site/SiteRoot';
import { getUiLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: { default: 'Badook — הזמנות דיגיטליות', template: '%s · Badook' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Root layout for the host app and the public pages that follow the `ui_lang` cookie. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteRoot locale={await getUiLocale()}>{children}</SiteRoot>;
}

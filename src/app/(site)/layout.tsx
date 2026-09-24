import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { uiDir } from '@/lib/i18n/app';
import { UiProvider } from '@/lib/i18n/client';
import { getUiLocale } from '@/lib/i18n/server';
import { A11Y_BOOT } from '@/features/site/a11y';
import { AccessibilityMenu } from '@/features/site/AccessibilityMenu.client';
import { CookieConsent } from '@/features/site/CookieConsent.client';
import '@/styles/app.css';

export const metadata: Metadata = {
  title: { default: 'Badook — הזמנות דיגיטליות', template: '%s · Badook' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/**
 * Root layout for the host app — Hebrew RTL by default, English when the `ui_lang` cookie says so.
 * The invitation has its own root layout (its languages are independent of the app's).
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const locale = await getUiLocale();
  return (
    <html lang={locale} dir={uiDir(locale)} suppressHydrationWarning>
      <head>
        {/* the accessibility menu's settings, before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT }} />
      </head>
      <body>
        <UiProvider locale={locale}>
          {children}
          <AccessibilityMenu />
          <CookieConsent />
        </UiProvider>
      </body>
    </html>
  );
}

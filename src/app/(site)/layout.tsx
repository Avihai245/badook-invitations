import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { faceUrl } from '@/features/invitations/fonts';
import { uiDir } from '@/lib/i18n/app';
import { UiProvider } from '@/lib/i18n/provider-lazy';
import { getUiLocale } from '@/lib/i18n/server';
import { A11Y_BOOT } from '@/features/site/a11y';
import { AccessibilityMenu } from '@/features/site/AccessibilityMenu.client';
import { StaleBuildGuard } from '@/features/site/StaleBuildGuard.client';
import { ThemeSync } from '@/features/site/Theme.client';
import { THEME_BOOT } from '@/features/site/theme';
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
  // the first screen's faces, fetched with the stylesheet rather than after it: the text and the
  // headlines in the UI language's script (app.css --font-sans / --font-display)
  const faces =
    locale === 'he'
      ? [faceUrl('Heebo', 'hebrew', 400), faceUrl('Frank Ruhl Libre', 'hebrew', 700)]
      : [faceUrl('Inter', 'latin', 400)];
  for (const href of faces) if (href) preload(href, { as: 'font', type: 'font/woff2', crossOrigin: '' });
  return (
    <html lang={locale} dir={uiDir(locale)} suppressHydrationWarning>
      <head>
        {/* the accessibility menu's settings and the system's look (light / dark), before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT + THEME_BOOT }} />
      </head>
      <body>
        <UiProvider locale={locale} scope="site">
          {children}
          <AccessibilityMenu />
          <ThemeSync />
          <StaleBuildGuard />
        </UiProvider>
      </body>
    </html>
  );
}

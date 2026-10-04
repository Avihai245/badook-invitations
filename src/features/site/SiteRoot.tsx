import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { appFaceUrl, appStaticFaceUrl } from '@/lib/app-fonts';
import { uiDir, type UiLocale } from '@/lib/i18n/app';
import { UiProvider } from '@/lib/i18n/provider-lazy';
import { A11Y_BOOT } from '@/features/site/a11y';
import { AccessibilityMenu } from '@/features/site/AccessibilityMenu.client';
import { StaleBuildGuard } from '@/features/site/StaleBuildGuard.client';
import { ThemeSync } from '@/features/site/Theme.client';
import { THEME_BOOT } from '@/features/site/theme';
import '@/styles/public.css';

/**
 * Root layout for the public pages and the host app — Hebrew RTL by default, English when the language
 * says so. The language is given: the layout of the pages that read the `ui_lang` cookie resolves it
 * per request ((site)/layout.tsx), the home page's two layouts fix it, so that page is static and
 * cacheable. `boot` is a script for <head> that runs before the first paint (the home page's).
 */
export async function SiteRoot({
  locale,
  boot,
  children,
}: {
  locale: UiLocale;
  boot?: string;
  children: ReactNode;
}) {
  // the first screen's faces, fetched with the stylesheet rather than after it: the text and the
  // headlines in the UI language's script (app.css --font-sans / --font-display)
  const faces =
    locale === 'he'
      ? [
          // the text: Hebrew, and the digits and letters beside it, in one file
          appFaceUrl('Heebo Variable', 'hebrew-basic'),
          // the headlines
          appStaticFaceUrl('Frank Ruhl Libre', 700),
        ]
      : [appFaceUrl('Inter Variable', 'latin-basic')];
  for (const href of faces) if (href) preload(href, { as: 'font', type: 'font/woff2', crossOrigin: '' });
  return (
    <html lang={locale} dir={uiDir(locale)} suppressHydrationWarning>
      {/* a root layout's <head> (this is its body, shared by the layouts) */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        {/* the accessibility menu's settings and the system's look (light / dark), before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT + THEME_BOOT + (boot ?? '') }} />
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

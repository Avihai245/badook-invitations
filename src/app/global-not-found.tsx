import type { Metadata } from 'next';
import { uiDir } from '@/lib/i18n/app';
import { UiProvider } from '@/lib/i18n/client';
import { getUi } from '@/lib/i18n/server';
import SiteNotFound from './(site)/not-found';
import '@/styles/app.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getUi();
  return {
    title: `${t.errorPages.notFound.metaTitle} · ${t.brand}`,
    robots: { index: false, follow: false },
  };
}

/**
 * An address that matches no page at all (next.config: experimental.globalNotFound): the site's own
 * "not found" — the same page as the site's not-found, in the visitor's UI language, in a document of
 * its own (no root layout wraps it).
 */
export default async function GlobalNotFound() {
  const { locale } = await getUi();
  return (
    <html lang={locale} dir={uiDir(locale)}>
      <body>
        <UiProvider locale={locale}>
          <SiteNotFound />
        </UiProvider>
      </body>
    </html>
  );
}

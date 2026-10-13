import type { ReactNode } from 'react';
import { SiteFooter } from '@/features/site/SiteFooter';
import { SiteHeader } from '@/features/site/SiteHeader.client';
import { uiDir, type AppDict, type UiLocale } from '@/lib/i18n/app';

/**
 * The frame of the two public request pages: the site's header and footer around a title and the form,
 * in the language of the page (a gallery link may ask for a language other than the site's cookie: the
 * content takes it, with its own `lang` and `dir`).
 */
export function RequestPageShell({
  t,
  locale,
  title,
  subtitle,
  children,
  aside,
}: {
  t: AppDict;
  locale: UiLocale;
  title: string;
  subtitle: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <div lang={locale} dir={uiDir(locale)}>
          <div className="border-b border-line bg-[radial-gradient(60%_120%_at_85%_0%,#F8E3D6,transparent_70%)]">
            <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-10 sm:px-6">
              <h1 className="font-display text-[30px] leading-tight font-bold tracking-[-0.01em] sm:text-[40px]">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-[16px] text-pretty text-muted">{subtitle}</p>
            </div>
          </div>
          <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 max-w-[720px]">{children}</div>
            {aside ? <aside className="flex min-w-0 flex-col gap-4">{aside}</aside> : null}
          </div>
        </div>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
